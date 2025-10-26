/**
 * Migration Script: Add Error Handling Tables
 * 
 * This script:
 * 1. Adds error handling tables (failed_webhook_archive, error_notifications)
 * 2. Adds linked_to_contact_id column to contacts table
 * 3. Creates necessary indexes
 * 4. Handles both SQLite (dev) and PostgreSQL (production)
 */

const { getDatabase } = require('./database');

async function migrateErrorHandling() {
  const db = getDatabase();
  
  console.log('🔄 Starting error handling migration...');
  
  try {
    // Check if we're using PostgreSQL or SQLite
    const isPostgreSQL = process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('postgres');
    
    if (isPostgreSQL) {
      await migratePostgreSQL(db);
    } else {
      await migrateSQLite(db);
    }
    
    console.log('✅ Error handling migration completed successfully');
    
  } catch (error) {
    console.error('❌ Error handling migration failed:', error);
    throw error;
  }
}

async function migratePostgreSQL(db) {
  console.log('🐘 Running PostgreSQL migration...');
  
  // Check if error tables already exist
  const tablesExist = await db.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('failed_webhook_archive', 'error_notifications')
    );
  `);
  
  if (tablesExist.rows[0].exists) {
    console.log('✅ Error handling tables already exist');
    return;
  }
  
  // Create failed_webhook_archive table
  console.log('📝 Creating failed_webhook_archive table...');
  await db.query(`
    CREATE TABLE IF NOT EXISTS failed_webhook_archive (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      webhook_id TEXT NOT NULL,
      raw_payload TEXT NOT NULL CHECK (length(raw_payload) <= 50000),
      error_message TEXT NOT NULL,
      retry_count INTEGER NOT NULL DEFAULT 0,
      failed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      contact_id INTEGER,
      campaign_instance TEXT,
      correlation_id UUID,
      severity TEXT NOT NULL DEFAULT 'error' CHECK (severity IN ('critical', 'error', 'warning')),
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )
  `);
  
  // Create error_notifications table
  console.log('📝 Creating error_notifications table...');
  await db.query(`
    CREATE TABLE IF NOT EXISTS error_notifications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      notification_type TEXT NOT NULL,
      message TEXT NOT NULL,
      webhook_id TEXT,
      correlation_id UUID,
      severity TEXT NOT NULL DEFAULT 'error' CHECK (severity IN ('critical', 'error', 'warning')),
      resolved BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )
  `);
  
  // Add linked_to_contact_id column to contacts table if it doesn't exist
  console.log('📝 Adding linked_to_contact_id column to contacts table...');
  try {
    await db.query(`
      ALTER TABLE contacts ADD COLUMN IF NOT EXISTS linked_to_contact_id INTEGER
    `);
  } catch (error) {
    if (!error.message.includes('already exists')) {
      throw error;
    }
    console.log('✅ linked_to_contact_id column already exists');
  }
  
  // Create indexes
  console.log('📊 Creating indexes...');
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_failed_webhook_archive_webhook_id 
    ON failed_webhook_archive(webhook_id)
  `);
  
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_failed_webhook_archive_failed_at 
    ON failed_webhook_archive(failed_at)
  `);
  
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_failed_webhook_archive_correlation_id 
    ON failed_webhook_archive(correlation_id)
  `);
  
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_failed_webhook_archive_severity 
    ON failed_webhook_archive(severity)
  `);
  
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_error_notifications_resolved 
    ON error_notifications(resolved)
  `);
  
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_error_notifications_created_at 
    ON error_notifications(created_at)
  `);
  
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_error_notifications_severity 
    ON error_notifications(severity)
  `);
  
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_contacts_linked_to_contact_id 
    ON contacts(linked_to_contact_id)
  `);
  
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_contacts_company_lookup 
    ON contacts(first_name, last_name, email, profile_link)
  `);
}

async function migrateSQLite(db) {
  console.log('🗄️ Running SQLite migration...');
  
  // Check if error tables already exist
  const tablesExist = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name IN ('failed_webhook_archive', 'error_notifications')
  `).all();
  
  if (tablesExist.length === 2) {
    console.log('✅ Error handling tables already exist');
    return;
  }
  
  // Create failed_webhook_archive table
  console.log('📝 Creating failed_webhook_archive table...');
  db.exec(`
    CREATE TABLE IF NOT EXISTS failed_webhook_archive (
      id TEXT PRIMARY KEY,
      webhook_id TEXT NOT NULL,
      raw_payload TEXT NOT NULL CHECK (length(raw_payload) <= 50000),
      error_message TEXT NOT NULL,
      retry_count INTEGER NOT NULL DEFAULT 0,
      failed_at TEXT NOT NULL DEFAULT (datetime('now')),
      contact_id INTEGER,
      campaign_instance TEXT,
      correlation_id TEXT,
      severity TEXT NOT NULL DEFAULT 'error' CHECK (severity IN ('critical', 'error', 'warning')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  
  // Create error_notifications table
  console.log('📝 Creating error_notifications table...');
  db.exec(`
    CREATE TABLE IF NOT EXISTS error_notifications (
      id TEXT PRIMARY KEY,
      notification_type TEXT NOT NULL,
      message TEXT NOT NULL,
      webhook_id TEXT,
      correlation_id TEXT,
      severity TEXT NOT NULL DEFAULT 'error' CHECK (severity IN ('critical', 'error', 'warning')),
      resolved BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  
  // Add linked_to_contact_id column to contacts table if it doesn't exist
  console.log('📝 Adding linked_to_contact_id column to contacts table...');
  try {
    db.exec('ALTER TABLE contacts ADD COLUMN linked_to_contact_id INTEGER');
  } catch (error) {
    if (!error.message.includes('duplicate column name')) {
      throw error;
    }
    console.log('✅ linked_to_contact_id column already exists');
  }
  
  // Create indexes
  console.log('📊 Creating indexes...');
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_failed_webhook_archive_webhook_id 
    ON failed_webhook_archive(webhook_id)
  `);
  
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_failed_webhook_archive_failed_at 
    ON failed_webhook_archive(failed_at)
  `);
  
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_failed_webhook_archive_correlation_id 
    ON failed_webhook_archive(correlation_id)
  `);
  
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_failed_webhook_archive_severity 
    ON failed_webhook_archive(severity)
  `);
  
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_error_notifications_resolved 
    ON error_notifications(resolved)
  `);
  
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_error_notifications_created_at 
    ON error_notifications(created_at)
  `);
  
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_error_notifications_severity 
    ON error_notifications(severity)
  `);
  
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_contacts_linked_to_contact_id 
    ON contacts(linked_to_contact_id)
  `);
  
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_contacts_company_lookup 
    ON contacts(first_name, last_name, email, profile_link)
  `);
}

module.exports = { migrateErrorHandling };
