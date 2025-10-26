/**
 * Failed Webhook Archive Model
 * 
 * Stores webhooks that failed processing after retries.
 * Provides methods for archiving, retrieving, and managing failed webhooks.
 */

const { v4: uuidv4 } = require('uuid');
const db = require('../utils/databaseHelper');

class FailedWebhookArchive {
  /**
   * Archive a failed webhook
   * @param {Object} data - Failed webhook data
   * @param {string} data.webhook_id - Webhook ID from URL
   * @param {Object} data.raw_payload - Full webhook payload
   * @param {string} data.error_message - Error message
   * @param {number} data.retry_count - Number of retry attempts
   * @param {number} [data.contact_id] - Contact ID (if extractable)
   * @param {string} [data.campaign_instance] - Campaign instance (if extractable)
   * @param {string} [data.correlation_id] - Correlation ID for tracing
   * @param {string} [data.severity] - Error severity (critical, error, warning)
   * @returns {Object} Created failed webhook archive record
   */
  static async create(data) {
    const id = uuidv4();
    const now = new Date().toISOString();
    
    // Check payload size (50KB limit)
    const payloadString = JSON.stringify(data.raw_payload);
    if (payloadString.length > 50000) {
      throw new Error(`Webhook payload too large: ${payloadString.length} bytes (max 50KB)`);
    }

    await db.execute(`
      INSERT INTO failed_webhook_archive (
        id, webhook_id, raw_payload, error_message, retry_count,
        contact_id, campaign_instance, correlation_id, severity, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      data.webhook_id,
      payloadString,
      data.error_message,
      data.retry_count,
      data.contact_id || null,
      data.campaign_instance || null,
      data.correlation_id || null,
      data.severity || 'error',
      now
    ]);

    return await this.findById(id);
  }

  /**
   * Find archived webhook by ID
   * @param {string} id - Archive record ID
   * @returns {Object|null} Archived webhook record or null if not found
   */
  static async findById(id) {
    const result = await db.selectOne(`
      SELECT * FROM failed_webhook_archive WHERE id = ?
    `, [id]);
    
    if (result && result.raw_payload) {
      result.raw_payload = JSON.parse(result.raw_payload);
    }
    
    return result;
  }

  /**
   * Find archived webhook by webhook ID
   * @param {string} webhookId - Webhook ID
   * @returns {Object|null} Latest archived webhook record or null if not found
   */
  static async findByWebhookId(webhookId) {
    const result = await db.selectOne(`
      SELECT * FROM failed_webhook_archive 
      WHERE webhook_id = ? 
      ORDER BY created_at DESC 
      LIMIT 1
    `, [webhookId]);
    
    if (result && result.raw_payload) {
      result.raw_payload = JSON.parse(result.raw_payload);
    }
    
    return result;
  }

  /**
   * Get archived webhooks for admin review
   * @param {number} limit - Number of records to return (default: 50)
   * @param {number} offset - Number of records to skip (default: 0)
   * @returns {Array} Array of archived webhook records
   */
  static async getArchivedWebhooks(limit = 50, offset = 0) {
    const results = await db.selectAll(`
      SELECT * FROM failed_webhook_archive 
      ORDER BY failed_at DESC 
      LIMIT ? OFFSET ?
    `, [limit, offset]);
    
    // Parse JSON payloads
    return results.map(result => ({
      ...result,
      raw_payload: result.raw_payload ? JSON.parse(result.raw_payload) : null
    }));
  }

  /**
   * Get archived webhooks by severity
   * @param {string} severity - Severity level (critical, error, warning)
   * @param {number} limit - Number of records to return (default: 50)
   * @returns {Array} Array of archived webhook records
   */
  static async getBySeverity(severity, limit = 50) {
    const results = await db.selectAll(`
      SELECT * FROM failed_webhook_archive 
      WHERE severity = ?
      ORDER BY failed_at DESC 
      LIMIT ?
    `, [severity, limit]);
    
    // Parse JSON payloads
    return results.map(result => ({
      ...result,
      raw_payload: result.raw_payload ? JSON.parse(result.raw_payload) : null
    }));
  }

  /**
   * Delete archived webhook (after successful manual processing)
   * @param {string} id - Archive record ID
   * @returns {boolean} True if deleted, false if not found
   */
  static async delete(id) {
    const result = await db.execute(`
      DELETE FROM failed_webhook_archive WHERE id = ?
    `, [id]);
    
    return result.changes > 0;
  }

  /**
   * Get statistics for dashboard
   * @returns {Object} Archive statistics
   */
  static async getStats() {
    const stats = await db.selectOne(`
      SELECT 
        COUNT(*) as total_failed,
        COUNT(CASE WHEN failed_at >= NOW() - INTERVAL '24 hours' THEN 1 END) as failed_last_24h,
        COUNT(CASE WHEN failed_at >= NOW() - INTERVAL '7 days' THEN 1 END) as failed_last_7d,
        COUNT(CASE WHEN severity = 'critical' THEN 1 END) as critical_count,
        COUNT(CASE WHEN severity = 'error' THEN 1 END) as error_count,
        COUNT(CASE WHEN severity = 'warning' THEN 1 END) as warning_count
      FROM failed_webhook_archive
    `);
    
    return stats || {};
  }

  /**
   * Get archived webhooks for a specific webhook ID
   * @param {string} webhookId - Webhook ID
   * @returns {Array} Array of all archived webhooks for this webhook ID
   */
  static async getAllByWebhookId(webhookId) {
    const results = await db.selectAll(`
      SELECT * FROM failed_webhook_archive 
      WHERE webhook_id = ? 
      ORDER BY created_at DESC
    `, [webhookId]);
    
    // Parse JSON payloads
    return results.map(result => ({
      ...result,
      raw_payload: result.raw_payload ? JSON.parse(result.raw_payload) : null
    }));
  }

  /**
   * Clean up old archived webhooks (optional maintenance)
   * @param {number} daysOld - Delete records older than this many days
   * @returns {number} Number of records deleted
   */
  static async cleanupOldRecords(daysOld = 30) {
    const result = await db.execute(`
      DELETE FROM failed_webhook_archive 
      WHERE created_at < NOW() - INTERVAL '${daysOld} days'
    `);
    
    console.log(`🧹 Cleaned up ${result.changes} old archived webhook records`);
    return result.changes;
  }
}

module.exports = FailedWebhookArchive;
