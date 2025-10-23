/**
 * Contact Model
 * 
 * Stores minimal contact information from Expandi webhooks.
 * NOTE: Contact details are NOT displayed to end users in MVP - only used for aggregation.
 */

const { getDatabase } = require('../config/database');

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
   * @returns {Object} Created contact object
   */
  static create(data) {
    const db = getDatabase();
    const now = new Date().toISOString();

    const stmt = db.prepare(`
      INSERT INTO contacts (
        contact_id, campaign_id, first_name, last_name, company_name, job_title,
        profile_link, email, phone, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      data.contact_id,
      data.campaign_id,
      data.first_name || null,
      data.last_name || null,
      data.company_name || null,
      data.job_title || null,
      data.profile_link || null,
      data.email || null,
      data.phone || null,
      now,
      now
    );

    return this.findByContactIdAndCampaign(data.contact_id, data.campaign_id);
  }

  /**
   * Find contact by Expandi contact ID and campaign ID
   * @param {number} contactId - Expandi contact ID
   * @param {string} campaignId - Campaign UUID
   * @returns {Object|null} Contact object or null if not found
   */
  static findByContactIdAndCampaign(contactId, campaignId) {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM contacts WHERE contact_id = ? AND campaign_id = ?');
    return stmt.get(contactId, campaignId);
  }

  /**
   * Find contact by Expandi contact ID (legacy method - returns first match)
   * @param {number} contactId - Expandi contact ID
   * @returns {Object|null} Contact object or null if not found
   * @deprecated Use findByContactIdAndCampaign for campaign-scoped operations
   */
  static findById(contactId) {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM contacts WHERE contact_id = ? LIMIT 1');
    return stmt.get(contactId);
  }

  /**
   * Update contact information within a specific campaign
   * @param {number} contactId - Expandi contact ID
   * @param {string} campaignId - Campaign UUID
   * @param {Object} data - Data to update
   * @returns {Object} Updated contact object
   */
  static update(contactId, campaignId, data) {
    const db = getDatabase();
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
      return this.findByContactIdAndCampaign(contactId, campaignId);
    }

    updateFields.push('updated_at = ?');
    values.push(now);
    values.push(contactId, campaignId);

    const stmt = db.prepare(`
      UPDATE contacts 
      SET ${updateFields.join(', ')}
      WHERE contact_id = ? AND campaign_id = ?
    `);

    stmt.run(...values);

    return this.findByContactIdAndCampaign(contactId, campaignId);
  }

  /**
   * Find or create contact within a specific campaign (upsert)
   * @param {Object} data - Contact data (must include contact_id and campaign_id)
   * @returns {Object} Existing or newly created contact
   */
  static findOrCreate(data) {
    if (!data.campaign_id) {
      throw new Error('campaign_id is required for contact operations');
    }
    
    const existing = this.findByContactIdAndCampaign(data.contact_id, data.campaign_id);
    
    if (existing) {
      // Update with any new information
      return this.update(data.contact_id, data.campaign_id, data);
    }
    
    return this.create(data);
  }

  /**
   * Delete contact from a specific campaign
   * @param {number} contactId - Expandi contact ID
   * @param {string} campaignId - Campaign UUID
   * @returns {boolean} True if deleted, false if not found
   */
  static delete(contactId, campaignId) {
    const db = getDatabase();
    const stmt = db.prepare('DELETE FROM contacts WHERE contact_id = ? AND campaign_id = ?');
    const result = stmt.run(contactId, campaignId);
    return result.changes > 0;
  }
}

module.exports = Contact;
