/**
 * Contact Model
 * 
 * Stores minimal contact information from Expandi webhooks.
 * NOTE: Contact details are NOT displayed to end users in MVP - only used for aggregation.
 * Enhanced with company-level deduplication support.
 */

const db = require('../utils/databaseHelper');

class Contact {
  /**
   * Create a new contact
   * @param {Object} data - Contact data
   * @param {number} data.contact_id - Expandi contact ID
   * @param {string} data.campaign_id - Campaign UUID (required)
   * @param {string} [data.first_name] - First name
   * @param {string} [data.last_name] - Last name
   * @param {string} [data.company_name] - Company name
   * @param {string} [data.job_title] - Job title
   * @param {string} [data.profile_link] - LinkedIn profile URL
   * @param {string} [data.email] - Email address
   * @param {string} [data.phone] - Phone number
   * @param {number} [data.linked_to_contact_id] - Reference to original contact for deduplication
   * @returns {Object} Created contact object
   */
  static async create(data) {
    const now = new Date().toISOString();

    await db.execute(`
      INSERT INTO contacts (
        contact_id, campaign_id, first_name, last_name, company_name, job_title,
        profile_link, email, phone, linked_to_contact_id, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      data.contact_id,
      data.campaign_id,
      data.first_name || null,
      data.last_name || null,
      data.company_name || null,
      data.job_title || null,
      data.profile_link || null,
      data.email || null,
      data.phone || null,
      data.linked_to_contact_id || null,
      now,
      now
    ]);

    return await this.findByContactIdAndCampaign(data.contact_id, data.campaign_id);
  }

  /**
   * Find contact by Expandi contact ID and campaign ID
   * @param {number} contactId - Expandi contact ID
   * @param {string} campaignId - Campaign UUID
   * @returns {Object|null} Contact object or null if not found
   */
  static async findByContactIdAndCampaign(contactId, campaignId) {
    return await db.selectOne('SELECT * FROM contacts WHERE contact_id = ? AND campaign_id = ?', [contactId, campaignId]);
  }

  /**
   * Find contact by Expandi contact ID (legacy method - returns first match)
   * @param {number} contactId - Expandi contact ID
   * @returns {Object|null} Contact object or null if not found
   * @deprecated Use findByContactIdAndCampaign for campaign-scoped operations
   */
  static async findById(contactId) {
    return await db.selectOne('SELECT * FROM contacts WHERE contact_id = ? LIMIT 1', [contactId]);
  }

  /**
   * Update contact information within a specific campaign
   * @param {number} contactId - Expandi contact ID
   * @param {string} campaignId - Campaign UUID
   * @param {Object} data - Data to update
   * @returns {Object} Updated contact object
   */
  static async update(contactId, campaignId, data) {
    const now = new Date().toISOString();

    const updateFields = [];
    const values = [];

    const updatableFields = [
      'first_name', 'last_name', 'company_name', 'job_title',
      'profile_link', 'email', 'phone'
    ];

    updatableFields.forEach(field => {
      if (data[field] !== undefined) {
        updateFields.push(`${field} = ?`);
        values.push(data[field]);
      }
    });

    if (updateFields.length === 0) {
      return await this.findByContactIdAndCampaign(contactId, campaignId);
    }

    updateFields.push('updated_at = ?');
    values.push(now);
    values.push(contactId, campaignId);

    await db.execute(`
      UPDATE contacts 
      SET ${updateFields.join(', ')}
      WHERE contact_id = ? AND campaign_id = ?
    `, values);

    return await this.findByContactIdAndCampaign(contactId, campaignId);
  }

  /**
   * Find or create contact within a specific campaign (upsert)
   * @param {Object} data - Contact data (must include contact_id and campaign_id)
   * @returns {Object} Existing or newly created contact
   */
  static async findOrCreate(data) {
    if (!data.campaign_id) {
      throw new Error('campaign_id is required for contact operations');
    }
    
    const existing = await this.findByContactIdAndCampaign(data.contact_id, data.campaign_id);
    
    if (existing) {
      // Update with any new information
      return await this.update(data.contact_id, data.campaign_id, data);
    }
    
    return await this.create(data);
  }

  /**
   * Delete contact from a specific campaign
   * @param {number} contactId - Expandi contact ID
   * @param {string} campaignId - Campaign UUID
   * @returns {boolean} True if deleted, false if not found
   */
  static async delete(contactId, campaignId) {
    const result = await db.execute('DELETE FROM contacts WHERE contact_id = ? AND campaign_id = ?', [contactId, campaignId]);
    return result.changes > 0;
  }

  /**
   * Find or create contact with company-level deduplication
   * This is the main method used by webhook processing
   * @param {Object} data - Contact data
   * @param {string} data.campaign_id - Campaign UUID (required)
   * @param {string} data.company_id - Company UUID (required for deduplication)
   * @param {number} data.contact_id - Expandi contact ID
   * @param {string} [data.first_name] - First name
   * @param {string} [data.last_name] - Last name
   * @param {string} [data.company_name] - Company name
   * @param {string} [data.job_title] - Job title
   * @param {string} [data.profile_link] - LinkedIn profile URL
   * @param {string} [data.email] - Email address
   * @param {string} [data.phone] - Phone number
   * @returns {Object} Contact object (existing or newly created)
   */
  static async findOrCreateWithCompanyDeduplication(data) {
    if (!data.campaign_id) {
      throw new Error('campaign_id is required for contact operations');
    }
    if (!data.company_id) {
      throw new Error('company_id is required for company-level deduplication');
    }

    // First check if contact already exists for this campaign
    const existingByContactId = await this.findByContactIdAndCampaign(data.contact_id, data.campaign_id);
    if (existingByContactId) {
      console.log(`🔄 Found existing contact by contact_id ${data.contact_id} in campaign ${data.campaign_id}`);
      return existingByContactId;
    }

    // Check for duplicates within the same company
    const duplicateContact = await this.findDuplicateInCompany(data, data.company_id);
    if (duplicateContact) {
      console.log(`🔄 Found duplicate contact "${data.first_name} ${data.last_name}" in company ${data.company_id}, linking to existing contact`);
      return await this.createLinkedContact(data, duplicateContact);
    }

    // No duplicate found, create new contact
    console.log(`✅ Creating new contact "${data.first_name} ${data.last_name}" for company ${data.company_id}`);
    return await this.create(data);
  }

  /**
   * Find duplicate contact within the same company
   * @param {Object} contactData - New contact data
   * @param {string} companyId - Company UUID
   * @returns {Object|null} Duplicate contact or null if none found
   */
  static async findDuplicateInCompany(contactData, companyId) {
    // Build search criteria - look for contacts with same name, email, or profile link
    const searchCriteria = [];
    const searchParams = [];

    if (contactData.first_name && contactData.last_name) {
      searchCriteria.push('(c.first_name = ? AND c.last_name = ?)');
      searchParams.push(contactData.first_name, contactData.last_name);
    }

    if (contactData.email) {
      searchCriteria.push('c.email = ?');
      searchParams.push(contactData.email);
    }

    if (contactData.profile_link) {
      searchCriteria.push('c.profile_link = ?');
      searchParams.push(contactData.profile_link);
    }

    if (searchCriteria.length === 0) {
      return null; // No searchable criteria
    }

    // Search within the same company
    const query = `
      SELECT c.* 
      FROM contacts c
      JOIN campaigns camp ON c.campaign_id = camp.id
      JOIN profiles p ON camp.profile_id = p.id
      WHERE p.company_id = ? 
      AND (${searchCriteria.join(' OR ')})
      ORDER BY c.created_at ASC
      LIMIT 1
    `;

    searchParams.unshift(companyId);
    return await db.selectOne(query, searchParams);
  }

  /**
   * Create a linked contact (duplicate within same company)
   * @param {Object} contactData - New contact data
   * @param {Object} originalContact - Original contact to link to
   * @returns {Object} Created linked contact
   */
  static async createLinkedContact(contactData, originalContact) {
    const linkedData = {
      ...contactData,
      linked_to_contact_id: originalContact.contact_id
    };
    
    return await this.create(linkedData);
  }

  /**
   * Get unique contacts for a company (deduplicated)
   * @param {string} companyId - Company UUID
   * @param {Object} options - Query options
   * @param {number} [options.limit] - Maximum number of contacts to return
   * @param {number} [options.offset] - Number of contacts to skip
   * @param {string} [options.startDate] - Filter contacts created after this date
   * @param {string} [options.endDate] - Filter contacts created before this date
   * @returns {Array} Array of unique contact records
   */
  static async getUniqueContactsForCompany(companyId, options = {}) {
    const { limit = 1000, offset = 0, startDate, endDate } = options;
    
    let whereClause = 'WHERE p.company_id = ?';
    const params = [companyId];

    if (startDate) {
      whereClause += ' AND c.created_at >= ?';
      params.push(startDate);
    }

    if (endDate) {
      whereClause += ' AND c.created_at <= ?';
      params.push(endDate);
    }

    const query = `
      SELECT DISTINCT
        CASE 
          WHEN c.linked_to_contact_id IS NOT NULL THEN c.linked_to_contact_id
          ELSE c.contact_id
        END as unique_contact_id,
        c.first_name,
        c.last_name,
        c.company_name,
        c.job_title,
        c.profile_link,
        c.email,
        c.phone,
        c.created_at,
        c.linked_to_contact_id,
        camp.campaign_name,
        p.account_name as profile_name,
        (
          SELECT MAX(e.invited_at)
          FROM events e
          JOIN campaigns ec ON e.campaign_id = ec.id
          JOIN profiles ep ON ec.profile_id = ep.id
          WHERE e.contact_id = CASE 
            WHEN c.linked_to_contact_id IS NOT NULL THEN c.linked_to_contact_id
            ELSE c.contact_id
          END
          AND ep.company_id = ?
          AND e.invited_at IS NOT NULL
        ) as invited_at,
        (
          SELECT MAX(e.connected_at)
          FROM events e
          JOIN campaigns ec ON e.campaign_id = ec.id
          JOIN profiles ep ON ec.profile_id = ep.id
          WHERE e.contact_id = CASE 
            WHEN c.linked_to_contact_id IS NOT NULL THEN c.linked_to_contact_id
            ELSE c.contact_id
          END
          AND ep.company_id = ?
          AND e.connected_at IS NOT NULL
        ) as connected_at,
        (
          SELECT MAX(e.replied_at)
          FROM events e
          JOIN campaigns ec ON e.campaign_id = ec.id
          JOIN profiles ep ON ec.profile_id = ep.id
          WHERE e.contact_id = CASE 
            WHEN c.linked_to_contact_id IS NOT NULL THEN c.linked_to_contact_id
            ELSE c.contact_id
          END
          AND ep.company_id = ?
          AND e.replied_at IS NOT NULL
        ) as replied_at
      FROM contacts c
      JOIN campaigns camp ON c.campaign_id = camp.id
      JOIN profiles p ON camp.profile_id = p.id
      ${whereClause}
      ORDER BY c.created_at DESC
      LIMIT ? OFFSET ?
    `;

    // Add company_id three times for the subqueries
    params.push(companyId, companyId, companyId);

    params.push(limit, offset);
    return await db.selectAll(query, params);
  }

  /**
   * Get contact count for a company (deduplicated)
   * @param {string} companyId - Company UUID
   * @param {Object} options - Query options
   * @param {string} [options.startDate] - Filter contacts created after this date
   * @param {string} [options.endDate] - Filter contacts created before this date
   * @returns {number} Count of unique contacts
   */
  static async getUniqueContactCountForCompany(companyId, options = {}) {
    const { startDate, endDate } = options;
    
    let whereClause = 'WHERE p.company_id = ?';
    const params = [companyId];

    if (startDate) {
      whereClause += ' AND c.created_at >= ?';
      params.push(startDate);
    }

    if (endDate) {
      whereClause += ' AND c.created_at <= ?';
      params.push(endDate);
    }

    const query = `
      SELECT COUNT(DISTINCT 
        CASE 
          WHEN c.linked_to_contact_id IS NOT NULL THEN c.linked_to_contact_id
          ELSE c.contact_id
        END
      ) as unique_count
      FROM contacts c
      JOIN campaigns camp ON c.campaign_id = camp.id
      JOIN profiles p ON camp.profile_id = p.id
      ${whereClause}
    `;

    const result = await db.selectOne(query, params);
    return result?.unique_count || 0;
  }
}

module.exports = Contact;
