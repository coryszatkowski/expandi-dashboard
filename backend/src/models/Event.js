/**
 * Event Model
 * 
 * Represents webhook events from Expandi (invites, connections, replies).
 * Events are linked to campaigns and contacts.
 */

const { v4: uuidv4 } = require('uuid');
const db = require('../utils/databaseHelper');

class Event {
  /**
   * Create a new event
   * @param {Object} data - Event data
   * @param {string} data.campaign_id - Campaign UUID
   * @param {number} data.contact_id - Expandi contact ID
   * @param {string} data.event_type - 'invite_sent', 'connection_accepted', 'contact_replied'
   * @param {Object} data.event_data - Raw webhook payload (will be JSON stringified)
   * @param {string} [data.invited_at] - ISO 8601 timestamp
   * @param {string} [data.connected_at] - ISO 8601 timestamp
   * @param {string} [data.replied_at] - ISO 8601 timestamp
   * @param {string} [data.conversation_status] - Latest conversation status
   * @returns {Object} Created event object
   */
  static async create(data) {
    const id = uuidv4();
    const now = new Date().toISOString();

    await db.execute(`
      INSERT INTO events (
        id, campaign_id, contact_id, event_type, event_data, 
        invited_at, connected_at, replied_at, conversation_status, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      data.campaign_id,
      data.contact_id,
      data.event_type,
      JSON.stringify(data.event_data),
      data.invited_at || null,
      data.connected_at || null,
      data.replied_at || null,
      data.conversation_status || null,
      now
    ]);

    return await this.findById(id);
  }

  /**
   * Find event by ID
   * @param {string} id - Event UUID
   * @returns {Object|null} Event object or null if not found
   */
  static async findById(id) {
    const event = await db.selectOne('SELECT * FROM events WHERE id = ?', [id]);
    
    if (event && event.event_data) {
      event.event_data = JSON.parse(event.event_data);
    }
    
    return event;
  }

  /**
   * Find latest event for a contact in a campaign
   * @param {string} campaignId - Campaign UUID
   * @param {number} contactId - Contact ID
   * @returns {Object|null} Latest event or null if not found
   */
  static async findLatestForContact(campaignId, contactId) {
    const event = await db.selectOne(`
      SELECT * FROM events 
      WHERE campaign_id = ? AND contact_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `, [campaignId, contactId]);
    
    if (event && event.event_data) {
      event.event_data = JSON.parse(event.event_data);
    }
    
    return event;
  }

  /**
   * Get all events for a campaign
   * @param {string} campaignId - Campaign UUID
   * @param {Object} options - Query options
   * @param {string} [options.event_type] - Filter by event type
   * @param {number} [options.limit] - Limit number of results
   * @returns {Array} Array of event objects
   */
  static async findByCampaign(campaignId, options = {}) {
    let query = 'SELECT * FROM events WHERE campaign_id = ?';
    const params = [campaignId];
    
    if (options.event_type) {
      query += ' AND event_type = ?';
      params.push(options.event_type);
    }
    
    query += ' ORDER BY created_at DESC';
    
    if (options.limit) {
      query += ' LIMIT ?';
      params.push(options.limit);
    }
    
    const events = await db.selectAll(query, params);
    
    // Parse JSON event_data
    return events.map(event => ({
      ...event,
      event_data: event.event_data ? JSON.parse(event.event_data) : null
    }));
  }

  /**
   * Find event by contact, campaign, and event type
   * @param {string} campaignId - Campaign UUID
   * @param {number} contactId - Contact ID
   * @param {string} eventType - Event type
   * @returns {Object|null} Event object or null if not found
   */
  static async findByContactCampaignAndType(campaignId, contactId, eventType) {
    const event = await db.selectOne(`
      SELECT * FROM events 
      WHERE campaign_id = ? AND contact_id = ? AND event_type = ?
      ORDER BY created_at DESC
      LIMIT 1
    `, [campaignId, contactId, eventType]);
    
    if (!event) {
      return null;
    }
    
    return {
      ...event,
      event_data: event.event_data ? JSON.parse(event.event_data) : null
    };
  }

  /**
   * Update event (typically to add timestamps as campaign progresses)
   * @param {string} id - Event UUID
   * @param {Object} data - Data to update
   * @returns {Object} Updated event object
   */
  static async update(id, data) {
    const updateFields = [];
    const values = [];

    if (data.event_type !== undefined) {
      updateFields.push('event_type = ?');
      values.push(data.event_type);
    }

    if (data.invited_at !== undefined) {
      updateFields.push('invited_at = ?');
      values.push(data.invited_at);
    }

    if (data.connected_at !== undefined) {
      updateFields.push('connected_at = ?');
      values.push(data.connected_at);
    }

    if (data.replied_at !== undefined) {
      updateFields.push('replied_at = ?');
      values.push(data.replied_at);
    }

    if (data.conversation_status !== undefined) {
      updateFields.push('conversation_status = ?');
      values.push(data.conversation_status);
    }

    if (updateFields.length === 0) {
      return await this.findById(id);
    }

    values.push(id);

    await db.execute(`
      UPDATE events 
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `, values);

    return await this.findById(id);
  }


  /**
   * Delete event
   * @param {string} id - Event UUID
   * @returns {boolean} True if deleted, false if not found
   */
  static async delete(id) {
    const result = await db.execute('DELETE FROM events WHERE id = ?', [id]);
    return result.changes > 0;
  }

  /**
   * Get event counts for a campaign (for KPI calculations)
   * @param {string} campaignId - Campaign UUID
   * @param {Object} options - Optional filters
   * @param {string} [options.start_date] - ISO 8601 date string
   * @param {string} [options.end_date] - ISO 8601 date string
   * @returns {Object} Event counts by type
   */
  static async getCountsByCampaign(campaignId, options = {}) {
    let whereClause = 'WHERE campaign_id = ?';
    const params = [campaignId];
    
    if (options.start_date) {
      whereClause += ' AND (invited_at >= ? OR connected_at >= ? OR replied_at >= ?)';
      params.push(options.start_date, options.start_date, options.start_date);
    }
    
    if (options.end_date) {
      whereClause += ' AND (invited_at <= ? OR connected_at <= ? OR replied_at <= ?)';
      params.push(options.end_date, options.end_date, options.end_date);
    }

    return await db.selectOne(`
      SELECT 
        COUNT(DISTINCT CASE WHEN invited_at IS NOT NULL THEN contact_id END) as invites_sent,
        COUNT(DISTINCT CASE WHEN connected_at IS NOT NULL THEN contact_id END) as connections,
        COUNT(DISTINCT CASE WHEN replied_at IS NOT NULL THEN contact_id END) as replies
      FROM events
      ${whereClause}
    `, params);
  }
}

module.exports = Event;
