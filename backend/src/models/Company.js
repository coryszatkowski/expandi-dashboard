/**
 * Company Model
 * 
 * Represents ORION's clients. Each company has:
 * - One or more LinkedIn accounts assigned to it
 * - A unique shareable dashboard URL (via share_token)
 */

const { v4: uuidv4 } = require('uuid');
const { getDatabase } = require('../config/database');

class Company {
  /**
   * Create a new company
   * @param {string} name - Company name (must be unique)
   * @returns {Object} Created company object
   */
  static create(name) {
    const db = getDatabase();
    const id = uuidv4();
    const shareToken = uuidv4();
    const now = new Date().toISOString();

    const stmt = db.prepare(`
      INSERT INTO companies (id, name, share_token, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(id, name, shareToken, now, now);

    return this.findById(id);
  }

  /**
   * Find company by ID
   * @param {string} id - Company UUID
   * @returns {Object|null} Company object or null if not found
   */
  static findById(id) {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM companies WHERE id = ?');
    return stmt.get(id);
  }

  /**
   * Find company by share token (for public dashboard access)
   * @param {string} shareToken - Share token UUID
   * @returns {Object|null} Company object or null if not found
   */
  static findByShareToken(shareToken) {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM companies WHERE share_token = ?');
    return stmt.get(shareToken);
  }

  /**
   * Find company by name
   * @param {string} name - Company name
   * @returns {Object|null} Company object or null if not found
   */
  static findByName(name) {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM companies WHERE name = ?');
    return stmt.get(name);
  }

  /**
   * Get all companies with their statistics
   * @returns {Array} Array of company objects with stats
   */
  static findAll() {
    const db = getDatabase();
    
    // Get all companies
    const companies = db.prepare('SELECT * FROM companies ORDER BY name').all();

    // Add statistics for each company
    return companies.map(company => {
      // Count profiles
      const profilesStmt = db.prepare(`
        SELECT COUNT(*) as count 
        FROM profiles 
        WHERE company_id = ?
      `);
      const profilesResult = profilesStmt.get(company.id);

      // Count campaigns
      const campaignsStmt = db.prepare(`
        SELECT COUNT(*) as count 
        FROM campaigns c
        JOIN profiles p ON c.profile_id = p.id
        WHERE p.company_id = ?
      `);
      const campaignsResult = campaignsStmt.get(company.id);

      return {
        ...company,
        profiles_count: profilesResult.count,
        campaigns_count: campaignsResult.count
      };
    });
  }

  /**
   * Update company
   * @param {string} id - Company UUID
   * @param {Object} data - Data to update
   * @returns {Object} Updated company object
   */
  static update(id, data) {
    const db = getDatabase();
    const now = new Date().toISOString();

    const updateFields = [];
    const values = [];

    if (data.name !== undefined) {
      updateFields.push('name = ?');
      values.push(data.name);
    }

    updateFields.push('updated_at = ?');
    values.push(now);
    values.push(id);

    const stmt = db.prepare(`
      UPDATE companies 
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `);

    stmt.run(...values);

    return this.findById(id);
  }

  /**
   * Delete company
   * @param {string} id - Company UUID
   * @returns {boolean} True if deleted, false if not found
   */
  static delete(id) {
    const db = getDatabase();
    
    // NOTE: Deleting a company will set company_id to NULL for all associated LinkedIn accounts
    // (due to ON DELETE SET NULL in the schema)
    const stmt = db.prepare('DELETE FROM companies WHERE id = ?');
    const result = stmt.run(id);

    return result.changes > 0;
  }

  /**
   * Regenerate share token for a company
   * @param {string} id - Company UUID
   * @returns {Object} Updated company with new share token
   */
  static regenerateShareToken(id) {
    const db = getDatabase();
    const shareToken = uuidv4();
    const now = new Date().toISOString();

    const stmt = db.prepare(`
      UPDATE companies 
      SET share_token = ?, updated_at = ?
      WHERE id = ?
    `);

    stmt.run(shareToken, now, id);

    return this.findById(id);
  }
}

module.exports = Company;
