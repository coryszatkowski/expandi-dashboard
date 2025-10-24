#!/usr/bin/env node

/**
 * Profile Assignment Fix Script
 * 
 * This script helps fix profile assignment issues after the SQLite to PostgreSQL migration.
 * It can assign unassigned profiles to companies and update their status.
 * 
 * Usage: node fix-profile-assignments.js
 */

const db = require('./src/utils/databaseHelper');
require('dotenv').config();

async function fixProfileAssignments() {
  console.log('🔧 Fixing profile assignments...\n');
  
  const isPostgreSQL = process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('postgres');
  
  try {
    // 1. Get all companies
    console.log('📊 Getting companies...');
    const companies = await db.selectAll('SELECT * FROM companies ORDER BY name');
    console.log(`   Found ${companies.length} companies`);
    
    if (companies.length === 0) {
      console.log('   ❌ No companies found. Please create companies first.');
      return;
    }
    
    // 2. Get unassigned profiles
    console.log('\n👥 Getting unassigned profiles...');
    const unassignedProfiles = await db.selectAll(`
      SELECT * FROM profiles 
      WHERE company_id IS NULL OR status = 'unassigned'
      ORDER BY account_name
    `);
    
    console.log(`   Found ${unassignedProfiles.length} unassigned profiles`);
    
    if (unassignedProfiles.length === 0) {
      console.log('   ✅ All profiles are already assigned!');
      return;
    }
    
    // 3. Display unassigned profiles
    console.log('\n📋 Unassigned profiles:');
    unassignedProfiles.forEach((profile, index) => {
      console.log(`   ${index + 1}. ${profile.account_name} (ID: ${profile.id})`);
    });
    
    // 4. Display companies for assignment
    console.log('\n🏢 Available companies:');
    companies.forEach((company, index) => {
      console.log(`   ${index + 1}. ${company.name} (ID: ${company.id})`);
    });
    
    // 5. Interactive assignment (simplified for now)
    console.log('\n💡 To assign profiles to companies, you can:');
    console.log('   1. Use the admin dashboard to assign profiles manually');
    console.log('   2. Or run SQL commands directly in your database');
    
    // 6. Provide SQL commands for manual assignment
    console.log('\n🔧 SQL commands to assign profiles:');
    console.log('   (Replace PROFILE_ID and COMPANY_ID with actual values)');
    console.log('');
    
    unassignedProfiles.forEach(profile => {
      console.log(`   -- Assign ${profile.account_name} to a company:`);
      console.log(`   UPDATE profiles SET company_id = 'COMPANY_ID', status = 'assigned', updated_at = NOW() WHERE id = '${profile.id}';`);
      console.log('');
    });
    
    // 7. Check for profiles that might need status updates
    console.log('\n🔍 Checking for profiles with company_id but wrong status...');
    const profilesWithCompanyButWrongStatus = await db.selectAll(`
      SELECT p.*, c.name as company_name
      FROM profiles p
      JOIN companies c ON p.company_id = c.id
      WHERE p.status != 'assigned'
      ORDER BY p.account_name
    `);
    
    if (profilesWithCompanyButWrongStatus.length > 0) {
      console.log(`   Found ${profilesWithCompanyButWrongStatus.length} profiles with company but wrong status:`);
      profilesWithCompanyButWrongStatus.forEach(profile => {
        console.log(`   - ${profile.account_name} → ${profile.company_name} (Status: ${profile.status})`);
      });
      
      console.log('\n🔧 SQL commands to fix status:');
      profilesWithCompanyButWrongStatus.forEach(profile => {
        console.log(`   UPDATE profiles SET status = 'assigned', updated_at = NOW() WHERE id = '${profile.id}';`);
      });
    } else {
      console.log('   ✅ All profiles with companies have correct status!');
    }
    
    // 8. Summary
    console.log('\n📋 Summary:');
    console.log(`   Total companies: ${companies.length}`);
    console.log(`   Unassigned profiles: ${unassignedProfiles.length}`);
    console.log(`   Profiles with company but wrong status: ${profilesWithCompanyButWrongStatus.length}`);
    
    if (unassignedProfiles.length > 0 || profilesWithCompanyButWrongStatus.length > 0) {
      console.log('\n💡 Next steps:');
      console.log('   1. Use the admin dashboard to assign profiles to companies');
      console.log('   2. Or run the SQL commands provided above');
      console.log('   3. Verify the assignments worked by running: node verify-data-integrity.js');
    } else {
      console.log('\n✅ All profiles are properly assigned!');
    }
    
  } catch (error) {
    console.error('❌ Error during profile assignment fix:', error);
    throw error;
  } finally {
    // Database helper handles connection cleanup automatically
  }
}

// Run the fix
fixProfileAssignments().catch(error => {
  console.error('\n❌ Profile assignment fix failed:', error.message);
  process.exit(1);
});
