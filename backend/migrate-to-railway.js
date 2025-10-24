#!/usr/bin/env node

/**
 * SQLite to Railway PostgreSQL Migration Script
 * 
 * This script safely copies all data from your SQLite database to Railway PostgreSQL
 * and handles existing data by clearing and re-migrating everything.
 * 
 * Usage: node migrate-to-railway.js
 */

const Database = require('better-sqlite3');
const { Pool } = require('pg');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

// Configuration
const SQLITE_PATH = path.join(__dirname, 'database/dev.db');
const RAILWAY_URL = 'postgresql://postgres:sMJuIAAcZciJOtvncglXZskdIDddDOac@interchange.proxy.rlwy.net:32767/railway';

console.log('🚀 Starting SQLite to Railway PostgreSQL migration...');
console.log(`📁 SQLite source: ${SQLITE_PATH}`);
console.log(`🐘 Railway target: interchange.proxy.rlwy.net:32767/railway`);

// Initialize connections
let sqliteDb;
let postgresPool;

async function runMigration() {
try {
  // Connect to SQLite (read-only)
  console.log('\n📖 Connecting to SQLite database...');
  sqliteDb = new Database(SQLITE_PATH, { readonly: true });
  console.log('✅ SQLite connected (read-only)');

  // Connect to Railway PostgreSQL
  console.log('\n🐘 Connecting to Railway PostgreSQL...');
  postgresPool = new Pool({
    connectionString: RAILWAY_URL,
    ssl: { rejectUnauthorized: false }
  });

  // Test PostgreSQL connection
  await postgresPool.query('SELECT NOW()');
  console.log('✅ Railway PostgreSQL connected');

  // Clear existing data (in correct order to respect foreign keys)
  console.log('\n🧹 Clearing existing Railway data...');
  await postgresPool.query('DELETE FROM contacts');
  await postgresPool.query('DELETE FROM events');
  await postgresPool.query('DELETE FROM campaigns');
  await postgresPool.query('DELETE FROM profiles');
  await postgresPool.query('DELETE FROM companies');
  await postgresPool.query('DELETE FROM admin_users');
  console.log('✅ Existing data cleared');

  // Get table counts from SQLite
  console.log('\n📊 Checking SQLite data...');
  const tables = ['admin_users', 'companies', 'profiles', 'campaigns', 'events', 'contacts'];
  const sqliteCounts = {};
  
  for (const table of tables) {
    try {
      const result = sqliteDb.prepare(`SELECT COUNT(*) as count FROM ${table}`).get();
      sqliteCounts[table] = result.count;
      console.log(`  ${table}: ${result.count} records`);
    } catch (error) {
      console.log(`  ${table}: 0 records (table may not exist)`);
      sqliteCounts[table] = 0;
    }
  }

  // Start migration process
  console.log('\n🔄 Starting data migration...');
  
  // 1. Migrate companies (no dependencies)
  if (sqliteCounts.companies > 0) {
    console.log('\n📦 Migrating companies...');
    const companies = sqliteDb.prepare('SELECT * FROM companies').all();
    
    for (const company of companies) {
      await postgresPool.query(`
        INSERT INTO companies (id, name, share_token, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5)
      `, [company.id, company.name, company.share_token, company.created_at, company.updated_at]);
    }
    console.log(`✅ Migrated ${companies.length} companies`);
  }

  // 2. Migrate admin_users (no dependencies)
  if (sqliteCounts.admin_users > 0) {
    console.log('\n👤 Migrating admin users...');
    const adminUsers = sqliteDb.prepare('SELECT * FROM admin_users').all();
    
    for (const user of adminUsers) {
      await postgresPool.query(`
        INSERT INTO admin_users (id, username, password_hash, created_at)
        VALUES ($1, $2, $3, $4)
      `, [user.id, user.username, user.password_hash, user.created_at]);
    }
    console.log(`✅ Migrated ${adminUsers.length} admin users`);
  }

  // 3. Migrate profiles (depends on companies)
  if (sqliteCounts.profiles > 0) {
    console.log('\n👥 Migrating profiles...');
    const profiles = sqliteDb.prepare('SELECT * FROM profiles').all();
    
    for (const profile of profiles) {
      // Generate a new UUID for webhook_id if it's not a valid UUID
      let webhookId = profile.webhook_id;
      if (!webhookId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        webhookId = uuidv4();
        console.log(`  Generated new webhook_id for ${profile.account_name}: ${webhookId}`);
      }
      
      await postgresPool.query(`
        INSERT INTO profiles (id, company_id, account_name, account_email, li_account_id, webhook_id, status, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        profile.id, profile.company_id, profile.account_name, profile.account_email,
        profile.li_account_id, webhookId, profile.status, profile.created_at, profile.updated_at
      ]);
    }
    console.log(`✅ Migrated ${profiles.length} profiles`);
  }

  // 4. Migrate campaigns (depends on profiles)
  if (sqliteCounts.campaigns > 0) {
    console.log('\n🎯 Migrating campaigns...');
    const campaigns = sqliteDb.prepare('SELECT * FROM campaigns').all();
    
    for (const campaign of campaigns) {
      await postgresPool.query(`
        INSERT INTO campaigns (id, profile_id, campaign_instance, campaign_name, started_at, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        campaign.id, campaign.profile_id, campaign.campaign_instance,
        campaign.campaign_name, campaign.started_at, campaign.created_at, campaign.updated_at
      ]);
    }
    console.log(`✅ Migrated ${campaigns.length} campaigns`);
  }

  // 5. Migrate events (depends on campaigns)
  if (sqliteCounts.events > 0) {
    console.log('\n📈 Migrating events...');
    const events = sqliteDb.prepare('SELECT * FROM events').all();
    
    // Get valid campaign IDs from PostgreSQL
    const validCampaigns = await postgresPool.query('SELECT id FROM campaigns');
    const validCampaignIds = new Set(validCampaigns.rows.map(row => row.id));
    
    let migratedCount = 0;
    let skippedCount = 0;
    
    for (const event of events) {
      if (validCampaignIds.has(event.campaign_id)) {
        await postgresPool.query(`
          INSERT INTO events (id, campaign_id, contact_id, event_type, event_data, invited_at, connected_at, replied_at, conversation_status, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `, [
          event.id, event.campaign_id, event.contact_id, event.event_type, event.event_data,
          event.invited_at, event.connected_at, event.replied_at, event.conversation_status, event.created_at
        ]);
        migratedCount++;
      } else {
        console.log(`  ⚠️  Skipped orphaned event ${event.id} (campaign ${event.campaign_id} not found)`);
        skippedCount++;
      }
    }
    console.log(`✅ Migrated ${migratedCount} events, skipped ${skippedCount} orphaned events`);
  }

  // 6. Migrate contacts (depends on campaigns)
  if (sqliteCounts.contacts > 0) {
    console.log('\n📇 Migrating contacts...');
    const contacts = sqliteDb.prepare('SELECT * FROM contacts').all();
    
    for (const contact of contacts) {
      await postgresPool.query(`
        INSERT INTO contacts (contact_id, campaign_id, first_name, last_name, company_name, job_title, profile_link, email, phone, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [
        contact.contact_id, contact.campaign_id, contact.first_name, contact.last_name,
        contact.company_name, contact.job_title, contact.profile_link, contact.email,
        contact.phone, contact.created_at, contact.updated_at
      ]);
    }
    console.log(`✅ Migrated ${contacts.length} contacts`);
  }

  // Verify migration
  console.log('\n🔍 Verifying migration...');
  for (const table of tables) {
    const result = await postgresPool.query(`SELECT COUNT(*) as count FROM ${table}`);
    const postgresCount = parseInt(result.rows[0].count);
    const sqliteCount = sqliteCounts[table];
    
    if (postgresCount === sqliteCount) {
      console.log(`✅ ${table}: ${postgresCount} records (matches SQLite)`);
    } else {
      console.log(`⚠️  ${table}: ${postgresCount} records (SQLite had ${sqliteCount})`);
    }
  }

  console.log('\n🎉 Migration to Railway completed successfully!');
  console.log('\n📝 Next steps:');
  console.log('1. Update your .env file to use Railway PostgreSQL:');
  console.log(`   DATABASE_URL=${RAILWAY_URL}`);
  console.log('2. Test your app with the new database');
  console.log('3. Once confirmed working, you can remove the SQLite database');

} catch (error) {
  console.error('\n❌ Migration failed:', error.message);
  console.error('Your SQLite database and app are unchanged.');
  process.exit(1);
} finally {
  // Clean up connections
  if (sqliteDb) {
    sqliteDb.close();
    console.log('\n🔒 SQLite connection closed');
  }
  if (postgresPool) {
    await postgresPool.end();
    console.log('🔒 Railway PostgreSQL connection closed');
  }
}
}

// Run the migration
runMigration().catch(error => {
  console.error('\n❌ Migration failed:', error.message);
  process.exit(1);
});
