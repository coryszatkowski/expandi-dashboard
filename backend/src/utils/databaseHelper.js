/**
 * Database Helper
 * 
 * Provides a unified interface for database operations that works with both
 * SQLite and PostgreSQL. Abstracts the differences between the two databases.
 */

const { getDatabase } = require('../config/database');

class DatabaseHelper {
  constructor() {
    this.db = getDatabase();
    this.isPostgreSQL = process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('postgres');
  }

  /**
   * Execute a SELECT query and return all results
   * @param {string} query - SQL query with ? placeholders
   * @param {Array} params - Query parameters
   * @returns {Array} Array of result objects
   */
  async selectAll(query, params = []) {
    if (this.isPostgreSQL) {
      // Convert ? placeholders to $1, $2, etc.
      const pgQuery = this.convertToPostgreSQL(query);
      const result = await this.db.query(pgQuery, params);
      return result.rows;
    } else {
      // SQLite
      const stmt = this.db.prepare(query);
      return stmt.all(...params);
    }
  }

  /**
   * Execute a SELECT query and return the first result
   * @param {string} query - SQL query with ? placeholders
   * @param {Array} params - Query parameters
   * @returns {Object|null} First result object or null
   */
  async selectOne(query, params = []) {
    if (this.isPostgreSQL) {
      // Convert ? placeholders to $1, $2, etc.
      const pgQuery = this.convertToPostgreSQL(query);
      const result = await this.db.query(pgQuery, params);
      return result.rows[0] || null;
    } else {
      // SQLite
      const stmt = this.db.prepare(query);
      return stmt.get(...params);
    }
  }

  /**
   * Execute an INSERT, UPDATE, or DELETE query
   * @param {string} query - SQL query with ? placeholders
   * @param {Array} params - Query parameters
   * @returns {Object} Result object with changes/affected rows
   */
  async execute(query, params = []) {
    if (this.isPostgreSQL) {
      // Convert ? placeholders to $1, $2, etc.
      const pgQuery = this.convertToPostgreSQL(query);
      const result = await this.db.query(pgQuery, params);
      return {
        changes: result.rowCount || 0,
        lastInsertRowid: result.rows[0]?.id || null
      };
    } else {
      // SQLite
      const stmt = this.db.prepare(query);
      const result = stmt.run(...params);
      return {
        changes: result.changes,
        lastInsertRowid: result.lastInsertRowid
      };
    }
  }

  /**
   * Execute a transaction with multiple queries
   * @param {Array} queries - Array of {query, params} objects
   * @returns {Array} Array of results
   */
  async transaction(queries) {
    if (this.isPostgreSQL) {
      // PostgreSQL transactions
      const client = await this.db.connect();
      try {
        await client.query('BEGIN');
        const results = [];
        
        for (const { query, params } of queries) {
          const pgQuery = this.convertToPostgreSQL(query);
          const result = await client.query(pgQuery, params);
          results.push(result);
        }
        
        await client.query('COMMIT');
        return results;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } else {
      // SQLite transactions
      const transaction = this.db.transaction((queries) => {
        const results = [];
        for (const { query, params } of queries) {
          const stmt = this.db.prepare(query);
          const result = stmt.run(...params);
          results.push(result);
        }
        return results;
      });
      
      return transaction(queries);
    }
  }

  /**
   * Convert SQLite query with ? placeholders to PostgreSQL with $1, $2, etc.
   * @param {string} query - SQLite query with ? placeholders
   * @returns {string} PostgreSQL query with $1, $2, etc.
   */
  convertToPostgreSQL(query) {
    let paramIndex = 1;
    return query.replace(/\?/g, () => `$${paramIndex++}`);
  }

  /**
   * Build a WHERE clause for date filtering
   * @param {Object} options - Filter options
   * @param {string} [options.start_date] - Start date (ISO 8601)
   * @param {string} [options.end_date] - End date (ISO 8601)
   * @param {string} [options.dateColumn] - Column name to filter on (default: 'created_at')
   * @returns {Object} {whereClause, params}
   */
  buildDateFilter(options, dateColumn = 'created_at') {
    const { start_date, end_date } = options;
    
    if (!start_date && !end_date) {
      return { whereClause: '', params: [] };
    }

    const conditions = [];
    const params = [];

    if (start_date) {
      conditions.push(`${dateColumn} >= ?`);
      params.push(start_date);
    }

    if (end_date) {
      conditions.push(`${dateColumn} <= ?`);
      params.push(end_date);
    }

    return {
      whereClause: ` AND ${conditions.join(' AND ')}`,
      params
    };
  }

  /**
   * Build an IN clause for multiple values
   * @param {Array} values - Array of values
   * @returns {Object} {inClause, params}
   */
  buildInClause(values) {
    if (values.length === 0) {
      return { inClause: 'IN ()', params: [] };
    }

    const placeholders = values.map(() => '?').join(', ');
    return {
      inClause: `IN (${placeholders})`,
      params: values
    };
  }
}

// Export a singleton instance
module.exports = new DatabaseHelper();
