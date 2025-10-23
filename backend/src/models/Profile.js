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
const { getDatabase } = require('../config/database');

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
  static create(data) {
    const db = getDatabase();
    const id = uuidv4();
    const webhookId = uuidv4(); // Generate unique webhook_id
    const now = new Date().toISOString();

    const stmt = db.prepare(`
      INSERT INTO profiles (
        id, company_id, account_name, account_email, li_account_id, webhook_id, status, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const status = data.company_id ? 'assigned' : 'unassigned';

    stmt.run(
      id,
      data.company_id || null,
      data.account_name,
      data.account_email || null,
      data.li_account_id || null,
      webhookId,
      status,
      now,
      now
    );

    return this.findById(id);
  }

  /**
   * Find profile by ID
   * @param {string} id - Profile UUID
   * @returns {Object|null} Profile object or null if not found
   */
  static findById(id) {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT p.*, c.name as company_name
      FROM profiles p
      LEFT JOIN companies c ON p.company_id = c.id
      WHERE p.id = ?
    `);
    return stmt.get(id);
  }

  /**
   * Find profile by webhook_id
   * @param {string} webhookId - Webhook ID
   * @returns {Object|null} Profile object or null if not found
   */
  static findByWebhookId(webhookId) {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT p.*, c.name as company_name
      FROM profiles p
      LEFT JOIN companies c ON p.company_id = c.id
      WHERE p.webhook_id = ?
    `);
    return stmt.get(webhookId);
  }

  /**
   * Find profile by Expandi's li_account_id (for reference only)
   * @param {number} liAccountId - Expandi LinkedIn account ID
   * @returns {Object|null} Profile object or null if not found
   */
  static findByLiAccountId(liAccountId) {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT p.*, c.name as company_name
      FROM profiles p
      LEFT JOIN companies c ON p.company_id = c.id
      WHERE p.li_account_id = ?
    `);
    return stmt.get(liAccountId);
  }

  /**
   * Get all profiles with optional filters
   * @param {Object} filters - Optional filters
   * @param {string} [filters.status] - 'assigned' or 'unassigned'
   * @param {string} [filters.company_id] - Filter by company UUID
   * @returns {Array} Array of profile objects
   */
  static findAll(filters = {}) {
    const db = getDatabase();
    
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

    const stmt = db.prepare(query);
    const profiles = stmt.all(...params);

    // Add statistics for each profile
    return profiles.map(profile => {
      // Count campaigns
      const campaignsStmt = db.prepare(`
        SELECT COUNT(*) as count 
        FROM campaigns 
        WHERE profile_id = ?
      `);
      const campaignsResult = campaignsStmt.get(profile.id);

      return {
        ...profile,
        campaigns_count: campaignsResult.count
      };
    });
  }

  /**
   * Get unassigned profiles
   * @returns {Array} Array of unassigned profile objects
   */
  static findUnassigned() {
    return this.findAll({ status: 'unassigned' });
  }

  /**
   * Assign profile to a company
   * @param {string} id - Profile UUID
   * @param {string} companyId - Company UUID
   * @returns {Object} Updated profile object
   */
  static assignToCompany(id, companyId) {
    const db = getDatabase();
    const now = new Date().toISOString();

    const stmt = db.prepare(`
      UPDATE profiles 
      SET company_id = ?, status = 'assigned', updated_at = ?
      WHERE id = ?
    `);

    stmt.run(companyId, now, id);

    return this.findById(id);
  }

  /**
   * Unassign profile from company
   * @param {string} id - Profile UUID
   * @returns {Object} Updated profile object
   */
  static unassign(id) {
    const db = getDatabase();
    const now = new Date().toISOString();

    const stmt = db.prepare(`
      UPDATE profiles 
      SET company_id = NULL, status = 'unassigned', updated_at = ?
      WHERE id = ?
    `);

    stmt.run(now, id);

    return this.findById(id);
  }

  /**
   * Update profile
   * @param {string} id - Profile UUID
   * @param {Object} data - Data to update
   * @returns {Object} Updated profile object
   */
  static update(id, data) {
    const db = getDatabase();
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

    const stmt = db.prepare(`
      UPDATE profiles 
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `);

    stmt.run(...values);

    return this.findById(id);
  }

  /**
   * Delete profile
   * @param {string} id - Profile UUID
   * @returns {boolean} True if deleted, false if not found
   */
  static delete(id) {
    const db = getDatabase();
    
    // NOTE: Deleting a profile will also delete all associated campaigns and events
    // (due to ON DELETE CASCADE in the schema)
    const stmt = db.prepare('DELETE FROM profiles WHERE id = ?');
    const result = stmt.run(id);

    return result.changes > 0;
  }
}

module.exports = Profile;
