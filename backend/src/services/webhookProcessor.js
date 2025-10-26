/**
 * Webhook Processor Service
 * 
 * Handles incoming webhooks from Expandi and processes them into database records.
 * This is the core business logic for webhook ingestion.
 */

const Profile = require('../models/Profile');
const Campaign = require('../models/Campaign');
const Event = require('../models/Event');
const Contact = require('../models/Contact');
const { getDatabase } = require('../config/database');
const { sanitizeText } = require('../utils/sanitizer');

class WebhookProcessor {
  /**
   * Process an Expandi webhook
   * @param {Object} payload - Raw webhook payload from Expandi
   * @param {string} webhookId - Webhook ID from URL (required)
   * @returns {Object} Processing result
   */
  static async processWebhook(payload, webhookId) {
    try {
      // Extract key data from webhook
      const hookEvent = payload.hook?.event;
      const contactData = payload.contact;
      const messengerData = payload.messenger;

      if (!contactData || !messengerData) {
        throw new Error('Invalid webhook payload: missing contact or messenger data');
      }

      // 1. Find Profile (webhook ID is the only source of truth)
      const profile = this.processProfile(webhookId);

      // 2. Find or create Campaign
      const campaign = this.processCampaign(messengerData, profile.id);

      // 3. Find or create Contact
      const contact = this.processContact(contactData, campaign.id);

      // 4. Create/update Event
      const event = this.processEvent(hookEvent, messengerData, campaign.id, contact.contact_id, payload);

      // 5. Note: Real-time broadcasting handled separately to avoid circular dependencies

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
   * Process Profile from webhook data
   * @param {string} webhookId - Webhook ID from URL (required - only source of truth)
   * @returns {Object} Profile
   */
  static processProfile(webhookId) {
    // The URL parameter is the ONLY source of truth for profile identification
    if (!webhookId) {
      throw new Error('Missing webhook_id from URL - this should never happen');
    }

    // Find existing profile by webhook_id from URL
    const profile = Profile.findByWebhookId(webhookId);
    
    if (!profile) {
      throw new Error(`Profile with webhook_id ${webhookId} not found. Please create the profile first in the admin dashboard.`);
    }

    return profile;
  }

  /**
   * Process Campaign from webhook data
   * @param {Object} messengerData - Messenger data from webhook
   * @param {string} profileId - Profile UUID
   * @returns {Object} Campaign
   */
  static processCampaign(messengerData, profileId) {
    const campaignInstance = messengerData.campaign_instance;
    
    if (!campaignInstance) {
      throw new Error('Missing campaign_instance in webhook payload');
    }

    // Parse campaign instance
    const parsed = Campaign.parseCampaignInstance(campaignInstance);
    
    // Extract start date from campaign_instance (YYYY-MM-DD format)
    // Store as local date to avoid timezone conversion issues
    const startedAt = parsed.date ? `${parsed.date}T00:00:00` : new Date().toISOString();

    // Find or create campaign
    const campaign = Campaign.findOrCreate({
      profile_id: profileId,
      campaign_instance: campaignInstance,
      campaign_name: parsed.campaignName,
      started_at: startedAt
    });

    return campaign;
  }

  /**
   * Process Contact from webhook data
   * @param {Object} contactData - Contact data from webhook
   * @returns {Object} Contact
   */
  static processContact(contactData, campaignId) {
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
    const contact = Contact.findOrCreate(sanitizedData);

    return contact;
  }

  /**
   * Process Event from webhook data
   * @param {string} hookEvent - Event type from webhook (e.g., "linked_in_messenger.campaign_new_contact")
   * @param {Object} messengerData - Messenger data from webhook
   * @param {string} campaignId - Campaign UUID
   * @param {number} contactId - Contact ID
   * @param {Object} fullPayload - Full webhook payload for storage
   * @returns {Object} Event
   */
  static processEvent(hookEvent, messengerData, campaignId, contactId, fullPayload) {
    // Map Expandi event types to our internal event types
    const eventType = this.mapEventType(hookEvent);

    // For testing: generate unique contact ID if contact_id is -1
    let finalContactId = contactId;
    if (contactId === -1) {
      // Generate a unique contact ID based on timestamp and random number
      finalContactId = Math.floor(Date.now() / 1000) + Math.floor(Math.random() * 1000);
    }

    // Check for existing event to prevent duplicates
    const existingEvent = Event.findByContactCampaignAndType(campaignId, finalContactId, eventType);
    if (existingEvent) {
      console.log(`🔄 Duplicate webhook detected for contact ${finalContactId}, event type ${eventType}. Skipping.`);
      return existingEvent;
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

    // Create new event only if it doesn't already exist
    const event = Event.create(eventData);
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
