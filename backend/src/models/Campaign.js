/**
 * Campaign Model
 * 
 * Represents individual LinkedIn outreach campaigns within a LinkedIn account.
 * Each campaign is identified by a unique campaign_instance string from Expandi.
 */

const { v4: uuidv4 } = require('uuid');
const db = require('../utils/databaseHelper');

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
  static async create(data) {
    const id = uuidv4();
    const now = new Date().toISOString();

    await db.execute(`
      INSERT INTO campaigns (
        id, profile_id, campaign_instance, campaign_name, started_at, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      data.profile_id,
      data.campaign_instance,
      data.campaign_name,
      data.started_at,
      now,
      now
    ]);

    return await this.findById(id);
  }

  /**
   * Find campaign by ID
   * @param {string} id - Campaign UUID
   * @returns {Object|null} Campaign object or null if not found
   */
  static async findById(id) {
    return await db.selectOne(`
      SELECT c.*, p.account_name, p.company_id
      FROM campaigns c
      JOIN profiles p ON c.profile_id = p.id
      WHERE c.id = ?
    `, [id]);
  }

  /**
   * Find campaign by campaign_instance (Expandi's unique identifier)
   * @param {string} campaignInstance - Campaign instance string
   * @returns {Object|null} Campaign object or null if not found
   */
  static async findByCampaignInstance(campaignInstance) {
    return await db.selectOne(`
      SELECT c.*, p.account_name, p.company_id
      FROM campaigns c
      JOIN profiles p ON c.profile_id = p.id
      WHERE c.campaign_instance = ?
    `, [campaignInstance]);
  }

  /**
   * Find campaign by profile_id and campaign_name (for deduplication)
   * @param {string} profileId - Profile UUID
   * @param {string} campaignName - Campaign name (e.g., "A008+M003")
   * @returns {Object|null} Campaign object or null if not found
   */
  static async findByProfileAndName(profileId, campaignName) {
    return await db.selectOne(`
      SELECT c.*, p.account_name, p.company_id
      FROM campaigns c
      JOIN profiles p ON c.profile_id = p.id
      WHERE c.profile_id = ? AND c.campaign_name = ?
    `, [profileId, campaignName]);
  }

  /**
   * Get all campaigns for a profile
   * @param {string} profileId - Profile UUID
   * @returns {Array} Array of campaign objects
   */
  static async findByProfile(profileId) {
    return await db.selectAll(`
      SELECT * FROM campaigns
      WHERE profile_id = ?
      ORDER BY started_at DESC
    `, [profileId]);
  }

  /**
   * Get all campaigns for a company (via profiles)
   * @param {string} companyId - Company UUID
   * @returns {Array} Array of campaign objects
   */
  static async findByCompany(companyId) {
    return await db.selectAll(`
      SELECT c.*, p.account_name
      FROM campaigns c
      JOIN profiles p ON c.profile_id = p.id
      WHERE p.company_id = ?
      ORDER BY c.started_at DESC
    `, [companyId]);
  }

  /**
   * Update campaign
   * @param {string} id - Campaign UUID
   * @param {Object} data - Data to update
   * @returns {Object} Updated campaign object
   */
  static async update(id, data) {
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

    await db.execute(`
      UPDATE campaigns 
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `, values);

    return await this.findById(id);
  }

  /**
   * Delete campaign
   * @param {string} id - Campaign UUID
   * @returns {boolean} True if deleted, false if not found
   */
  static async delete(id) {
    // NOTE: Deleting a campaign will also delete all associated events
    // (due to ON DELETE CASCADE in the schema)
    const result = await db.execute('DELETE FROM campaigns WHERE id = ?', [id]);

    return result.changes > 0;
  }

  /**
   * Find or create campaign by profile_id + campaign_name
   * Useful for webhook processing - prevents duplicate campaigns with same name
   * @param {Object} data - Campaign data
   * @returns {Object} Existing or newly created campaign
   */
  static async findOrCreate(data) {
    // First try to find by campaign_instance (for exact matches)
    const existingByInstance = await this.findByCampaignInstance(data.campaign_instance);
    if (existingByInstance) {
      return existingByInstance;
    }
    
    // Then try to find by profile_id + campaign_name (for logical deduplication)
    const existingByName = await this.findByProfileAndName(data.profile_id, data.campaign_name);
    if (existingByName) {
      // Update the existing campaign with the new campaign_instance and started_at
      return await this.update(existingByName.id, {
        campaign_instance: data.campaign_instance,
        started_at: data.started_at
      });
    }
    
    return await this.create(data);
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
