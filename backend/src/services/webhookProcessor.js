/**
 * Webhook Processor Service
 * 
 * Handles incoming webhooks from Expandi and processes them into database records.
 * This is the core business logic for webhook ingestion.
 * Enhanced with error handling, retry logic, and company-level contact deduplication.
 */

const { v4: uuidv4 } = require('uuid');
const Profile = require('../models/Profile');
const Campaign = require('../models/Campaign');
const Event = require('../models/Event');
const Contact = require('../models/Contact');
const FailedWebhookArchive = require('../models/FailedWebhookArchive');
const ErrorNotification = require('../models/ErrorNotification');
const { getDatabase } = require('../config/database');
const { sanitizeText } = require('../utils/sanitizer');

class WebhookProcessor {
  /**
   * Process an Expandi webhook with error handling and retry logic
   * @param {Object} payload - Raw webhook payload from Expandi
   * @param {string} webhookId - Webhook ID from URL (required)
   * @param {number} retryCount - Current retry attempt (default: 0)
   * @returns {Object} Processing result with correlation_id
   */
  static async processWebhook(payload, webhookId, retryCount = 0) {
    const correlationId = uuidv4();
    
    try {
      console.log(`🔍 [${correlationId}] Starting webhook processing for webhookId: ${webhookId} (attempt ${retryCount + 1})`);
      
      // Check payload size (50KB limit)
      const payloadSize = JSON.stringify(payload).length;
      if (payloadSize > 50000) {
        throw new Error(`Webhook payload too large: ${payloadSize} bytes (max 50KB)`);
      }

      // Process webhook using original logic
      const result = await this.processWebhookOriginal(payload, webhookId);
      
      console.log(`✅ [${correlationId}] Webhook ${webhookId} processed successfully`);
      
      return {
        ...result,
        correlation_id: correlationId
      };
      
    } catch (error) {
      console.error(`❌ [${correlationId}] Webhook ${webhookId} failed (attempt ${retryCount + 1}):`, error.message);
      
      // Determine error severity
      const severity = this.determineErrorSeverity(error, retryCount);
      
      // If this is the final attempt, archive the webhook and create notification
      if (retryCount >= 2) { // 3 total attempts (0, 1, 2)
        await this.handleFinalFailure(webhookId, payload, error, retryCount + 1, correlationId, severity);
      }
      
      throw error;
    }
  }

  /**
   * Original webhook processing logic (unchanged)
   * @param {Object} payload - Raw webhook payload from Expandi
   * @param {string} webhookId - Webhook ID from URL (required)
   * @returns {Object} Processing result
   */
  static async processWebhookOriginal(payload, webhookId) {
    try {
      console.log(`🔍 [DEBUG] Starting webhook processing for webhookId: ${webhookId}`);
      
      // Extract key data from webhook
      const hookEvent = payload.hook?.event;
      const contactData = payload.contact;
      const messengerData = payload.messenger;

      console.log(`🔍 [DEBUG] Extracted data:`, {
        hookEvent,
        contactId: contactData?.id,
        campaignInstance: messengerData?.campaign_instance
      });

      if (!contactData || !messengerData) {
        throw new Error('Invalid webhook payload: missing contact or messenger data');
      }

      // 1. Find Profile (webhook ID is the only source of truth)
      console.log(`🔍 [DEBUG] Processing profile for webhookId: ${webhookId}`);
      const profile = await this.processProfile(webhookId);
      console.log(`🔍 [DEBUG] Profile result:`, profile ? { id: profile.id, account_name: profile.account_name } : 'undefined');
      
      if (!profile) {
        throw new Error(`Profile with webhook_id ${webhookId} not found. Please create the profile first in the admin dashboard.`);
      }

      // 2. Find or create Campaign
      console.log(`🔍 [DEBUG] Processing campaign for profileId: ${profile.id}`);
      const campaign = await this.processCampaign(messengerData, profile.id, payload);
      console.log(`🔍 [DEBUG] Campaign result:`, campaign ? { id: campaign.id, campaign_name: campaign.campaign_name } : 'undefined');
      
      if (!campaign) {
        throw new Error(`Failed to create or find campaign for profile ${profile.id}`);
      }

      // 3. Find or create Contact with COMPANY-LEVEL DEDUPLICATION
      console.log(`🔍 [DEBUG] Processing contact with campaignId: ${campaign.id}, companyId: ${profile.company_id}`);
      const contact = await this.processContactWithCompanyDeduplication(contactData, campaign.id, profile.company_id);
      console.log(`🔍 [DEBUG] Contact result:`, contact ? { contact_id: contact.contact_id, first_name: contact.first_name, last_name: contact.last_name } : 'undefined');
      
      if (!contact) {
        throw new Error(`Failed to create or find contact for campaign ${campaign.id}`);
      }

      // 4. Create Event (NO DEDUPLICATION - process every webhook)
      console.log(`🔍 [DEBUG] Processing event for campaignId: ${campaign.id}, contactId: ${contact.contact_id}`);
      const event = await this.processEvent(hookEvent, messengerData, campaign.id, contact.contact_id, payload);
      console.log(`🔍 [DEBUG] Event result:`, event ? { id: event.id, event_type: event.event_type } : 'undefined');
      
      if (!event) {
        throw new Error(`Failed to create event for campaign ${campaign.id} and contact ${contact.contact_id}`);
      }

      return {
        success: true,
        profile: profile,
        campaign: campaign,
        contact: contact,
        event: event
      };
    } catch (error) {
      console.error('Error processing webhook:', error);
      throw error;
    }
  }

  /**
   * Determine error severity based on error type and retry count
   * @param {Error} error - The error that occurred
   * @param {number} retryCount - Current retry attempt
   * @returns {string} Severity level (critical, error, warning)
   */
  static determineErrorSeverity(error, retryCount) {
    const message = error.message.toLowerCase();
    
    // Critical errors that need immediate attention
    if (message.includes('database') || message.includes('connection') || message.includes('timeout')) {
      return 'critical';
    }
    
    // Warnings for data issues that might be recoverable
    if (message.includes('invalid') || message.includes('missing') || message.includes('not found')) {
      return 'warning';
    }
    
    // Default to error for other issues
    return 'error';
  }

  /**
   * Handle final failure after all retries exhausted
   * @param {string} webhookId - Webhook ID
   * @param {Object} payload - Original webhook payload
   * @param {Error} error - The error that occurred
   * @param {number} retryCount - Total number of retry attempts
   * @param {string} correlationId - Correlation ID for tracing
   * @param {string} severity - Error severity
   */
  static async handleFinalFailure(webhookId, payload, error, retryCount, correlationId, severity) {
    try {
      // Archive the failed webhook
      await FailedWebhookArchive.create({
        webhook_id: webhookId,
        raw_payload: payload,
        error_message: error.message,
        retry_count: retryCount,
        contact_id: payload.contact?.id || null,
        campaign_instance: payload.messenger?.campaign_instance || null,
        correlation_id: correlationId,
        severity: severity
      });

      // Create error notification for admin dashboard
      await ErrorNotification.create({
        notification_type: 'webhook_failed',
        message: `Webhook ${webhookId} failed after ${retryCount} attempts: ${error.message}`,
        webhook_id: webhookId,
        correlation_id: correlationId,
        severity: severity
      });

      console.log(`📦 [${correlationId}] Webhook ${webhookId} archived after ${retryCount} failed attempts`);
      
    } catch (archiveError) {
      console.error(`❌ [${correlationId}] Failed to archive webhook:`, archiveError);
    }
  }

  /**
   * Process Profile from webhook data
   * @param {string} webhookId - Webhook ID from URL (required - only source of truth)
   * @returns {Object} Profile
   */
  static async processProfile(webhookId) {
    // The URL parameter is the ONLY source of truth for profile identification
    if (!webhookId) {
      throw new Error('Missing webhook_id from URL - this should never happen');
    }

    // Find existing profile by webhook_id from URL
    const profile = await Profile.findByWebhookId(webhookId);
    
    if (!profile) {
      throw new Error(`Profile with webhook_id ${webhookId} not found. Please create the profile first in the admin dashboard.`);
    }

    return profile;
  }

  /**
   * Process Campaign from webhook data
   * @param {Object} messengerData - Messenger data from webhook
   * @param {string} profileId - Profile UUID
   * @param {Object} payload - Full webhook payload (for timestamp extraction)
   * @returns {Object} Campaign
   */
  static async processCampaign(messengerData, profileId, payload = null) {
    const campaignInstance = messengerData.campaign_instance;
    
    if (!campaignInstance) {
      throw new Error('Missing campaign_instance in webhook payload');
    }

    // Parse campaign instance
    const parsed = Campaign.parseCampaignInstance(campaignInstance);
    
    // Extract start date from webhook's fired_datetime (first webhook for this campaign)
    // Convert webhook timestamp format "2025-10-14 17:50:33.104655+00:00" to ISO 8601
    let startedAt = new Date().toISOString(); // Fallback to current time
    
    if (payload?.hook?.fired_datetime) {
      try {
        // Convert "2025-10-14 17:50:33.104655+00:00" to ISO 8601 format
        const webhookTimestamp = payload.hook.fired_datetime;
        // Replace space with T and convert timezone format from +00:00 to +0000 or Z
        let isoTimestamp = webhookTimestamp.replace(' ', 'T');
        // Handle timezone: convert +00:00 to Z (UTC) or +HH:MM to +HHMM
        if (isoTimestamp.endsWith('+00:00')) {
          isoTimestamp = isoTimestamp.replace('+00:00', 'Z');
        } else {
          // Replace timezone colon: +05:30 -> +0530
          isoTimestamp = isoTimestamp.replace(/([+-]\d{2}):(\d{2})$/, '$1$2');
        }
        // Parse and convert to ISO 8601
        const date = new Date(isoTimestamp);
        if (!isNaN(date.getTime())) {
          startedAt = date.toISOString();
        }
      } catch (error) {
        console.warn('Failed to parse webhook fired_datetime, using fallback:', error);
      }
    }

    // Find or create campaign
    const campaign = await Campaign.findOrCreate({
      profile_id: profileId,
      campaign_instance: campaignInstance,
      campaign_name: parsed.campaignName,
      started_at: startedAt
    });

    return campaign;
  }

  /**
   * Process Contact from webhook data with company-level deduplication
   * @param {Object} contactData - Contact data from webhook
   * @param {string} campaignId - Campaign UUID
   * @param {string} companyId - Company UUID
   * @returns {Object} Contact
   */
  static async processContactWithCompanyDeduplication(contactData, campaignId, companyId) {
    if (!contactData.id) {
      throw new Error('Missing contact ID in webhook payload');
    }

    // Sanitize contact data from webhook
    const sanitizedData = {
      contact_id: contactData.id,
      campaign_id: campaignId,
      company_id: companyId, // Add company_id for deduplication
      first_name: sanitizeText(contactData.first_name || ''),
      last_name: sanitizeText(contactData.last_name || ''),
      company_name: sanitizeText(contactData.company?.name || contactData.company_name || ''),
      job_title: sanitizeText(contactData.job_title || ''),
      profile_link: sanitizeText(contactData.profile_link || contactData.profile_link_public_identifier || ''),
      email: sanitizeText(contactData.email || ''),
      phone: sanitizeText(contactData.phone || '')
    };

    // Use enhanced findOrCreate with company deduplication
    const contact = await Contact.findOrCreateWithCompanyDeduplication(sanitizedData);

    return contact;
  }

  /**
   * Process Contact from webhook data (legacy method)
   * @param {Object} contactData - Contact data from webhook
   * @param {string} campaignId - Campaign UUID
   * @returns {Object} Contact
   * @deprecated Use processContactWithCompanyDeduplication for company-level deduplication
   */
  static async processContact(contactData, campaignId) {
    if (!contactData.id) {
      throw new Error('Missing contact ID in webhook payload');
    }

    // Sanitize contact data from webhook
    const sanitizedData = {
      contact_id: contactData.id,
      campaign_id: campaignId, // Add campaign_id which is required by Contact model
      first_name: sanitizeText(contactData.first_name || ''),
      last_name: sanitizeText(contactData.last_name || ''),
      company_name: sanitizeText(contactData.company?.name || contactData.company_name || ''),
      job_title: sanitizeText(contactData.job_title || ''),
      profile_link: sanitizeText(contactData.profile_link || contactData.profile_link_public_identifier || ''),
      email: sanitizeText(contactData.email || ''),
      phone: sanitizeText(contactData.phone || '')
    };

    // Find or create contact with sanitized data
    const contact = await Contact.findOrCreate(sanitizedData);

    return contact;
  }

  /**
   * Process Event from webhook data - REMOVED DEDUPLICATION
   * @param {string} hookEvent - Event type from webhook (e.g., "linked_in_messenger.campaign_new_contact")
   * @param {Object} messengerData - Messenger data from webhook
   * @param {string} campaignId - Campaign UUID
   * @param {number} contactId - Contact ID
   * @param {Object} fullPayload - Full webhook payload for storage
   * @returns {Object} Event
   */
  static async processEvent(hookEvent, messengerData, campaignId, contactId, fullPayload) {
    // Map Expandi event types to our internal event types
    const eventType = this.mapEventType(hookEvent);

    // For testing: generate unique contact ID if contact_id is -1
    let finalContactId = contactId;
    if (contactId === -1) {
      // Generate a unique contact ID based on timestamp and random number
      finalContactId = Math.floor(Date.now() / 1000) + Math.floor(Math.random() * 1000);
    }

    // For reply events, check if contact has already replied
    if (eventType === 'contact_replied') {
      const existingReply = await Event.findByContactCampaignAndType(campaignId, finalContactId, 'contact_replied');
      if (existingReply) {
        console.log(`⏭️  Skipping duplicate reply webhook for contact ${finalContactId} in campaign ${campaignId} - already replied`);
        return existingReply; // Return existing event instead of creating a new one
      }
    }

    // Extract timestamps based on event type
    const eventData = {
      campaign_id: campaignId,
      contact_id: finalContactId,
      event_type: eventType,
      event_data: fullPayload,
      invited_at: messengerData.invited_at || null,
      connected_at: messengerData.connected_at || null,
      replied_at: null, // Set below if it's a reply event
      conversation_status: messengerData.conversation_status
    };

    // Set replied_at if this is a reply event
    if (eventType === 'contact_replied') {
      eventData.replied_at = fullPayload.hook?.fired_datetime || new Date().toISOString();
    }

    // Create new event
    const event = await Event.create(eventData);
    console.log(`✅ New event created: ${eventType} for contact ${finalContactId}`);

    return event;
  }

  /**
   * Map Expandi event types to our internal event types
   * @param {string} expandiEvent - Event type from Expandi webhook
   * @returns {string} Internal event type
   */
  static mapEventType(expandiEvent) {
    // Expandi event types we expect:
    // - Connection Request Sent (or similar)
    // - Connection Request Accepted (or "linked_in_messenger.campaign_new_contact")
    // - Contact Replied
    
    if (!expandiEvent) {
      return 'unknown';
    }

    const eventLower = expandiEvent.toLowerCase();

    // Handle specific Expandi event types
    if (eventLower === 'linked_in_messenger.campaign_new_contact') {
      return 'connection_accepted';
    }

    if (eventLower === 'linked_in_messenger.requested') {
      return 'invite_sent';
    }

    if (eventLower.includes('connection') && eventLower.includes('sent')) {
      return 'invite_sent';
    }

    if (eventLower.includes('connection') && (eventLower.includes('accepted') || eventLower.includes('new_contact'))) {
      return 'connection_accepted';
    }

    if (eventLower.includes('replied') || eventLower.includes('reply')) {
      return 'contact_replied';
    }

    // Default fallback
    return 'unknown';
  }

  /**
   * Validate webhook payload structure
   * @param {Object} payload - Webhook payload
   * @returns {Object} Validation result { valid: boolean, errors: array }
   */
  static validatePayload(payload) {
    const errors = [];

    if (!payload.hook) {
      errors.push('Missing hook data');
    }

    if (!payload.contact) {
      errors.push('Missing contact data');
    } else if (!payload.contact.id) {
      errors.push('Missing contact ID');
    }

    if (!payload.messenger) {
      errors.push('Missing messenger data');
    } else {
      if (!payload.messenger.li_account) {
        errors.push('Missing LinkedIn account ID');
      }
      if (!payload.messenger.campaign_instance) {
        errors.push('Missing campaign instance');
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors
    };
  }

  /**
   * Clean up duplicate events for a campaign
   * Keeps the latest event for each contact/event_type combination
   * @param {string} campaignId - Campaign UUID
   * @returns {Object} Cleanup results
   */
  static cleanupDuplicateEvents(campaignId) {
    const db = getDatabase();
    
    console.log(`🧹 Starting cleanup of duplicate events for campaign ${campaignId}`);
    
    // Find all events for this campaign
    const eventsStmt = db.prepare(`
      SELECT * FROM events 
      WHERE campaign_id = ? 
      ORDER BY contact_id, event_type, created_at DESC
    `);
    const allEvents = eventsStmt.all(campaignId);
    
    // Group by contact_id and event_type
    const groupedEvents = {};
    allEvents.forEach(event => {
      const key = `${event.contact_id}-${event.event_type}`;
      if (!groupedEvents[key]) {
        groupedEvents[key] = [];
      }
      groupedEvents[key].push(event);
    });
    
    let duplicatesRemoved = 0;
    
    // For each group, keep only the latest event
    Object.values(groupedEvents).forEach(events => {
      if (events.length > 1) {
        // Keep the first (latest) event, delete the rest
        const keepEvent = events[0];
        const deleteEvents = events.slice(1);
        
        console.log(`🔄 Found ${events.length} duplicate events for contact ${keepEvent.contact_id}, event type ${keepEvent.event_type}. Keeping latest, removing ${deleteEvents.length} duplicates.`);
        
        deleteEvents.forEach(event => {
          const deleteStmt = db.prepare('DELETE FROM events WHERE id = ?');
          deleteStmt.run(event.id);
          duplicatesRemoved++;
        });
      }
    });
    
    console.log(`✅ Cleanup complete. Removed ${duplicatesRemoved} duplicate events.`);
    
    return {
      total_events_before: allEvents.length,
      duplicates_removed: duplicatesRemoved,
      total_events_after: allEvents.length - duplicatesRemoved
    };
  }

}

module.exports = WebhookProcessor;
