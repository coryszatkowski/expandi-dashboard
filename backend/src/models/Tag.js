const db = require('../utils/databaseHelper');
const { v4: uuidv4 } = require('uuid');

class Tag {
  /**
   * Find or create a tag by name
   * @param {string} name - Tag name
   * @returns {Object} Tag object
   */
  static async findOrCreate(name) {
    // Try to find existing tag
    let tag = await db.selectOne('SELECT * FROM tags WHERE name = ?', [name]);
    
    if (tag) {
      return tag;
    }

    // Create new tag
    const id = uuidv4();
    if (db.isPostgreSQL) {
      await db.execute(
        'INSERT INTO tags (id, name) VALUES ($1, $2)',
        [id, name]
      );
    } else {
      await db.execute(
        'INSERT INTO tags (id, name) VALUES (?, ?)',
        [id, name]
      );
    }

    return { id, name };
  }

  /**
   * Add tag to a campaign
   * @param {string} campaignId - Campaign UUID
   * @param {string} tagName - Tag name
   * @returns {Object} Created association
   */
  static async addToCampaign(campaignId, tagName) {
    const tag = await this.findOrCreate(tagName);
    
    // Check if already tagged
    const existing = await db.selectOne(
      'SELECT * FROM campaign_tags WHERE campaign_id = ? AND tag_id = ?',
      [campaignId, tag.id]
    );

    if (existing) return { campaign_id: campaignId, tag_id: tag.id, tag };

    if (db.isPostgreSQL) {
      await db.execute(
        'INSERT INTO campaign_tags (campaign_id, tag_id) VALUES ($1, $2)',
        [campaignId, tag.id]
      );
    } else {
      await db.execute(
        'INSERT INTO campaign_tags (campaign_id, tag_id) VALUES (?, ?)',
        [campaignId, tag.id]
      );
    }

    return { campaign_id: campaignId, tag_id: tag.id, tag };
  }

  /**
   * Remove tag from a campaign
   * @param {string} campaignId - Campaign UUID
   * @param {string} tagId - Tag UUID
   */
  static async removeFromCampaign(campaignId, tagId) {
    await db.execute(
      'DELETE FROM campaign_tags WHERE campaign_id = ? AND tag_id = ?',
      [campaignId, tagId]
    );
  }

  /**
   * Add tag to a contact
   * @param {number} contactId - Contact ID (integer)
   * @param {string} campaignId - Campaign UUID (scope)
   * @param {string} tagName - Tag name
   * @returns {Object} Created association
   */
  static async addToContact(contactId, campaignId, tagName) {
    const tag = await this.findOrCreate(tagName);
    
    // Check if already tagged
    const existing = await db.selectOne(
      'SELECT * FROM contact_tags WHERE contact_id = ? AND campaign_id = ? AND tag_id = ?',
      [contactId, campaignId, tag.id]
    );

    if (existing) return { contact_id: contactId, campaign_id: campaignId, tag_id: tag.id, tag };

    if (db.isPostgreSQL) {
      await db.execute(
        'INSERT INTO contact_tags (contact_id, campaign_id, tag_id) VALUES ($1, $2, $3)',
        [contactId, campaignId, tag.id]
      );
    } else {
      await db.execute(
        'INSERT INTO contact_tags (contact_id, campaign_id, tag_id) VALUES (?, ?, ?)',
        [contactId, campaignId, tag.id]
      );
    }

    return { contact_id: contactId, campaign_id: campaignId, tag_id: tag.id, tag };
  }

  /**
   * Remove tag from a contact
   * @param {number} contactId - Contact ID
   * @param {string} campaignId - Campaign UUID
   * @param {string} tagId - Tag UUID
   */
  static async removeFromContact(contactId, campaignId, tagId) {
    await db.execute(
      'DELETE FROM contact_tags WHERE contact_id = ? AND campaign_id = ? AND tag_id = ?',
      [contactId, campaignId, tagId]
    );
  }

  /**
   * Get tags for a campaign
   * @param {string} campaignId
   * @returns {Array} Array of tag objects
   */
  static async getForCampaign(campaignId) {
    return await db.selectAll(`
      SELECT t.* 
      FROM tags t
      JOIN campaign_tags ct ON t.id = ct.tag_id
      WHERE ct.campaign_id = ?
      ORDER BY t.name ASC
    `, [campaignId]);
  }

  /**
   * Get tags for a contact
   * @param {number} contactId
   * @param {string} campaignId
   * @returns {Array} Array of tag objects
   */
  static async getForContact(contactId, campaignId) {
    return await db.selectAll(`
      SELECT t.* 
      FROM tags t
      JOIN contact_tags ct ON t.id = ct.tag_id
      WHERE ct.contact_id = ? AND ct.campaign_id = ?
      ORDER BY t.name ASC
    `, [contactId, campaignId]);
  }

  /**
   * Get tags for all contacts in a campaign (Batch fetch)
   * @param {string} campaignId
   * @returns {Object} Map of contact_id -> array of tags
   */
  static async getForContactsInCampaign(campaignId) {
    const rows = await db.selectAll(`
      SELECT ct.contact_id, t.*
      FROM tags t
      JOIN contact_tags ct ON t.id = ct.tag_id
      WHERE ct.campaign_id = ?
      ORDER BY t.name ASC
    `, [campaignId]);

    const tagMap = {};
    for (const row of rows) {
      if (!tagMap[row.contact_id]) {
        tagMap[row.contact_id] = [];
      }
      tagMap[row.contact_id].push({
        id: row.id,
        name: row.name,
        color: row.color // Optional, if we add colors later
      });
    }
    return tagMap;
  }
}

module.exports = Tag;
