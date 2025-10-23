/**
 * Migration Script: Fix Contacts Table Schema
 * 
 * This script:
 * 1. Creates a new contacts table with proper campaign_id foreign key
 * 2. Migrates existing data with proper campaign associations
 * 3. Updates the primary key to allow same contact_id across different campaigns
 * 4. Adds proper CASCADE DELETE constraints
 */

const { getDatabase } = require('./database');

async function migrateContactsToCampaigns() {
  const db = getDatabase();
  
  console.log('🔄 Starting contacts table migration...');
  
  try {
    // Start transaction
    db.exec('BEGIN TRANSACTION');
    
    // Step 1: Create new contacts table with proper schema
    console.log('📝 Creating new contacts table with campaign_id...');
    db.exec(`
      CREATE TABLE contacts_new (
        contact_id INTEGER NOT NULL,
        campaign_id TEXT NOT NULL,
        first_name TEXT,                        
        last_name TEXT,
        company_name TEXT,                      
        job_title TEXT,
        profile_link TEXT,
        email TEXT,
        phone TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (contact_id, campaign_id),
        FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
      )
    `);
    
    // Step 2: Migrate existing data
    console.log('📋 Migrating existing contact data...');
    const existingContacts = db.prepare(`
      SELECT DISTINCT 
        c.contact_id,
        c.first_name,
        c.last_name,
        c.company_name,
        c.job_title,
        c.profile_link,
        c.email,
        c.phone,
        c.created_at,
        c.updated_at,
        e.campaign_id
      FROM contacts c
      JOIN events e ON c.contact_id = e.contact_id
      WHERE e.campaign_id IS NOT NULL
    `).all();
    
    console.log(`Found ${existingContacts.length} contacts to migrate`);
    
    const insertStmt = db.prepare(`
      INSERT INTO contacts_new (
        contact_id, campaign_id, first_name, last_name, company_name,
        job_title, profile_link, email, phone, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    for (const contact of existingContacts) {
      try {
        insertStmt.run(
          contact.contact_id,
          contact.campaign_id,
          contact.first_name,
          contact.last_name,
          contact.company_name,
          contact.job_title,
          contact.profile_link,
          contact.email,
          contact.phone,
          contact.created_at,
          contact.updated_at
        );
      } catch (error) {
        console.warn(`Skipping duplicate contact ${contact.contact_id} in campaign ${contact.campaign_id}:`, error.message);
      }
    }
    
    // Step 3: Drop old contacts table
    console.log('🗑️ Dropping old contacts table...');
    db.exec('DROP TABLE contacts');
    
    // Step 4: Rename new table
    console.log('🔄 Renaming new table...');
    db.exec('ALTER TABLE contacts_new RENAME TO contacts');
    
    // Step 5: Create indexes
    console.log('📊 Creating indexes...');
    db.exec('CREATE INDEX idx_contacts_campaign_id ON contacts(campaign_id)');
    db.exec('CREATE INDEX idx_contacts_contact_id ON contacts(contact_id)');
    
    // Commit transaction
    db.exec('COMMIT');
    
    console.log('✅ Contacts table migration completed successfully!');
    
    // Verify the new schema
    console.log('\n📋 New contacts table schema:');
    const schema = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='contacts'").get();
    console.log(schema.sql);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    db.exec('ROLLBACK');
    throw error;
  }
}

// Run migration if called directly
if (require.main === module) {
  migrateContactsToCampaigns()
    .then(() => {
      console.log('Migration completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = migrateContactsToCampaigns;
