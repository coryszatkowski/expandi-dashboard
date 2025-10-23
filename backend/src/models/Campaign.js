/**
 * Campaign Model
 * 
 * Represents individual LinkedIn outreach campaigns within a LinkedIn account.
 * Each campaign is identified by a unique campaign_instance string from Expandi.
 */

const { v4: uuidv4 } = require('uuid');
const { getDatabase } = require('../config/database');

class Campaign {
  /**
   * Create a new campaign
   * @param {Object} data - Campaign data
   * @param {string} data.profile_id - Profile UUID
   * @param {string} data.campaign_instance - Full campaign instance string from Expandi
   * @param {string} data.campaign_name - Parsed campaign name (codes like "A008+M003")
   * @param {string} data.started_at - ISO 8601 timestamp
   * @returns {Object} Created campaign object
   */
  static create(data) {
    const db = getDatabase();
    const id = uuidv4();
    const now = new Date().toISOString();

    const stmt = db.prepare(`
      INSERT INTO campaigns (
        id, profile_id, campaign_instance, campaign_name, started_at, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      data.profile_id,
      data.campaign_instance,
      data.campaign_name,
      data.started_at,
      now,
      now
    );

    return this.findById(id);
  }

  /**
   * Find campaign by ID
   * @param {string} id - Campaign UUID
   * @returns {Object|null} Campaign object or null if not found
   */
  static findById(id) {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT c.*, p.account_name, p.company_id
      FROM campaigns c
      JOIN profiles p ON c.profile_id = p.id
      WHERE c.id = ?
    `);
    return stmt.get(id);
  }

  /**
   * Find campaign by campaign_instance (Expandi's unique identifier)
   * @param {string} campaignInstance - Campaign instance string
   * @returns {Object|null} Campaign object or null if not found
   */
  static findByCampaignInstance(campaignInstance) {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT c.*, p.account_name, p.company_id
      FROM campaigns c
      JOIN profiles p ON c.profile_id = p.id
      WHERE c.campaign_instance = ?
    `);
    return stmt.get(campaignInstance);
  }

  /**
   * Find campaign by profile_id and campaign_name (for deduplication)
   * @param {string} profileId - Profile UUID
   * @param {string} campaignName - Campaign name (e.g., "A008+M003")
   * @returns {Object|null} Campaign object or null if not found
   */
  static findByProfileAndName(profileId, campaignName) {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT c.*, p.account_name, p.company_id
      FROM campaigns c
      JOIN profiles p ON c.profile_id = p.id
      WHERE c.profile_id = ? AND c.campaign_name = ?
    `);
    return stmt.get(profileId, campaignName);
  }

  /**
   * Get all campaigns for a profile
   * @param {string} profileId - Profile UUID
   * @returns {Array} Array of campaign objects
   */
  static findByProfile(profileId) {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT * FROM campaigns
      WHERE profile_id = ?
      ORDER BY started_at DESC
    `);
    return stmt.all(profileId);
  }

  /**
   * Get all campaigns for a company (via profiles)
   * @param {string} companyId - Company UUID
   * @returns {Array} Array of campaign objects
   */
  static findByCompany(companyId) {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT c.*, p.account_name
      FROM campaigns c
      JOIN profiles p ON c.profile_id = p.id
      WHERE p.company_id = ?
      ORDER BY c.started_at DESC
    `);
    return stmt.all(companyId);
  }

  /**
   * Update campaign
   * @param {string} id - Campaign UUID
   * @param {Object} data - Data to update
   * @returns {Object} Updated campaign object
   */
  static update(id, data) {
    const db = getDatabase();
    const now = new Date().toISOString();

    const updateFields = [];
    const values = [];

    if (data.campaign_name !== undefined) {
      updateFields.push('campaign_name = ?');
      values.push(data.campaign_name);
    }

    if (data.campaign_instance !== undefined) {
      updateFields.push('campaign_instance = ?');
      values.push(data.campaign_instance);
    }

    if (data.started_at !== undefined) {
      updateFields.push('started_at = ?');
      values.push(data.started_at);
    }

    updateFields.push('updated_at = ?');
    values.push(now);
    values.push(id);

    const stmt = db.prepare(`
      UPDATE campaigns 
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `);

    stmt.run(...values);

    return this.findById(id);
  }

  /**
   * Delete campaign
   * @param {string} id - Campaign UUID
   * @returns {boolean} True if deleted, false if not found
   */
  static delete(id) {
    const db = getDatabase();
    
    // NOTE: Deleting a campaign will also delete all associated events
    // (due to ON DELETE CASCADE in the schema)
    const stmt = db.prepare('DELETE FROM campaigns WHERE id = ?');
    const result = stmt.run(id);

    return result.changes > 0;
  }

  /**
   * Find or create campaign by profile_id + campaign_name
   * Useful for webhook processing - prevents duplicate campaigns with same name
   * @param {Object} data - Campaign data
   * @returns {Object} Existing or newly created campaign
   */
  static findOrCreate(data) {
    // First try to find by campaign_instance (for exact matches)
    const existingByInstance = this.findByCampaignInstance(data.campaign_instance);
    if (existingByInstance) {
      return existingByInstance;
    }
    
    // Then try to find by profile_id + campaign_name (for logical deduplication)
    const existingByName = this.findByProfileAndName(data.profile_id, data.campaign_name);
    if (existingByName) {
      // Update the existing campaign with the new campaign_instance and started_at
      return this.update(existingByName.id, {
        campaign_instance: data.campaign_instance,
        started_at: data.started_at
      });
    }
    
    return this.create(data);
  }

  /**
   * Parse campaign_instance string to extract meaningful data
   * Format: "2025-10-14+Tobias Millington+A008+M003"
   * @param {string} campaignInstance - Campaign instance string
   * @returns {Object} Parsed data: { date, profileName, campaignName }
   */
  static parseCampaignInstance(campaignInstance) {
    const parts = campaignInstance.split('+');
    
    // Extract date (first part)
    const date = parts[0] || null;
    
    // Extract profile name (second part) - for reference only
    const profileName = parts[1] || null;
    
    // Extract campaign codes (third and fourth parts) - this becomes campaign_name
    const code1 = parts[2] || null;
    const code2 = parts[3] || null;
    const campaignName = code1 && code2 ? `${code1}+${code2}` : (code1 || campaignInstance);
    
    return {
      date,                    // "2025-10-14"
      profileName,             // "Tobias Millington" (for reference)
      campaignName             // "A008+M003" (the actual campaign name)
    };
  }
}

module.exports = Campaign;
