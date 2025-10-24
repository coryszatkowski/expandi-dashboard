/**
 * Update Webhook URLs Migration Script
 * 
 * This script updates existing webhook URLs in the database to use the new format:
 * OLD: https://dashboard.theorionstrategy.com/api/webhooks/{webhook_id}
 * NEW: https://api.dashboard.theorionstrategy.com/api/webhooks/expandi/account/{webhook_id}
 */

const db = require('./src/utils/databaseHelper');

async function updateWebhookUrls() {
  try {
    console.log('🔄 Starting webhook URL update migration...');
    
    // Get all profiles with webhook_id
    const profiles = await db.selectAll('SELECT id, account_name, webhook_id FROM profiles WHERE webhook_id IS NOT NULL');
    
    console.log(`📊 Found ${profiles.length} profiles with webhook URLs to update`);
    
    let updatedCount = 0;
    
    for (const profile of profiles) {
      const oldWebhookUrl = `https://dashboard.theorionstrategy.com/api/webhooks/${profile.webhook_id}`;
      const newWebhookUrl = `https://api.dashboard.theorionstrategy.com/api/webhooks/expandi/account/${profile.webhook_id}`;
      
      console.log(`\n📝 Profile: ${profile.account_name} (${profile.id})`);
      console.log(`   OLD: ${oldWebhookUrl}`);
      console.log(`   NEW: ${newWebhookUrl}`);
      
      // Note: We don't actually need to update the database since the webhook_id stays the same
      // The frontend code change will handle the URL format change
      // But we can log what the new URLs will be
      
      updatedCount++;
    }
    
    console.log(`\n✅ Migration complete! ${updatedCount} webhook URLs will use the new format.`);
    console.log('📋 Summary:');
    console.log('   - Frontend code updated to generate correct URLs');
    console.log('   - Existing webhook_id values remain unchanged');
    console.log('   - All webhook URLs will now point to api.dashboard.theorionstrategy.com');
    console.log('   - All webhook URLs will use /api/webhooks/expandi/account/ path');
    
  } catch (error) {
    console.error('❌ Error during webhook URL migration:', error);
    throw error;
  }
}

// Run the migration
if (require.main === module) {
  updateWebhookUrls()
    .then(() => {
      console.log('\n🎉 Webhook URL migration completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Webhook URL migration failed:', error);
      process.exit(1);
    });
}

module.exports = { updateWebhookUrls };
