/**
 * Company Model
 * 
 * Represents ORION's clients. Each company has:
 * - One or more LinkedIn accounts assigned to it
 * - A unique shareable dashboard URL (via share_token)
 */

const { v4: uuidv4 } = require('uuid');
const db = require('../utils/databaseHelper');

class Company {
  /**
   * Create a new company
   * @param {string} name - Company name (must be unique)
   * @returns {Object} Created company object
   */
  static async create(name) {
    const id = uuidv4();
    const shareToken = uuidv4();
    const now = new Date().toISOString();

    await db.execute(`
      INSERT INTO companies (id, name, share_token, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `, [id, name, shareToken, now, now]);

    return await this.findById(id);
  }

  /**
   * Find company by ID
   * @param {string} id - Company UUID
   * @returns {Object|null} Company object or null if not found
   */
  static async findById(id) {
    return await db.selectOne('SELECT * FROM companies WHERE id = ?', [id]);
  }

  /**
   * Find company by share token (for public dashboard access)
   * @param {string} shareToken - Share token UUID
   * @returns {Object|null} Company object or null if not found
   */
  static async findByShareToken(shareToken) {
    return await db.selectOne('SELECT * FROM companies WHERE share_token = ?', [shareToken]);
  }

  /**
   * Find company by name
   * @param {string} name - Company name
   * @returns {Object|null} Company object or null if not found
   */
  static async findByName(name) {
    return await db.selectOne('SELECT * FROM companies WHERE name = ?', [name]);
  }

  /**
   * Get all companies with their statistics
   * @returns {Array} Array of company objects with stats
   */
  static async findAll() {
    // Get all companies
    const companies = await db.selectAll('SELECT * FROM companies ORDER BY name');

    // Add statistics for each company
    const companiesWithStats = [];
    for (const company of companies) {
      // Count profiles
      const profilesResult = await db.selectOne(`
        SELECT COUNT(*) as count 
        FROM profiles 
        WHERE company_id = ?
      `, [company.id]);

      // Count campaigns
      const campaignsResult = await db.selectOne(`
        SELECT COUNT(*) as count 
        FROM campaigns c
        JOIN profiles p ON c.profile_id = p.id
        WHERE p.company_id = ?
      `, [company.id]);

      companiesWithStats.push({
        ...company,
        profiles_count: profilesResult.count,
        campaigns_count: campaignsResult.count
      });
    }

    return companiesWithStats;
  }

  /**
   * Update company
   * @param {string} id - Company UUID
   * @param {Object} data - Data to update
   * @returns {Object} Updated company object
   */
  static async update(id, data) {
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

    await db.execute(`
      UPDATE companies 
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `, values);

    return await this.findById(id);
  }

  /**
   * Delete company
   * @param {string} id - Company UUID
   * @returns {boolean} True if deleted, false if not found
   */
  static async delete(id) {
    // NOTE: Deleting a company will set company_id to NULL for all associated LinkedIn accounts
    // (due to ON DELETE SET NULL in the schema)
    const result = await db.execute('DELETE FROM companies WHERE id = ?', [id]);

    return result.changes > 0;
  }

  /**
   * Regenerate share token for a company
   * @param {string} id - Company UUID
   * @returns {Object} Updated company with new share token
   */
  static async regenerateShareToken(id) {
    const shareToken = uuidv4();
    const now = new Date().toISOString();

    await db.execute(`
      UPDATE companies 
      SET share_token = ?, updated_at = ?
      WHERE id = ?
    `, [shareToken, now, id]);

    return await this.findById(id);
  }
}

module.exports = Company;
