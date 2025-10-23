/**
 * Migration Script: Add webhook_id to profiles
 * 
 * This script:
 * 1. Adds webhook_id column to existing linkedin_accounts table
 * 2. Generates unique webhook_id for each existing account
 * 3. Renames table from linkedin_accounts to profiles
 * 4. Updates foreign key references
 * 5. Preserves existing webhook URLs (861722116 and 702838115)
 */

const { getDatabase } = require('./database');
const { v4: uuidv4 } = require('uuid');

async function migrateToWebhookId() {
  const db = getDatabase();
  
  console.log('🔄 Starting migration to webhook_id system...');
  
  try {
    // Start transaction
    db.exec('BEGIN TRANSACTION');
    
    // Step 1: Add webhook_id column to existing linkedin_accounts table
    console.log('📝 Adding webhook_id column to linkedin_accounts table...');
    db.exec('ALTER TABLE linkedin_accounts ADD COLUMN webhook_id TEXT');
    
    // Step 2: Generate webhook_id for existing accounts
    console.log('🔑 Generating webhook_id for existing accounts...');
    const existingAccounts = db.prepare('SELECT id, li_account_id FROM linkedin_accounts').all();
    
    // Preserve existing webhook URLs for Tobias and Simon
    const preservedWebhookIds = {
      861722116: '861722116', // Tobias - keep existing
      702838115: '702838115'  // Simon - keep existing
    };
    
    for (const account of existingAccounts) {
      let webhookId;
      
      // Check if this is Tobias or Simon
      if (preservedWebhookIds[account.li_account_id]) {
        webhookId = preservedWebhookIds[account.li_account_id];
        console.log(`🔒 Preserving webhook_id ${webhookId} for account ${account.li_account_id}`);
      } else {
        // Generate new webhook_id for other accounts
        webhookId = uuidv4();
        console.log(`🆕 Generated webhook_id ${webhookId} for account ${account.li_account_id}`);
      }
      
      // Update the account with webhook_id
      db.prepare('UPDATE linkedin_accounts SET webhook_id = ? WHERE id = ?')
        .run(webhookId, account.id);
    }
    
    // Step 3: Make webhook_id NOT NULL and UNIQUE
    console.log('🔒 Making webhook_id NOT NULL and UNIQUE...');
    db.exec('UPDATE linkedin_accounts SET webhook_id = ? WHERE webhook_id IS NULL', [uuidv4()]);
    db.exec('CREATE UNIQUE INDEX idx_linkedin_accounts_webhook_id ON linkedin_accounts(webhook_id)');
    
    // Step 4: Create new profiles table with correct structure
    console.log('📋 Creating new profiles table...');
    db.exec(`
      CREATE TABLE profiles (
        id TEXT PRIMARY KEY,
        company_id TEXT,
        account_name TEXT NOT NULL,
        account_email TEXT,
        li_account_id INTEGER,
        webhook_id TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL DEFAULT 'unassigned',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL
      )
    `);
    
    // Step 5: Copy data from linkedin_accounts to profiles
    console.log('📋 Copying data to profiles table...');
    db.exec(`
      INSERT INTO profiles 
      SELECT id, company_id, account_name, account_email, li_account_id, webhook_id, status, created_at, updated_at
      FROM linkedin_accounts
    `);
    
    // Step 6: Update campaigns table foreign key
    console.log('🔗 Updating campaigns foreign key...');
    db.exec('ALTER TABLE campaigns RENAME COLUMN linkedin_account_id TO profile_id');
    
    // Step 7: Update indexes
    console.log('📊 Updating indexes...');
    db.exec('DROP INDEX IF EXISTS idx_linkedin_accounts_company_id');
    db.exec('DROP INDEX IF EXISTS idx_linkedin_accounts_status');
    db.exec('DROP INDEX IF EXISTS idx_campaigns_linkedin_account_id');
    
    db.exec('CREATE INDEX idx_profiles_company_id ON profiles(company_id)');
    db.exec('CREATE INDEX idx_profiles_status ON profiles(status)');
    db.exec('CREATE INDEX idx_profiles_webhook_id ON profiles(webhook_id)');
    db.exec('CREATE INDEX idx_campaigns_profile_id ON campaigns(profile_id)');
    
    // Step 8: Drop old linkedin_accounts table
    console.log('🗑️ Dropping old linkedin_accounts table...');
    db.exec('DROP TABLE linkedin_accounts');
    
    // Commit transaction
    db.exec('COMMIT');
    
    console.log('✅ Migration completed successfully!');
    
    // Log webhook URLs for admin reference
    console.log('\n📋 Webhook URLs for existing profiles:');
    const profiles = db.prepare(`
      SELECT account_name, webhook_id, li_account_id 
      FROM profiles 
      ORDER BY account_name
    `).all();
    
    profiles.forEach(profile => {
      console.log(`  ${profile.account_name}: https://breezy-things-talk.loca.lt/api/webhooks/expandi/account/${profile.webhook_id}`);
    });
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    db.exec('ROLLBACK');
    throw error;
  }
}

// Run migration if called directly
if (require.main === module) {
  migrateToWebhookId()
    .then(() => {
      console.log('🎉 Migration completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { migrateToWebhookId };
