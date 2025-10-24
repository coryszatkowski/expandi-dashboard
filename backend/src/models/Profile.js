/**
 * Profile Model
 * 
 * Represents individual profiles that run campaigns.
 * Each profile can be:
 * - Assigned to a company
 * - Unassigned (waiting for admin to assign)
 * - Has a unique webhook_id for webhook URL generation
 */

const { v4: uuidv4 } = require('uuid');
const db = require('../utils/databaseHelper');

class Profile {
  /**
   * Create a new profile
   * @param {Object} data - Profile data
   * @param {string} data.account_name - Profile name
   * @param {string} [data.account_email] - Profile email (optional)
   * @param {string} [data.company_id] - Company UUID (optional, defaults to null/unassigned)
   * @param {number} [data.li_account_id] - Expandi LinkedIn account ID (optional, for reference only)
   * @returns {Object} Created profile object
   */
  static async create(data) {
    const id = uuidv4();
    const webhookId = uuidv4(); // Generate unique webhook_id
    const now = new Date().toISOString();

    const status = data.company_id ? 'assigned' : 'unassigned';

    await db.execute(`
      INSERT INTO profiles (
        id, company_id, account_name, account_email, li_account_id, webhook_id, status, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      data.company_id || null,
      data.account_name,
      data.account_email || null,
      data.li_account_id || null,
      webhookId,
      status,
      now,
      now
    ]);

    return await this.findById(id);
  }

  /**
   * Find profile by ID
   * @param {string} id - Profile UUID
   * @returns {Object|null} Profile object or null if not found
   */
  static async findById(id) {
    return await db.selectOne(`
      SELECT p.*, c.name as company_name
      FROM profiles p
      LEFT JOIN companies c ON p.company_id = c.id
      WHERE p.id = ?
    `, [id]);
  }

  /**
   * Find profile by webhook_id
   * @param {string} webhookId - Webhook ID
   * @returns {Object|null} Profile object or null if not found
   */
  static async findByWebhookId(webhookId) {
    return await db.selectOne(`
      SELECT p.*, c.name as company_name
      FROM profiles p
      LEFT JOIN companies c ON p.company_id = c.id
      WHERE p.webhook_id = ?
    `, [webhookId]);
  }

  /**
   * Find profile by Expandi's li_account_id (for reference only)
   * @param {number} liAccountId - Expandi LinkedIn account ID
   * @returns {Object|null} Profile object or null if not found
   */
  static async findByLiAccountId(liAccountId) {
    return await db.selectOne(`
      SELECT p.*, c.name as company_name
      FROM profiles p
      LEFT JOIN companies c ON p.company_id = c.id
      WHERE p.li_account_id = ?
    `, [liAccountId]);
  }

  /**
   * Get all profiles with optional filters
   * @param {Object} filters - Optional filters
   * @param {string} [filters.status] - 'assigned' or 'unassigned'
   * @param {string} [filters.company_id] - Filter by company UUID
   * @returns {Array} Array of profile objects
   */
  static async findAll(filters = {}) {
    try {
      console.log('Profile.findAll called with filters:', filters);
      
      let query = `
        SELECT p.*, c.name as company_name
        FROM profiles p
        LEFT JOIN companies c ON p.company_id = c.id
        WHERE 1=1
      `;
      const params = [];

      if (filters.status) {
        query += ' AND p.status = ?';
        params.push(filters.status);
      }

      if (filters.company_id) {
        query += ' AND p.company_id = ?';
        params.push(filters.company_id);
      }

      query += ' ORDER BY p.account_name';

      console.log('Executing query:', query, 'with params:', params);
      const profiles = await db.selectAll(query, params);
      console.log('Raw profiles from database:', profiles);

      // Add statistics for each profile
      const profilesWithStats = [];
      for (const profile of profiles) {
        // Count campaigns
        const campaignsResult = await db.selectOne(`
          SELECT COUNT(*) as count 
          FROM campaigns 
          WHERE profile_id = ?
        `, [profile.id]);

        profilesWithStats.push({
          ...profile,
          campaigns_count: campaignsResult.count
        });
      }

      console.log('Final profiles with stats:', profilesWithStats);
      return profilesWithStats;
    } catch (error) {
      console.error('Error in Profile.findAll:', error);
      throw error;
    }
  }

  /**
   * Get unassigned profiles
   * @returns {Array} Array of unassigned profile objects
   */
  static async findUnassigned() {
    return await this.findAll({ status: 'unassigned' });
  }

  /**
   * Assign profile to a company
   * @param {string} id - Profile UUID
   * @param {string} companyId - Company UUID
   * @returns {Object} Updated profile object
   */
  static async assignToCompany(id, companyId) {
    const now = new Date().toISOString();

    await db.execute(`
      UPDATE profiles 
      SET company_id = ?, status = 'assigned', updated_at = ?
      WHERE id = ?
    `, [companyId, now, id]);

    return await this.findById(id);
  }

  /**
   * Unassign profile from company
   * @param {string} id - Profile UUID
   * @returns {Object} Updated profile object
   */
  static async unassign(id) {
    const now = new Date().toISOString();

    await db.execute(`
      UPDATE profiles 
      SET company_id = NULL, status = 'unassigned', updated_at = ?
      WHERE id = ?
    `, [now, id]);

    return await this.findById(id);
  }

  /**
   * Update profile
   * @param {string} id - Profile UUID
   * @param {Object} data - Data to update
   * @returns {Object} Updated profile object
   */
  static async update(id, data) {
    const now = new Date().toISOString();

    const updateFields = [];
    const values = [];

    if (data.account_name !== undefined) {
      updateFields.push('account_name = ?');
      values.push(data.account_name);
    }

    if (data.account_email !== undefined) {
      updateFields.push('account_email = ?');
      values.push(data.account_email);
    }

    if (data.li_account_id !== undefined) {
      updateFields.push('li_account_id = ?');
      values.push(data.li_account_id);
    }

    updateFields.push('updated_at = ?');
    values.push(now);
    values.push(id);

    await db.execute(`
      UPDATE profiles 
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `, values);

    return await this.findById(id);
  }

  /**
   * Delete profile
   * @param {string} id - Profile UUID
   * @returns {boolean} True if deleted, false if not found
   */
  static async delete(id) {
    // NOTE: Deleting a profile will also delete all associated campaigns and events
    // (due to ON DELETE CASCADE in the schema)
    const result = await db.execute('DELETE FROM profiles WHERE id = ?', [id]);

    return result.changes > 0;
  }
}

module.exports = Profile;
