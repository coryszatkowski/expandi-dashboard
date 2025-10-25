/**
 * Database Configuration
 * 
 * This file handles database connection and initialization for both SQLite (local) 
 * and PostgreSQL (production).
 * 
 * For MVP, we use SQLite for simplicity. The schema is designed to be easily 
 * portable to PostgreSQL when deploying to Railway.
 */

const Database = require('better-sqlite3');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.DATABASE_URL || path.join(__dirname, '../../database/dev.db');
const isPostgreSQL = DB_PATH.startsWith('postgres://') || DB_PATH.startsWith('postgresql://');

let db;
let pool;

/**
 * Initialize database connection
 * @returns {Database|Pool} Database instance
 */
function initializeDatabase() {
  if (isPostgreSQL) {
    console.log('🐘 Connecting to PostgreSQL...');
    pool = new Pool({
      connectionString: DB_PATH,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    
    // Test connection
    pool.query('SELECT NOW()', async (err) => {
      if (err) {
        console.error('❌ PostgreSQL connection failed:', err);
        throw err;
      }
      console.log('✅ PostgreSQL connected');
      await initializePostgreSQLSchema();
    });
    
    return pool;
  }
  
  // SQLite for local development
  const dbDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  
  db = new Database(DB_PATH);
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');
  
  console.log(`✅ SQLite database connected: ${DB_PATH}`);
  initializeSchema();
  
  return db;
}

/**
 * Check if PostgreSQL schema already exists
 */
async function checkSchemaExists() {
  try {
    const result = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'companies'
      );
    `);
    return result.rows[0].exists;
  } catch (error) {
    console.log('Schema check failed, assuming schema needs initialization');
    return false;
  }
}

/**
 * Initialize PostgreSQL schema from schema.sql file
 */
async function initializePostgreSQLSchema() {
  try {
    // Check if schema already exists
    const schemaExists = await checkSchemaExists();
    if (schemaExists) {
      console.log('✅ PostgreSQL schema already exists, skipping initialization');
      return;
    }

    console.log('🔧 Initializing PostgreSQL schema...');
    
    const schemaPath = path.join(__dirname, '../../database/schema.sql');
    if (!fs.existsSync(schemaPath)) {
      throw new Error(`Schema file not found: ${schemaPath}`);
    }
    
    let schema = fs.readFileSync(schemaPath, 'utf8');
    
    // Convert SQLite schema to PostgreSQL with proper type handling
    schema = schema
      // First, convert primary keys
      .replace(/TEXT PRIMARY KEY/g, 'UUID PRIMARY KEY')
      .replace(/INTEGER PRIMARY KEY/g, 'BIGINT PRIMARY KEY')
      
      // Convert foreign key columns to UUID (must be done before general TEXT conversion)
      .replace(/company_id TEXT/g, 'company_id UUID')
      .replace(/profile_id TEXT/g, 'profile_id UUID')
      .replace(/campaign_id TEXT/g, 'campaign_id UUID')
      
      // Convert other specific UUID fields (id columns that aren't PRIMARY KEY)
      .replace(/share_token TEXT/g, 'share_token UUID')
      .replace(/webhook_id TEXT/g, 'webhook_id UUID')
      
      // Now convert remaining TEXT fields to VARCHAR
      .replace(/TEXT NOT NULL/g, 'VARCHAR(255) NOT NULL')
      .replace(/TEXT,/g, 'VARCHAR(255),')
      .replace(/TEXT\)/g, 'VARCHAR(255))')
      
      // Convert INTEGER to BIGINT
      .replace(/INTEGER/g, 'BIGINT')
      
      // Convert datetime functions
      .replace(/datetime\('now'\)/g, 'NOW()');
    
    // Execute schema with proper error handling
    await pool.query(schema);
    console.log('✅ PostgreSQL schema initialized');
    
  } catch (err) {
    // Check if it's a "already exists" error (which is OK)
    if (err.message.includes('already exists') || 
        err.code === '23505' || 
        err.message.includes('duplicate key') ||
        err.message.includes('pg_type_typname_nsp_index')) {
      console.log('✅ PostgreSQL schema already exists, skipping initialization');
    } else {
      console.error('❌ Error initializing PostgreSQL schema:', err);
      throw err;
    }
  }
}

/**
 * Initialize database schema from schema.sql file
 */
function initializeSchema() {
  const schemaPath = path.join(__dirname, '../../database/schema.sql');
  
  if (!fs.existsSync(schemaPath)) {
    throw new Error(`Schema file not found: ${schemaPath}`);
  }

  const schema = fs.readFileSync(schemaPath, 'utf8');
  
  // Split by semicolons and execute each statement
  const statements = schema
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  statements.forEach(statement => {
    try {
      db.exec(statement);
    } catch (error) {
      console.error('Error executing schema statement:', statement);
      throw error;
    }
  });

  console.log('✅ Database schema initialized');
}

/**
 * Get database instance
 * @returns {Database|Pool} Database instance
 */
function getDatabase() {
  if (isPostgreSQL) {
    if (!pool) {
      return initializeDatabase();
    }
    return pool;
  } else {
    if (!db) {
      return initializeDatabase();
    }
    return db;
  }
}

/**
 * Close database connection
 */
function closeDatabase() {
  if (isPostgreSQL && pool) {
    pool.end();
    console.log('✅ PostgreSQL connection closed');
  } else if (db) {
    db.close();
    console.log('✅ SQLite connection closed');
  }
}

module.exports = {
  initializeDatabase,
  getDatabase,
  closeDatabase
};
