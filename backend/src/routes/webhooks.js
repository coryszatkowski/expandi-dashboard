/**
 * Webhook Routes
 * 
 * Handles incoming webhooks from Expandi.io
 */

const express = require('express');
const router = express.Router();
const WebhookProcessor = require('../services/webhookProcessor');
const EventEmitter = require('events');

// Create a global event emitter for webhook events
const webhookEvents = new EventEmitter();
global.webhookEvents = webhookEvents;

// OLD ROUTE REMOVED - Using profile-specific webhook routes instead

/**
 * POST /api/webhooks/expandi/account/:webhookId
 * 
 * Profile-specific webhook endpoint for Expandi
 * This allows each profile to have its own unique webhook URL
 * 
 * URL format: /api/webhooks/expandi/account/{webhook_id}
 * where webhook_id is the unique profile webhook identifier
 */
router.post('/expandi/account/:webhookId', async (req, res) => {
  const { webhookId } = req.params;
  const maxRetries = 3;
  
  // RAW WEBHOOK LISTENER - Log EVERY request that hits this endpoint
  const rawWebhookData = {
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.url,
    headers: {
      'content-type': req.headers['content-type'],
      'user-agent': req.headers['user-agent'],
      'x-forwarded-for': req.headers['x-forwarded-for'],
      'host': req.headers['host']
    },
    body: req.body,
    bodySize: JSON.stringify(req.body).length,
    ip: req.ip || req.connection.remoteAddress,
    webhookId: webhookId
  };
  
  // Minimal webhook logging for troubleshooting
  console.log(`📨 Webhook received (${webhookId}):`, {
    event: req.body.hook?.event,
    contact_id: req.body.contact?.id,
    campaign: req.body.messenger?.campaign_instance
  });

  // Emit raw webhook event
  webhookEvents.emit('rawWebhook', rawWebhookData);

  try {
    // Validate payload structure
    const validation = WebhookProcessor.validatePayload(req.body);
    
    if (!validation.valid) {
      console.error(`❌ Invalid webhook payload for webhook ${webhookId}:`, validation.errors);
      return res.status(400).json({
        success: false,
        error: 'Invalid webhook payload',
        details: validation.errors
      });
    }

    // Retry logic with exponential backoff
    let lastError;
    let result;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        console.log(`🔄 Processing webhook ${webhookId} (attempt ${attempt + 1}/${maxRetries})`);
        
        // Process webhook with retry count
        result = await WebhookProcessor.processWebhook(req.body, webhookId, attempt);

        console.log(`✅ Webhook ${webhookId} processed successfully on attempt ${attempt + 1}:`, {
          profile: result.profile.account_name,
          campaign: result.campaign.campaign_name,
          contact: `${result.contact.first_name} ${result.contact.last_name}`,
          event: result.event.event_type,
          correlation_id: result.correlation_id
        });

        // Broadcast processed webhook to frontend
        const webhookData = {
          id: result.event.id,
          event_type: result.event.event_type,
          created_at: result.event.created_at,
          invited_at: result.event.invited_at,
          connected_at: result.event.connected_at,
          replied_at: result.event.replied_at,
          conversation_status: result.event.conversation_status,
          campaign_name: result.campaign.campaign_name,
          campaign_instance: result.campaign.campaign_instance,
          account_name: result.profile.account_name,
          webhook_id: result.profile.webhook_id,
          company_name: result.profile.company_id ? 'Assigned' : null,
          expandi_event: req.body.hook?.event,
          contact_first_name: result.contact.first_name,
          contact_last_name: result.contact.last_name,
          contact_company: result.contact.company_name,
          correlation_id: result.correlation_id
        };
        
        // Emit processed webhook event
        webhookEvents.emit('processedWebhook', webhookData);

        return res.status(200).json({
          success: true,
          message: 'Webhook processed successfully',
          data: {
            profile_id: result.profile.id,
            campaign_id: result.campaign.id,
            event_id: result.event.id,
            webhook_id: webhookId,
            correlation_id: result.correlation_id
          }
        });

      } catch (error) {
        lastError = error;
        console.error(`❌ Webhook ${webhookId} attempt ${attempt + 1} failed:`, error.message);
        
        // If this is the last attempt, break out of the loop
        if (attempt === maxRetries - 1) {
          break;
        }
        
        // Wait before retrying (exponential backoff: 1s, 2s, 4s)
        const delay = Math.pow(2, attempt) * 1000;
        console.log(`⏳ Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    // If we get here, all retries failed
    console.error(`❌ Webhook ${webhookId} failed after ${maxRetries} attempts`);
    
    res.status(500).json({
      success: false,
      error: 'Webhook processing failed after multiple attempts',
      message: lastError.message,
      webhook_id: webhookId,
      archived: true,
      retry_count: maxRetries
    });

  } catch (error) {
    console.error(`❌ Unexpected error processing webhook ${webhookId}:`, error);
    
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * GET /api/webhooks/test
 * 
 * Test endpoint to verify webhook receiver is working
 */
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Webhook endpoint is active',
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /api/webhooks/expandi/account/:webhookId/test
 * 
 * Test endpoint for profile-specific webhook URLs
 */
router.get('/expandi/account/:webhookId/test', (req, res) => {
  const { webhookId } = req.params;
  res.json({
    success: true,
    message: `Profile-specific webhook endpoint is active for webhook ${webhookId}`,
    webhookId: webhookId,
    webhookUrl: `/api/webhooks/expandi/account/${webhookId}`,
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
