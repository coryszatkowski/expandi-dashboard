/**
 * Backfill Service
 * 
 * Handles historical data backfill from spreadsheets with duplicate handling.
 * Ensures data integrity while allowing historical data import.
 */

const { v4: uuidv4 } = require('uuid');
const { getDatabase } = require('../config/database');
const Profile = require('../models/Profile');
const Campaign = require('../models/Campaign');
const Contact = require('../models/Contact');
const Event = require('../models/Event');
const CSVParser = require('../utils/csvParser');

class BackfillService {
  /**
   * Process historical data from CSV file
   * @param {Object} options - Processing options
   * @param {string} options.profileId - Profile UUID
   * @param {string} options.filePath - Path to CSV file
   * @param {boolean} options.skipExisting - Skip contacts that already exist
   * @param {boolean} options.updateExisting - Update existing contacts
   * @returns {Object} Processing results
   */
  static async processHistoricalData(options) {
    const {
      profileId,
      filePath,
      skipExisting = true,
      updateExisting = false
    } = options;

    console.log('🔄 Starting CSV backfill process:', {
      profileId,
      filePath,
      skipExisting,
      updateExisting
    });

    try {
      // 1. Validate CSV file
      console.log('📋 Step 1: Validating CSV structure...');
      const validation = await CSVParser.validateCSVStructure(filePath);
      console.log('📋 CSV validation result:', validation);
      
      if (!validation.isValid) {
        throw new Error(`Invalid CSV structure. Missing columns: ${validation.missingColumns.join(', ')}`);
      }

      // 2. Parse CSV data
      console.log('📊 Step 2: Parsing CSV data...');
      const contacts = await CSVParser.parseORIONLeadSheet(filePath);
      console.log(`📊 Parsed ${contacts.length} contacts from CSV`);
      
      if (contacts.length === 0) {
        throw new Error('No valid contacts found in CSV file');
      }

      // 3. Verify profile exists
      console.log('👤 Step 3: Verifying profile exists...');
      const profile = await Profile.findById(profileId);
      console.log('👤 Profile lookup result:', profile ? `Found profile: ${profile.account_name}` : 'Profile not found');
      
      if (!profile) {
        throw new Error('Profile not found');
      }

      // 4. Group contacts by campaign
      console.log('📁 Step 4: Grouping contacts by campaign...');
      const campaignGroups = this.groupContactsByCampaign(contacts);
      console.log(`📁 Found ${Object.keys(campaignGroups).length} campaigns:`, Object.keys(campaignGroups));

      // 5. Process each campaign
      const results = {
        contactsCreated: 0,
        contactsUpdated: 0,
        contactsSkipped: 0,
        eventsCreated: 0,
        errors: [],
        campaigns: [],
        summary: {
          totalContacts: contacts.length,
          processedContacts: 0,
          duplicateContacts: 0,
          totalCampaigns: Object.keys(campaignGroups).length
        }
      };

      for (const [campaignName, campaignContacts] of Object.entries(campaignGroups)) {
        console.log(`🎯 Processing campaign: ${campaignName} with ${campaignContacts.length} contacts`);
        try {
          // Find or create campaign
          console.log(`🔍 Looking for or creating campaign: ${campaignName}`);
          const campaign = await this.findOrCreateCampaign(profileId, campaignName, campaignContacts[0].invited_at);
          console.log(`✅ Campaign result:`, campaign ? `Found/created campaign with ID: ${campaign.id}` : 'Campaign creation failed');
          
          const campaignResult = {
            campaignName,
            contactsCreated: 0,
            contactsUpdated: 0,
            contactsSkipped: 0,
            eventsCreated: 0,
            errors: []
          };

          // Process each contact in this campaign
          for (const contactData of campaignContacts) {
            console.log(`👤 Processing contact: ${contactData.id} (${contactData.first_name} ${contactData.last_name})`);
            try {
              const result = await this.processHistoricalContact(
                contactData,
                campaign.id,
                contactData.invited_at || new Date().toISOString(),
                skipExisting,
                updateExisting
              );
              console.log(`✅ Contact ${contactData.id} result:`, {
                created: result.contactCreated,
                updated: result.contactUpdated,
                skipped: result.contactSkipped,
                eventsCreated: result.eventsCreated
              });
              
              campaignResult.contactsCreated += result.contactCreated ? 1 : 0;
              campaignResult.contactsUpdated += result.contactUpdated ? 1 : 0;
              campaignResult.contactsSkipped += result.contactSkipped ? 1 : 0;
              campaignResult.eventsCreated += result.eventsCreated;
              
              results.contactsCreated += result.contactCreated ? 1 : 0;
              results.contactsUpdated += result.contactUpdated ? 1 : 0;
              results.contactsSkipped += result.contactSkipped ? 1 : 0;
              results.eventsCreated += result.eventsCreated;
              results.summary.processedContacts++;
              
              if (result.contactSkipped) {
                results.summary.duplicateContacts++;
              }
            } catch (error) {
              const errorInfo = {
                contact: {
                  id: contactData.id,
                  name: `${contactData.first_name} ${contactData.last_name}`,
                  company: contactData.company_name
                },
                error: error.message
              };
              campaignResult.errors.push(errorInfo);
              results.errors.push(errorInfo);
            }
          }

          results.campaigns.push(campaignResult);
        } catch (error) {
          results.errors.push({
            campaign: campaignName,
            error: error.message
          });
        }
      }

      // 6. Clean up temporary file
      try {
        const fs = require('fs');
        fs.unlinkSync(filePath);
      } catch (cleanupError) {
        console.warn('Failed to clean up temporary file:', cleanupError.message);
      }

      return results;

    } catch (error) {
      console.error('Backfill processing error:', error);
      throw error;
    }
  }

  /**
   * Process individual historical contact
   * @param {Object} contactData - Contact data from CSV
   * @param {string} campaignId - Campaign UUID
   * @param {string} backfillDate - Historical date
   * @param {boolean} skipExisting - Skip if contact exists
   * @param {boolean} updateExisting - Update if contact exists
   * @returns {Object} Processing result
   */
  static async processHistoricalContact(contactData, campaignId, backfillDate, skipExisting, updateExisting) {
    console.log(`🔍 Processing contact ${contactData.id} in campaign ${campaignId}`);
    
    const result = {
      contactCreated: false,
      contactUpdated: false,
      contactSkipped: false,
      eventsCreated: 0
    };

    try {
      // Check if contact already exists in this specific campaign
      console.log(`🔍 Checking if contact ${contactData.id} exists in campaign ${campaignId}`);
      const existingContact = await Contact.findByContactIdAndCampaign(contactData.id, campaignId);
      console.log(`🔍 Existing contact check result:`, existingContact ? 'Contact exists' : 'Contact does not exist');
      
      if (existingContact) {
        if (skipExisting) {
          // Skip this contact completely
          result.contactSkipped = true;
          return result;
        } else if (updateExisting) {
          // Update existing contact with new data
          console.log(`🔄 Updating existing contact ${contactData.id}`);
          await Contact.update(contactData.id, campaignId, {
            first_name: contactData.first_name || existingContact.first_name,
            last_name: contactData.last_name || existingContact.last_name,
            company_name: contactData.company_name || existingContact.company_name,
            job_title: contactData.job_title || existingContact.job_title,
            profile_link: contactData.profile_link || existingContact.profile_link,
            email: contactData.email || contactData.work_email || existingContact.email,
            phone: contactData.phone || existingContact.phone
          });
          result.contactUpdated = true;
          console.log(`✅ Contact ${contactData.id} updated successfully`);
        }
      } else {
        // Create new contact in this campaign using findOrCreate (like webhooks)
        console.log(`➕ Creating new contact ${contactData.id} in campaign ${campaignId}`);
        const newContact = await Contact.findOrCreate({
          contact_id: contactData.id,
          campaign_id: campaignId,
          first_name: contactData.first_name,
          last_name: contactData.last_name,
          company_name: contactData.company_name,
          job_title: contactData.job_title,
          profile_link: contactData.profile_link,
          email: contactData.email || contactData.work_email,
          phone: contactData.phone
        });
        result.contactCreated = true;
        console.log(`✅ Contact ${contactData.id} created successfully:`, newContact ? 'Contact object returned' : 'No contact object returned');
      }

      // Only create events if we're not skipping
      if (!result.contactSkipped) {
        const events = this.createHistoricalEvents(contactData, campaignId, backfillDate);
        console.log(`Creating ${events.length} events for contact ${contactData.id}`);
        
        for (const eventData of events) {
          try {
            await Event.create(eventData);
            result.eventsCreated++;
          } catch (error) {
            console.error(`Failed to create event for contact ${contactData.id}:`, error);
          }
        }
      }

      return result;

    } catch (error) {
      console.error(`Error processing contact ${contactData.id}:`, error);
      throw error;
    }
  }

  /**
   * Create historical events based on CSV data
   * @param {Object} contactData - Contact data from CSV
   * @param {string} campaignId - Campaign UUID
   * @param {string} backfillDate - Historical date
   * @returns {Array} Array of event data
   */
  static createHistoricalEvents(contactData, campaignId, backfillDate) {
    const events = [];

    // If we have invited_at timestamp, create invite_sent event
    if (contactData.invited_at) {
      events.push({
        campaign_id: campaignId,
        contact_id: contactData.id,
        event_type: 'invite_sent',
        event_data: { source: 'backfill' },
        invited_at: new Date(contactData.invited_at).toISOString(),
        connected_at: null,
        replied_at: null,
        conversation_status: contactData.conversation_status
      });
    }

    // If we have connected_at timestamp, create connection_accepted event
    if (contactData.connected_at) {
      events.push({
        campaign_id: campaignId,
        contact_id: contactData.id,
        event_type: 'connection_accepted',
        event_data: { source: 'backfill' },
        invited_at: null,
        connected_at: new Date(contactData.connected_at).toISOString(),
        replied_at: null,
        conversation_status: contactData.conversation_status
      });
    }

    // If conversation_status is "Replied", create contact_replied event (NO fabricated timestamp)
    if (contactData.conversation_status === 'Replied') {
      events.push({
        campaign_id: campaignId,
        contact_id: contactData.id,
        event_type: 'contact_replied',
        event_data: { source: 'backfill' },
        invited_at: null,
        connected_at: null,
        replied_at: null, // Don't fabricate - leave null
        conversation_status: 'replied'
      });
    }

    return events;
  }

  /**
   * Group contacts by campaign name
   * @param {Array} contacts - Array of contact data
   * @returns {Object} Groups of contacts by campaign
   */
  static groupContactsByCampaign(contacts) {
    const groups = {};
    
    for (const contact of contacts) {
      const campaignName = contact.campaign || 'Unknown Campaign';
      
      if (!groups[campaignName]) {
        groups[campaignName] = [];
      }
      
      groups[campaignName].push(contact);
    }
    
    return groups;
  }

  /**
   * Find or create campaign for historical data
   * @param {string} profileId - Profile UUID
   * @param {string} campaignName - Campaign name
   * @param {string} backfillDate - Historical date
   * @returns {Object} Campaign object
   */
  static async findOrCreateCampaign(profileId, campaignName, backfillDate) {
    console.log(`🔍 Looking for existing campaign: ${campaignName} for profile ${profileId}`);
    
    // Look for existing campaign with similar name
    const existingCampaign = await Campaign.findByProfileAndName(profileId, campaignName);
    
    if (existingCampaign) {
      console.log(`✅ Found existing campaign: ${existingCampaign.id} - ${existingCampaign.campaign_name}`);
      return existingCampaign;
    }

    // Create new campaign for historical data
    console.log(`➕ Creating new campaign: ${campaignName} for profile ${profileId}`);
    const campaignData = {
      profile_id: profileId,
      campaign_instance: campaignName,
      campaign_name: campaignName,
      started_at: backfillDate
    };

    const newCampaign = await Campaign.create(campaignData);
    console.log(`✅ Created new campaign: ${newCampaign.id} - ${newCampaign.campaign_name}`);
    return newCampaign;
  }

}

module.exports = BackfillService;
