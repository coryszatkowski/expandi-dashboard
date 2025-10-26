/**
 * Error Notification Model
 * 
 * Stores error notifications for admin dashboard.
 * Provides methods for creating, retrieving, and managing error notifications.
 */

const { v4: uuidv4 } = require('uuid');
const db = require('../utils/databaseHelper');

class ErrorNotification {
  /**
   * Create a new error notification
   * @param {Object} data - Notification data
   * @param {string} data.notification_type - Type of notification (webhook_failed, system_error)
   * @param {string} data.message - Human-readable message
   * @param {string} [data.webhook_id] - Associated webhook ID
   * @param {string} [data.correlation_id] - Correlation ID for tracing
   * @param {string} [data.severity] - Severity level (critical, error, warning)
   * @returns {Object} Created notification record
   */
  static async create(data) {
    const id = uuidv4();
    const now = new Date().toISOString();

    await db.execute(`
      INSERT INTO error_notifications (
        id, notification_type, message, webhook_id, correlation_id, severity, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      data.notification_type,
      data.message,
      data.webhook_id || null,
      data.correlation_id || null,
      data.severity || 'error',
      now
    ]);

    return await this.findById(id);
  }

  /**
   * Find notification by ID
   * @param {string} id - Notification ID
   * @returns {Object|null} Notification record or null if not found
   */
  static async findById(id) {
    return await db.selectOne(`
      SELECT * FROM error_notifications WHERE id = ?
    `, [id]);
  }

  /**
   * Get unresolved notifications for admin dashboard
   * @param {number} limit - Maximum number of notifications to return (default: 20)
   * @returns {Array} Array of unresolved notification records
   */
  static async getUnresolvedNotifications(limit = 20) {
    return await db.selectAll(`
      SELECT * FROM error_notifications 
      WHERE resolved = FALSE 
      ORDER BY created_at DESC 
      LIMIT ?
    `, [limit]);
  }

  /**
   * Get unresolved notification count for badge
   * @returns {number} Count of unresolved notifications
   */
  static async getUnresolvedCount() {
    const result = await db.selectOne(`
      SELECT COUNT(*) as count 
      FROM error_notifications 
      WHERE resolved = FALSE
    `);
    
    return result?.count || 0;
  }

  /**
   * Get notifications by severity
   * @param {string} severity - Severity level (critical, error, warning)
   * @param {number} limit - Maximum number of notifications to return (default: 20)
   * @returns {Array} Array of notification records
   */
  static async getBySeverity(severity, limit = 20) {
    return await db.selectAll(`
      SELECT * FROM error_notifications 
      WHERE severity = ? AND resolved = FALSE
      ORDER BY created_at DESC 
      LIMIT ?
    `, [severity, limit]);
  }

  /**
   * Mark notification as resolved
   * @param {string} id - Notification ID
   * @returns {boolean} True if updated, false if not found
   */
  static async resolve(id) {
    const result = await db.execute(`
      UPDATE error_notifications 
      SET resolved = TRUE 
      WHERE id = ?
    `, [id]);
    
    return result.changes > 0;
  }

  /**
   * Mark multiple notifications as resolved
   * @param {Array} ids - Array of notification IDs
   * @returns {number} Number of notifications resolved
   */
  static async resolveMultiple(ids) {
    if (ids.length === 0) return 0;
    
    const placeholders = ids.map(() => '?').join(',');
    const result = await db.execute(`
      UPDATE error_notifications 
      SET resolved = TRUE 
      WHERE id IN (${placeholders})
    `, ids);
    
    return result.changes;
  }

  /**
   * Get notification statistics for dashboard
   * @returns {Object} Notification statistics
   */
  static async getStats() {
    const stats = await db.selectOne(`
      SELECT 
        COUNT(*) as total_notifications,
        COUNT(CASE WHEN resolved = FALSE THEN 1 END) as unresolved_count,
        COUNT(CASE WHEN severity = 'critical' AND resolved = FALSE THEN 1 END) as critical_unresolved,
        COUNT(CASE WHEN severity = 'error' AND resolved = FALSE THEN 1 END) as error_unresolved,
        COUNT(CASE WHEN severity = 'warning' AND resolved = FALSE THEN 1 END) as warning_unresolved,
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '24 hours' THEN 1 END) as notifications_last_24h,
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as notifications_last_7d
      FROM error_notifications
    `);
    
    return stats || {};
  }

  /**
   * Get notifications by webhook ID
   * @param {string} webhookId - Webhook ID
   * @returns {Array} Array of notification records for this webhook
   */
  static async getByWebhookId(webhookId) {
    return await db.selectAll(`
      SELECT * FROM error_notifications 
      WHERE webhook_id = ? 
      ORDER BY created_at DESC
    `, [webhookId]);
  }

  /**
   * Get notifications by correlation ID
   * @param {string} correlationId - Correlation ID
   * @returns {Array} Array of notification records for this correlation
   */
  static async getByCorrelationId(correlationId) {
    return await db.selectAll(`
      SELECT * FROM error_notifications 
      WHERE correlation_id = ? 
      ORDER BY created_at DESC
    `, [correlationId]);
  }

  /**
   * Clean up old resolved notifications (optional maintenance)
   * @param {number} daysOld - Delete resolved notifications older than this many days
   * @returns {number} Number of notifications deleted
   */
  static async cleanupOldResolved(daysOld = 30) {
    const result = await db.execute(`
      DELETE FROM error_notifications 
      WHERE resolved = TRUE AND created_at < NOW() - INTERVAL '${daysOld} days'
    `);
    
    console.log(`🧹 Cleaned up ${result.changes} old resolved notifications`);
    return result.changes;
  }

  /**
   * Get recent notifications (last 24 hours)
   * @param {number} limit - Maximum number of notifications to return (default: 50)
   * @returns {Array} Array of recent notification records
   */
  static async getRecentNotifications(limit = 50) {
    return await db.selectAll(`
      SELECT * FROM error_notifications 
      WHERE created_at >= NOW() - INTERVAL '24 hours'
      ORDER BY created_at DESC 
      LIMIT ?
    `, [limit]);
  }
}

module.exports = ErrorNotification;
