#!/usr/bin/env node

/**
 * Data Integrity Verification Script
 * 
 * This script checks the data integrity after the SQLite to PostgreSQL migration.
 * It verifies that profiles are properly assigned to companies and that campaigns
 * and events exist and are properly linked.
 * 
 * Usage: node verify-data-integrity.js
 */

const db = require('./src/utils/databaseHelper');
require('dotenv').config();

async function verifyDataIntegrity() {
  console.log('🔍 Verifying data integrity after migration...\n');
  
  const isPostgreSQL = process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('postgres');
  
  try {
    // 1. Check companies
    console.log('📊 Checking companies...');
    const companies = await db.selectAll('SELECT * FROM companies ORDER BY name');
    console.log(`   Found ${companies.length} companies`);
    companies.forEach(company => {
      console.log(`   - ${company.name} (ID: ${company.id})`);
    });
    
    // 2. Check profiles and their assignments
    console.log('\n👥 Checking profiles and company assignments...');
    const profiles = await db.selectAll(`
      SELECT p.*, c.name as company_name
      FROM profiles p
      LEFT JOIN companies c ON p.company_id = c.id
      ORDER BY p.account_name
    `);
    
    console.log(`   Found ${profiles.length} profiles`);
    
    const assignedProfiles = profiles.filter(p => p.company_id && p.status === 'assigned');
    const unassignedProfiles = profiles.filter(p => !p.company_id || p.status === 'unassigned');
    
    console.log(`   - Assigned to companies: ${assignedProfiles.length}`);
    console.log(`   - Unassigned: ${unassignedProfiles.length}`);
    
    if (assignedProfiles.length > 0) {
      console.log('\n   Assigned profiles:');
      assignedProfiles.forEach(profile => {
        console.log(`   - ${profile.account_name} → ${profile.company_name || 'Unknown Company'}`);
      });
    }
    
    if (unassignedProfiles.length > 0) {
      console.log('\n   Unassigned profiles:');
      unassignedProfiles.forEach(profile => {
        console.log(`   - ${profile.account_name} (Status: ${profile.status})`);
      });
    }
    
    // 3. Check campaigns
    console.log('\n🎯 Checking campaigns...');
    const campaigns = await db.selectAll(`
      SELECT c.*, p.account_name, p.company_id, co.name as company_name
      FROM campaigns c
      JOIN profiles p ON c.profile_id = p.id
      LEFT JOIN companies co ON p.company_id = co.id
      ORDER BY c.started_at DESC
    `);
    
    console.log(`   Found ${campaigns.length} campaigns`);
    
    if (campaigns.length > 0) {
      console.log('\n   Campaigns by profile:');
      const campaignsByProfile = {};
      campaigns.forEach(campaign => {
        if (!campaignsByProfile[campaign.account_name]) {
          campaignsByProfile[campaign.account_name] = [];
        }
        campaignsByProfile[campaign.account_name].push(campaign);
      });
      
      Object.entries(campaignsByProfile).forEach(([accountName, profileCampaigns]) => {
        console.log(`   - ${accountName}: ${profileCampaigns.length} campaigns`);
        profileCampaigns.forEach(campaign => {
          console.log(`     * ${campaign.campaign_name} (Started: ${campaign.started_at})`);
        });
      });
    }
    
    // 4. Check events
    console.log('\n📈 Checking events...');
    const events = await db.selectAll(`
      SELECT e.*, c.campaign_name, p.account_name, co.name as company_name
      FROM events e
      JOIN campaigns c ON e.campaign_id = c.id
      JOIN profiles p ON c.profile_id = p.id
      LEFT JOIN companies co ON p.company_id = co.id
      ORDER BY e.created_at DESC
    `);
    
    console.log(`   Found ${events.length} events`);
    
    if (events.length > 0) {
      const eventsByType = {};
      events.forEach(event => {
        if (!eventsByType[event.event_type]) {
          eventsByType[event.event_type] = 0;
        }
        eventsByType[event.event_type]++;
      });
      
      console.log('\n   Events by type:');
      Object.entries(eventsByType).forEach(([eventType, count]) => {
        console.log(`   - ${eventType}: ${count}`);
      });
    }
    
    // 5. Check contacts
    console.log('\n📇 Checking contacts...');
    const contacts = await db.selectAll(`
      SELECT con.*, c.campaign_name, p.account_name, co.name as company_name
      FROM contacts con
      JOIN campaigns c ON con.campaign_id = c.id
      JOIN profiles p ON c.profile_id = p.id
      LEFT JOIN companies co ON p.company_id = co.id
      ORDER BY con.created_at DESC
    `);
    
    console.log(`   Found ${contacts.length} contacts`);
    
    // 6. Summary and recommendations
    console.log('\n📋 Summary:');
    console.log(`   Companies: ${companies.length}`);
    console.log(`   Profiles: ${profiles.length} (${assignedProfiles.length} assigned, ${unassignedProfiles.length} unassigned)`);
    console.log(`   Campaigns: ${campaigns.length}`);
    console.log(`   Events: ${events.length}`);
    console.log(`   Contacts: ${contacts.length}`);
    
    // 7. Identify potential issues
    console.log('\n🔧 Potential Issues:');
    
    if (unassignedProfiles.length > 0) {
      console.log(`   ⚠️  ${unassignedProfiles.length} profiles are not assigned to companies`);
      console.log('      These profiles won\'t appear in company dashboards');
    }
    
    if (assignedProfiles.length > 0 && campaigns.length === 0) {
      console.log('   ⚠️  No campaigns found for assigned profiles');
      console.log('      This could indicate missing campaign data');
    }
    
    if (campaigns.length > 0 && events.length === 0) {
      console.log('   ⚠️  No events found for campaigns');
      console.log('      This could indicate missing event data');
    }
    
    if (campaigns.length > 0 && contacts.length === 0) {
      console.log('   ⚠️  No contacts found for campaigns');
      console.log('      This could indicate missing contact data');
    }
    
    // 8. Recommendations
    console.log('\n💡 Recommendations:');
    
    if (unassignedProfiles.length > 0) {
      console.log('   1. Assign unassigned profiles to companies using the admin dashboard');
      console.log('   2. Update profile status to "assigned" after assignment');
    }
    
    if (assignedProfiles.length > 0 && campaigns.length === 0) {
      console.log('   1. Check if campaigns were properly migrated');
      console.log('   2. Verify campaign data exists in the database');
    }
    
    if (campaigns.length > 0 && events.length === 0) {
      console.log('   1. Check if events were properly migrated');
      console.log('   2. Verify event data exists in the database');
    }
    
    console.log('\n✅ Data integrity check completed!');
    
  } catch (error) {
    console.error('❌ Error during data integrity check:', error);
    throw error;
  } finally {
    // Database helper handles connection cleanup automatically
  }
}

// Run the verification
verifyDataIntegrity().catch(error => {
  console.error('\n❌ Data integrity check failed:', error.message);
  process.exit(1);
});
