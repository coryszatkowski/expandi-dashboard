#!/usr/bin/env node

/**
 * Copy Production Database to Dev Database
 * 
 * This script safely copies all data from production PostgreSQL to dev PostgreSQL
 * without modifying production data.
 * 
 * Usage:
 * PROD_DATABASE_URL='postgresql://...prod...' \
 * DEV_DATABASE_URL='postgresql://...dev...' \
 * node backend/copy-production-to-dev.js
 */

const { Pool } = require('pg');
require('dotenv').config();

const PROD_DATABASE_URL = process.env.PROD_DATABASE_URL;
const DEV_DATABASE_URL = process.env.DEV_DATABASE_URL;

if (!PROD_DATABASE_URL || !DEV_DATABASE_URL) {
  console.error('❌ Error: Both PROD_DATABASE_URL and DEV_DATABASE_URL must be set');
  console.log('\nUsage:');
  console.log('PROD_DATABASE_URL="postgresql://...prod..." \\');
  console.log('DEV_DATABASE_URL="postgresql://...dev..." \\');
  console.log('node backend/copy-production-to-dev.js');
  process.exit(1);
}

console.log('🚀 Starting production to dev database copy...');
console.log(`📦 Production: ${PROD_DATABASE_URL.split('@')[1] || 'hidden'}`);
console.log(`🔧 Dev: ${DEV_DATABASE_URL.split('@')[1] || 'hidden'}`);
console.log('\n⚠️  WARNING: This will overwrite existing data in dev database!');

let prodPool;
let devPool;

async function copyData() {
  try {
    // Connect to production (read-only)
    console.log('\n📖 Connecting to production database...');
    prodPool = new Pool({
      connectionString: PROD_DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
    await prodPool.query('SELECT NOW()');
    console.log('✅ Production connected (read-only)');

    // Connect to dev
    console.log('\n🔧 Connecting to dev database...');
    devPool = new Pool({
      connectionString: DEV_DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
    await devPool.query('SELECT NOW()');
    console.log('✅ Dev connected');

    // Get production table counts
    console.log('\n📊 Checking production data...');
    const tables = [
      'admin_users', 
      'companies', 
      'profiles', 
      'campaigns', 
      'contacts', 
      'events',
      'failed_webhook_archive',
      'error_notifications'
    ];
    
    const prodCounts = {};
    for (const table of tables) {
      try {
        const result = await prodPool.query(`SELECT COUNT(*)::int AS count FROM ${table}`);
        prodCounts[table] = result.rows[0].count;
        console.log(`  ${table}: ${prodCounts[table]} records`);
      } catch (error) {
        console.log(`  ${table}: 0 records (table may not exist)`);
        prodCounts[table] = 0;
      }
    }

    // Clear dev database first (optional - comment out if you want to merge instead)
    console.log('\n🧹 Clearing dev database...');
    const reverseTables = [...tables].reverse(); // Delete in reverse dependency order
    for (const table of reverseTables) {
      try {
        await devPool.query(`TRUNCATE TABLE ${table} CASCADE`);
        console.log(`  ✅ Cleared ${table}`);
      } catch (error) {
        // Table might not exist yet
      }
    }

    // Copy tables in dependency order
    console.log('\n🔄 Starting data copy...');

    // 1. Copy admin_users
    if (prodCounts.admin_users > 0) {
      console.log('\n👤 Copying admin users...');
      const result = await prodPool.query('SELECT * FROM admin_users');
      for (const user of result.rows) {
        await devPool.query(`
          INSERT INTO admin_users (id, username, password_hash, created_at)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (id) DO UPDATE SET
            username = EXCLUDED.username,
            password_hash = EXCLUDED.password_hash,
            created_at = EXCLUDED.created_at
        `, [user.id, user.username, user.password_hash, user.created_at]);
      }
      console.log(`✅ Copied ${result.rows.length} admin users`);
    }

    // 2. Copy companies
    if (prodCounts.companies > 0) {
      console.log('\n📦 Copying companies...');
      const result = await prodPool.query('SELECT * FROM companies');
      for (const company of result.rows) {
        await devPool.query(`
          INSERT INTO companies (id, name, share_token, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            share_token = EXCLUDED.share_token,
            updated_at = EXCLUDED.updated_at
        `, [company.id, company.name, company.share_token, company.created_at, company.updated_at]);
      }
      console.log(`✅ Copied ${result.rows.length} companies`);
    }

    // 3. Copy profiles
    if (prodCounts.profiles > 0) {
      console.log('\n👥 Copying profiles...');
      const result = await prodPool.query('SELECT * FROM profiles');
      for (const profile of result.rows) {
        await devPool.query(`
          INSERT INTO profiles (id, company_id, account_name, account_email, li_account_id, webhook_id, status, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (id) DO UPDATE SET
            company_id = EXCLUDED.company_id,
            account_name = EXCLUDED.account_name,
            account_email = EXCLUDED.account_email,
            li_account_id = EXCLUDED.li_account_id,
            webhook_id = EXCLUDED.webhook_id,
            status = EXCLUDED.status,
            updated_at = EXCLUDED.updated_at
        `, [
          profile.id, profile.company_id, profile.account_name, profile.account_email,
          profile.li_account_id, profile.webhook_id, profile.status, 
          profile.created_at, profile.updated_at
        ]);
      }
      console.log(`✅ Copied ${result.rows.length} profiles`);
    }

    // 4. Copy campaigns
    if (prodCounts.campaigns > 0) {
      console.log('\n🎯 Copying campaigns...');
      const result = await prodPool.query('SELECT * FROM campaigns');
      for (const campaign of result.rows) {
        await devPool.query(`
          INSERT INTO campaigns (id, profile_id, campaign_instance, campaign_name, started_at, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (id) DO UPDATE SET
            profile_id = EXCLUDED.profile_id,
            campaign_instance = EXCLUDED.campaign_instance,
            campaign_name = EXCLUDED.campaign_name,
            started_at = EXCLUDED.started_at,
            updated_at = EXCLUDED.updated_at
        `, [
          campaign.id, campaign.profile_id, campaign.campaign_instance,
          campaign.campaign_name, campaign.started_at, 
          campaign.created_at, campaign.updated_at
        ]);
      }
      console.log(`✅ Copied ${result.rows.length} campaigns`);
    }

    // 5. Copy contacts
    if (prodCounts.contacts > 0) {
      console.log('\n📇 Copying contacts...');
      const result = await prodPool.query('SELECT * FROM contacts');
      for (const contact of result.rows) {
        await devPool.query(`
          INSERT INTO contacts (contact_id, campaign_id, first_name, last_name, company_name, job_title, profile_link, email, phone, linked_to_contact_id, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          ON CONFLICT (contact_id, campaign_id) DO UPDATE SET
            first_name = EXCLUDED.first_name,
            last_name = EXCLUDED.last_name,
            company_name = EXCLUDED.company_name,
            job_title = EXCLUDED.job_title,
            profile_link = EXCLUDED.profile_link,
            email = EXCLUDED.email,
            phone = EXCLUDED.phone,
            linked_to_contact_id = EXCLUDED.linked_to_contact_id,
            updated_at = EXCLUDED.updated_at
        `, [
          contact.contact_id, contact.campaign_id, contact.first_name, contact.last_name,
          contact.company_name, contact.job_title, contact.profile_link, contact.email,
          contact.phone, contact.linked_to_contact_id || null,
          contact.created_at, contact.updated_at
        ]);
      }
      console.log(`✅ Copied ${result.rows.length} contacts`);
    }

    // 6. Copy events
    if (prodCounts.events > 0) {
      console.log('\n📈 Copying events...');
      const result = await prodPool.query('SELECT * FROM events');
      let copied = 0;
      let skipped = 0;
      
      // Get valid campaign IDs from dev
      const devCampaigns = await devPool.query('SELECT id FROM campaigns');
      const validCampaignIds = new Set(devCampaigns.rows.map(r => r.id));
      
      for (const event of result.rows) {
        if (validCampaignIds.has(event.campaign_id)) {
          await devPool.query(`
            INSERT INTO events (id, campaign_id, contact_id, event_type, event_data, invited_at, connected_at, replied_at, conversation_status, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (id) DO UPDATE SET
              campaign_id = EXCLUDED.campaign_id,
              contact_id = EXCLUDED.contact_id,
              event_type = EXCLUDED.event_type,
              event_data = EXCLUDED.event_data,
              invited_at = EXCLUDED.invited_at,
              connected_at = EXCLUDED.connected_at,
              replied_at = EXCLUDED.replied_at,
              conversation_status = EXCLUDED.conversation_status
          `, [
            event.id, event.campaign_id, event.contact_id, event.event_type, event.event_data,
            event.invited_at, event.connected_at, event.replied_at, 
            event.conversation_status, event.created_at
          ]);
          copied++;
        } else {
          skipped++;
        }
      }
      console.log(`✅ Copied ${copied} events, skipped ${skipped} orphaned events`);
    }

    // 7. Copy failed_webhook_archive (if exists)
    if (prodCounts.failed_webhook_archive > 0) {
      console.log('\n📦 Copying failed webhook archive...');
      const result = await prodPool.query('SELECT * FROM failed_webhook_archive');
      for (const archive of result.rows) {
        await devPool.query(`
          INSERT INTO failed_webhook_archive (id, webhook_id, raw_payload, error_message, retry_count, failed_at, contact_id, campaign_instance, correlation_id, severity, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          ON CONFLICT (id) DO UPDATE SET
            webhook_id = EXCLUDED.webhook_id,
            raw_payload = EXCLUDED.raw_payload,
            error_message = EXCLUDED.error_message,
            retry_count = EXCLUDED.retry_count,
            failed_at = EXCLUDED.failed_at,
            contact_id = EXCLUDED.contact_id,
            campaign_instance = EXCLUDED.campaign_instance,
            correlation_id = EXCLUDED.correlation_id,
            severity = EXCLUDED.severity
        `, [
          archive.id, archive.webhook_id, archive.raw_payload, archive.error_message,
          archive.retry_count, archive.failed_at, archive.contact_id || null,
          archive.campaign_instance || null, archive.correlation_id || null,
          archive.severity, archive.created_at
        ]);
      }
      console.log(`✅ Copied ${result.rows.length} archived webhooks`);
    }

    // 8. Copy error_notifications (if exists)
    if (prodCounts.error_notifications > 0) {
      console.log('\n🔔 Copying error notifications...');
      const result = await prodPool.query('SELECT * FROM error_notifications');
      for (const notification of result.rows) {
        await devPool.query(`
          INSERT INTO error_notifications (id, notification_type, message, webhook_id, correlation_id, severity, resolved, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (id) DO UPDATE SET
            notification_type = EXCLUDED.notification_type,
            message = EXCLUDED.message,
            webhook_id = EXCLUDED.webhook_id,
            correlation_id = EXCLUDED.correlation_id,
            severity = EXCLUDED.severity,
            resolved = EXCLUDED.resolved
        `, [
          notification.id, notification.notification_type, notification.message,
          notification.webhook_id || null, notification.correlation_id || null,
          notification.severity, notification.resolved, notification.created_at
        ]);
      }
      console.log(`✅ Copied ${result.rows.length} error notifications`);
    }

    // Verify copy
    console.log('\n🔍 Verifying copy...');
    for (const table of tables) {
      try {
        const prodResult = await prodPool.query(`SELECT COUNT(*)::int AS count FROM ${table}`);
        const devResult = await devPool.query(`SELECT COUNT(*)::int AS count FROM ${table}`);
        const prodCount = prodResult.rows[0].count;
        const devCount = devResult.rows[0].count;
        
        if (prodCount === devCount) {
          console.log(`✅ ${table}: ${devCount} records (matches production)`);
        } else {
          console.log(`⚠️  ${table}: ${devCount} records (production has ${prodCount})`);
        }
      } catch (error) {
        // Table might not exist in one of the databases
        console.log(`⚠️  ${table}: Could not verify (table may not exist)`);
      }
    }

    console.log('\n🎉 Data copy completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('1. Test your dev environment with the copied data');
    console.log('2. Verify all functionality works correctly');

  } catch (error) {
    console.error('\n❌ Copy failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    if (prodPool) {
      await prodPool.end();
      console.log('\n🔒 Production connection closed');
    }
    if (devPool) {
      await devPool.end();
      console.log('🔒 Dev connection closed');
    }
  }
}

// Run the copy
copyData().catch(error => {
  console.error('\n❌ Copy failed:', error.message);
  process.exit(1);
});
