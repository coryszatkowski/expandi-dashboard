/**
 * Admin Routes
 * 
 * Handles admin operations for managing companies and Profiles.
 * NO AUTHENTICATION IN MVP - will be added in Phase 2
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../utils/databaseHelper');
const Company = require('../models/Company');
const Profile = require('../models/Profile');
const AnalyticsService = require('../services/analyticsService');
const BackfillService = require('../services/backfillService');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `backfill-${uniqueSuffix}.csv`);
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    console.log('File filter - originalname:', file.originalname, 'mimetype:', file.mimetype);
    // Accept CSV files by extension or MIME type
    if (file.originalname && file.originalname.toLowerCase().endsWith('.csv')) {
      cb(null, true);
    } else if (file.mimetype === 'text/csv' || 
               file.mimetype === 'application/csv' ||
               file.mimetype === 'text/plain' ||
               file.mimetype === 'application/vnd.ms-excel') {
      cb(null, true);
    } else {
      console.log('File rejected:', file.originalname, file.mimetype);
      cb(new Error('Only CSV files are allowed'), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// ============================================================================
// BACKFILL ENDPOINTS
// ============================================================================

/**
 * POST /api/admin/backfill
 * 
 * Backfill historical data from CSV file
 * Body: FormData with file, profileId, campaignName, backfillDate, skipExisting, updateExisting
 */
router.post('/backfill', upload.single('file'), async (req, res) => {
  try {
    console.log('Backfill request received:', {
      body: req.body,
      file: req.file ? { originalname: req.file.originalname, mimetype: req.file.mimetype } : null
    });
    
    const { profileId, skipExisting, updateExisting } = req.body;
    const file = req.file;

    // Validate required fields
    if (!file) {
      return res.status(400).json({
        success: false,
        error: 'CSV file is required'
      });
    }

    if (!profileId) {
      return res.status(400).json({
        success: false,
        error: 'profileId is required'
      });
    }


    // Validate profile exists
    const profile = Profile.findById(profileId);
    if (!profile) {
      return res.status(404).json({
        success: false,
        error: 'Profile not found'
      });
    }

    // Process the backfill
    const result = await BackfillService.processHistoricalData({
      profileId,
      filePath: file.path,
      skipExisting: skipExisting === 'true',
      updateExisting: updateExisting === 'true'
    });

    res.json({
      success: true,
      message: `Successfully processed ${result.summary.totalContacts} contacts`,
      data: result
    });

  } catch (error) {
    console.error('Backfill error:', error);
    
    // Clean up uploaded file on error
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupError) {
        console.warn('Failed to clean up file:', cleanupError.message);
      }
    }

    res.status(500).json({
      success: false,
      error: 'Failed to process backfill',
      message: error.message
    });
  }
});

// Error handling middleware for multer
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    console.error('Multer error:', error);
    return res.status(400).json({
      success: false,
      error: 'File upload error',
      message: error.message
    });
  }
  
  if (error.message === 'Only CSV files are allowed') {
    return res.status(400).json({
      success: false,
      error: 'Invalid file type',
      message: 'Please upload a CSV file'
    });
  }
  
  next(error);
});

/**
 * GET /api/admin/backfill/stats/:profileId
 * 
 * Get backfill statistics for a profile
 */
router.get('/backfill/stats/:profileId', (req, res) => {
  try {
    const { profileId } = req.params;
    
    // Validate profile exists
    const profile = Profile.findById(profileId);
    if (!profile) {
      return res.status(404).json({
        success: false,
        error: 'Profile not found'
      });
    }

    const stats = BackfillService.getBackfillStats(profileId);

    res.json({
      success: true,
      stats
    });

  } catch (error) {
    console.error('Error fetching backfill stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch backfill stats',
      message: error.message
    });
  }
});

// ============================================================================
// COMPANIES
// ============================================================================

/**
 * GET /api/admin/companies
 * 
 * Get all companies with their statistics
 */
router.get('/companies', async (req, res) => {
  try {
    const companies = await db.selectAll('SELECT * FROM companies ORDER BY created_at DESC');

    // Get KPIs for each company using AnalyticsService
    const companiesWithKPIs = [];
    for (const company of companies) {
      const kpis = await AnalyticsService.getAggregateKPIs(
        await db.selectAll('SELECT id FROM profiles WHERE company_id = ? AND status = ?', [company.id, 'assigned'])
          .then(profiles => profiles.map(p => p.id))
      );
      
      companiesWithKPIs.push({
        ...company,
        invites_sent: kpis.total_invites,
        connections: kpis.total_connections,
        replies: kpis.total_replies,
        connection_rate: kpis.connection_rate,
        reply_rate: kpis.response_rate
      });
    }

    res.json({
      success: true,
      companies: companiesWithKPIs
    });
  } catch (error) {
    console.error('Error fetching companies:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch companies',
      message: error.message
    });
  }
});

/**
 * GET /api/admin/companies/:id
 * 
 * Get a single company by ID
 */
router.get('/companies/:id', (req, res) => {
  try {
    const company = Company.findById(req.params.id);

    if (!company) {
      return res.status(404).json({
        success: false,
        error: 'Company not found'
      });
    }

    res.json({
      success: true,
      company
    });
  } catch (error) {
    console.error('Error fetching company:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch company',
      message: error.message
    });
  }
});

/**
 * POST /api/admin/companies
 * 
 * Create a new company
 * Body: { "name": "Company Name" }
 */
router.post('/companies', async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Company name is required'
      });
    }

    // Use Company model for consistency

    // Check if company with this name already exists
    const existing = await db.selectOne('SELECT id FROM companies WHERE name = ?', [name]);

    if (existing) {
      return res.status(400).json({
        success: false,
        error: 'Company with this name already exists'
      });
    }

    // Create company using Company model
    const company = await Company.create(name);

    res.status(201).json({
      success: true,
      company
    });
  } catch (error) {
    console.error('Error creating company:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create company',
      message: error.message
    });
  }
});

/**
 * PUT /api/admin/companies/:id
 * 
 * Update a company
 * Body: { "name": "New Company Name" }
 */
router.put('/companies/:id', (req, res) => {
  try {
    const company = Company.findById(req.params.id);

    if (!company) {
      return res.status(404).json({
        success: false,
        error: 'Company not found'
      });
    }

    const updated = Company.update(req.params.id, req.body);

    res.json({
      success: true,
      company: updated
    });
  } catch (error) {
    console.error('Error updating company:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update company',
      message: error.message
    });
  }
});

/**
 * POST /api/admin/companies/:id/regenerate-token
 * 
 * Regenerate share token for a company
 */
router.post('/companies/:id/regenerate-token', (req, res) => {
  try {
    const company = Company.findById(req.params.id);

    if (!company) {
      return res.status(404).json({
        success: false,
        error: 'Company not found'
      });
    }

    const updated = Company.regenerateShareToken(req.params.id);

    res.json({
      success: true,
      company: updated,
      message: 'Share token regenerated successfully'
    });
  } catch (error) {
    console.error('Error regenerating token:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to regenerate token',
      message: error.message
    });
  }
});

/**
 * DELETE /api/admin/companies/:id
 * 
 * Delete a company
 */
router.delete('/companies/:id', (req, res) => {
  try {
    const company = Company.findById(req.params.id);

    if (!company) {
      return res.status(404).json({
        success: false,
        error: 'Company not found'
      });
    }

    const deleted = Company.delete(req.params.id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Company not found'
      });
    }

    res.json({
      success: true,
      message: 'Company deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting company:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete company',
      message: error.message
    });
  }
});

// ============================================================================
// LEGACY LINKEDIN ACCOUNTS ENDPOINTS (for frontend compatibility)
// ============================================================================

/**
 * GET /api/admin/linkedin-accounts
 * Legacy endpoint - redirects to profiles
 */
router.get('/linkedin-accounts', (req, res) => {
  try {
    const filters = {};

    if (req.query.status) {
      filters.status = req.query.status;
    }

    if (req.query.company_id) {
      filters.company_id = req.query.company_id;
    }

    const profiles = Profile.findAll(filters);

    res.json({
      success: true,
      accounts: profiles // Keep 'accounts' key for frontend compatibility
    });
  } catch (error) {
    console.error('Error fetching profiles:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch profiles',
      message: error.message
    });
  }
});

/**
 * GET /api/admin/linkedin-accounts/unassigned
 * Legacy endpoint - redirects to profiles
 */
router.get('/linkedin-accounts/unassigned', async (req, res) => {
  try {
    const profiles = await Profile.findUnassigned();

    res.json({
      success: true,
      accounts: profiles // Keep 'accounts' key for frontend compatibility
    });
  } catch (error) {
    console.error('Error fetching unassigned profiles:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch unassigned profiles',
      message: error.message
    });
  }
});

/**
 * POST /api/admin/linkedin-accounts
 * Legacy endpoint - redirects to profiles
 */
router.post('/linkedin-accounts', (req, res) => {
  try {
    const { account_name, li_account_id, company_id } = req.body;

    // Validate required fields
    if (!account_name) {
      return res.status(400).json({
        success: false,
        error: 'account_name is required'
      });
    }

    // li_account_id is optional (for reference only)
    // Check if Profile with same li_account_id already exists (if provided)
    if (li_account_id) {
      const existingProfile = Profile.findByLiAccountId(li_account_id);
      if (existingProfile) {
        return res.status(409).json({
          success: false,
          error: 'Profile with this LinkedIn account ID already exists',
          existing_profile: existingProfile
        });
      }
    }

    // If company_id is provided, verify it exists
    if (company_id) {
      const company = Company.findById(company_id);
      if (!company) {
        return res.status(404).json({
          success: false,
          error: 'Company not found'
        });
      }
    }

    // Create the Profile (webhook_id will be auto-generated)
    const profile = Profile.create({
      account_name,
      li_account_id: li_account_id || null,
      company_id: company_id || null
    });

    res.status(201).json({
      success: true,
      account: profile, // Keep 'account' key for frontend compatibility
      message: 'Profile created successfully',
      webhook_url: `${req.protocol}://${req.get('host')}/api/webhooks/expandi/account/${profile.webhook_id}`
    });
  } catch (error) {
    console.error('Error creating Profile:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create Profile',
      message: error.message
    });
  }
});

/**
 * PUT /api/admin/linkedin-accounts/:id/assign
 * Legacy endpoint - redirects to profiles
 */
router.put('/linkedin-accounts/:id/assign', (req, res) => {
  try {
    const { id } = req.params;
    const { company_id } = req.body;

    if (!company_id) {
      return res.status(400).json({
        success: false,
        error: 'company_id is required'
      });
    }

    // Verify company exists
    const company = Company.findById(company_id);
    if (!company) {
      return res.status(404).json({
        success: false,
        error: 'Company not found'
      });
    }

    // Assign profile to company
    const profile = Profile.assignToCompany(id, company_id);

    if (!profile) {
      return res.status(404).json({
        success: false,
        error: 'Profile not found'
      });
    }

    res.json({
      success: true,
      account: profile, // Keep 'account' key for frontend compatibility
      message: 'Profile assigned to company successfully'
    });
  } catch (error) {
    console.error('Error assigning profile:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to assign profile',
      message: error.message
    });
  }
});

/**
 * PUT /api/admin/linkedin-accounts/:id/unassign
 * Legacy endpoint - redirects to profiles
 */
router.put('/linkedin-accounts/:id/unassign', (req, res) => {
  try {
    const { id } = req.params;

    const profile = Profile.unassign(id);

    if (!profile) {
      return res.status(404).json({
        success: false,
        error: 'Profile not found'
      });
    }

    res.json({
      success: true,
      account: profile, // Keep 'account' key for frontend compatibility
      message: 'Profile unassigned successfully'
    });
  } catch (error) {
    console.error('Error unassigning profile:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to unassign profile',
      message: error.message
    });
  }
});

/**
 * DELETE /api/admin/linkedin-accounts/:id
 * Legacy endpoint - redirects to profiles
 */
router.delete('/linkedin-accounts/:id', (req, res) => {
  try {
    const { id } = req.params;

    const deleted = Profile.delete(id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Profile not found'
      });
    }

    res.json({
      success: true,
      message: 'Profile deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting profile:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete profile',
      message: error.message
    });
  }
});

// ============================================================================
// PROFILES (new endpoints)
// ============================================================================

/**
 * GET /api/admin/profiles
 * 
 * Get all Profiles with optional filters
 * Query params: ?status=assigned|unassigned&company_id=uuid
 */
router.get('/profiles', async (req, res) => {
  try {
    const filters = {};

    if (req.query.status) {
      filters.status = req.query.status;
    }

    if (req.query.company_id) {
      filters.company_id = req.query.company_id;
    }

    const profiles = await Profile.findAll(filters);

    res.json({
      success: true,
      profiles
    });
  } catch (error) {
    console.error('Error fetching Profiles:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch Profiles',
      message: error.message
    });
  }
});

/**
 * GET /api/admin/profiles/unassigned
 * 
 * Get all unassigned Profiles
 */
router.get('/profiles/unassigned', async (req, res) => {
  try {
    const profiles = await Profile.findUnassigned();

    res.json({
      success: true,
      profiles
    });
  } catch (error) {
    console.error('Error fetching unassigned profiles:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch unassigned profiles',
      message: error.message
    });
  }
});

/**
 * PUT /api/admin/profiles/:id/assign
 * 
 * Assign a Profile to a company
 * Body: { "company_id": "uuid" }
 */
router.put('/profiles/:id/assign', (req, res) => {
  try {
    const { company_id } = req.body;

    if (!company_id) {
      return res.status(400).json({
        success: false,
        error: 'company_id is required'
      });
    }

    // Verify company exists
    const company = Company.findById(company_id);
    if (!company) {
      return res.status(404).json({
        success: false,
        error: 'Company not found'
      });
    }

    // Verify account exists
    const account = Profile.findById(req.params.id);
    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'Profile not found'
      });
    }

    // Assign account to company
    const updated = Profile.assignToCompany(req.params.id, company_id);

    res.json({
      success: true,
      account: updated,
      message: 'Profile assigned successfully'
    });
  } catch (error) {
    console.error('Error assigning account:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to assign account',
      message: error.message
    });
  }
});

/**
 * PUT /api/admin/profiles/:id/unassign
 * 
 * Unassign a Profile from its company
 */
router.put('/profiles/:id/unassign', (req, res) => {
  try {
    const account = Profile.findById(req.params.id);

    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'Profile not found'
      });
    }

    const updated = Profile.unassign(req.params.id);

    res.json({
      success: true,
      account: updated,
      message: 'Profile unassigned successfully'
    });
  } catch (error) {
    console.error('Error unassigning account:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to unassign account',
      message: error.message
    });
  }
});

/**
 * POST /api/admin/profiles
 * 
 * Create a new Profile manually
 * Body: { "account_name": "string", "li_account_id": number, "company_id": "uuid" (optional) }
 */
router.post('/profiles', (req, res) => {
  try {
    const { account_name, li_account_id, company_id } = req.body;

    // Validate required fields
    if (!account_name) {
      return res.status(400).json({
        success: false,
        error: 'account_name is required'
      });
    }

    // li_account_id is optional (for reference only)
    // Check if Profile with same li_account_id already exists (if provided)
    if (li_account_id) {
      const existingProfile = Profile.findByLiAccountId(li_account_id);
      if (existingProfile) {
        return res.status(409).json({
          success: false,
          error: 'Profile with this LinkedIn account ID already exists',
          existing_profile: existingProfile
        });
      }
    }

    // If company_id is provided, verify it exists
    if (company_id) {
      const company = Company.findById(company_id);
      if (!company) {
        return res.status(404).json({
          success: false,
          error: 'Company not found'
        });
      }
    }

    // Create the Profile (webhook_id will be auto-generated)
    const profile = Profile.create({
      account_name,
      li_account_id: li_account_id || null,
      company_id: company_id || null
    });

    res.status(201).json({
      success: true,
      profile,
      message: 'Profile created successfully',
      webhook_url: `${req.protocol}://${req.get('host')}/api/webhooks/expandi/account/${profile.webhook_id}`
    });
  } catch (error) {
    console.error('Error creating Profile:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create Profile',
      message: error.message
    });
  }
});

/**
 * DELETE /api/admin/profiles/:id
 * 
 * Delete a Profile
 */
router.delete('/profiles/:id', (req, res) => {
  try {
    const { id } = req.params;

    // Check if account exists
    const account = Profile.findById(id);
    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'Profile not found'
      });
    }

    // Delete the account
    const deleted = Profile.delete(id);

    res.json({
      success: true,
      message: 'Profile deleted successfully',
      deleted_account: deleted
    });
  } catch (error) {
    console.error('Error deleting Profile:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete Profile',
      message: error.message
    });
  }
});

/**
 * GET /api/admin/stats
 * 
 * Get system-wide statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const companies = await Company.findAll();
    const allAccounts = await Profile.findAll();
    const unassignedAccounts = await Profile.findUnassigned();

    res.json({
      success: true,
      stats: {
        total_companies: companies.length,
        total_profiles: allAccounts.length,
        assigned_profiles: allAccounts.filter(a => a.status === 'assigned').length,
        unassigned_profiles: unassignedAccounts.length,
        total_campaigns: allAccounts.reduce((sum, a) => sum + a.campaigns_count, 0)
      }
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch stats',
      message: error.message
    });
  }
});

// ============================================================================
// WEBHOOK MONITORING (TEMPORARY)
// ============================================================================

// Store active SSE connections for real-time webhook monitoring
const webhookClients = new Set();

// Listen for webhook events
if (global.webhookEvents) {
  global.webhookEvents.on('rawWebhook', (rawWebhookData) => {
    broadcastRawWebhook(rawWebhookData);
  });
  
  global.webhookEvents.on('processedWebhook', (webhookData) => {
    broadcastWebhook(webhookData);
  });
}

/**
 * GET /api/admin/webhooks/stream
 * 
 * Server-Sent Events endpoint for real-time webhook monitoring
 */
router.get('/webhooks/stream', async (req, res) => {
  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  // Send initial connection message
  res.write('data: {"type": "connected", "message": "Webhook stream connected"}\n\n');

  // Add client to the set
  webhookClients.add(res);

  // Handle client disconnect
  req.on('close', () => {
    webhookClients.delete(res);
  });

  // Send recent webhooks on connection
  try {
    // Use database helper
    const recentEvents = await db.selectAll(`
      SELECT 
        e.id,
        e.event_type,
        e.created_at,
        e.invited_at,
        e.connected_at,
        e.replied_at,
        e.conversation_status,
        c.campaign_name,
        c.campaign_instance,
        la.account_name,
        la.li_account_id,
        co.name as company_name,
        json_extract(e.event_data, '$.hook.event') as expandi_event,
        json_extract(e.event_data, '$.contact.first_name') as contact_first_name,
        json_extract(e.event_data, '$.contact.last_name') as contact_last_name,
        json_extract(e.event_data, '$.contact.company_name') as contact_company
      FROM events e
      JOIN campaigns c ON e.campaign_id = c.id
      JOIN profiles la ON c.profile_id = la.id
      LEFT JOIN companies co ON la.company_id = co.id
      ORDER BY e.created_at DESC
      LIMIT 20
    `);
    
    res.write(`data: ${JSON.stringify({ type: 'recent', webhooks: recentEvents })}\n\n`);
  } catch (error) {
    console.error('Error sending recent webhooks:', error);
  }
});

/**
 * GET /api/admin/webhooks/recent
 * 
 * Get recent webhook events for monitoring (fallback)
 */
router.get('/webhooks/recent', async (req, res) => {
  try {
    // Use database helper
    
    // Get recent events with campaign and account info
    const recentEvents = await db.selectAll(`
      SELECT 
        e.id,
        e.event_type,
        e.created_at,
        e.invited_at,
        e.connected_at,
        e.replied_at,
        e.conversation_status,
        c.campaign_name,
        c.campaign_instance,
        la.account_name,
        la.li_account_id,
        co.name as company_name,
        json_extract(e.event_data, '$.hook.event') as expandi_event,
        json_extract(e.event_data, '$.contact.first_name') as contact_first_name,
        json_extract(e.event_data, '$.contact.last_name') as contact_last_name,
        json_extract(e.event_data, '$.contact.company_name') as contact_company
      FROM events e
      JOIN campaigns c ON e.campaign_id = c.id
      JOIN profiles la ON c.profile_id = la.id
      LEFT JOIN companies co ON la.company_id = co.id
      ORDER BY e.created_at DESC
      LIMIT 50
    `);
    
    res.json({
      success: true,
      webhooks: recentEvents
    });
  } catch (error) {
    console.error('Error fetching recent webhooks:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch recent webhooks',
      message: error.message
    });
  }
});

// Export function to broadcast webhook events to all connected clients
const broadcastWebhook = (webhookData) => {
  const message = `data: ${JSON.stringify({ type: 'new_webhook', webhook: webhookData })}\n\n`;
  webhookClients.forEach(client => {
    try {
      client.write(message);
    } catch (error) {
      // Remove dead connections
      webhookClients.delete(client);
    }
  });
};

// Export function to broadcast raw webhook data to all connected clients
const broadcastRawWebhook = (rawWebhookData) => {
  const message = `data: ${JSON.stringify({ type: 'raw_webhook', rawWebhook: rawWebhookData })}\n\n`;
  webhookClients.forEach(client => {
    try {
      client.write(message);
    } catch (error) {
      // Remove dead connections
      webhookClients.delete(client);
    }
  });
};

// Make broadcast functions available to other modules
module.exports.broadcastWebhook = broadcastWebhook;
module.exports.broadcastRawWebhook = broadcastRawWebhook;

module.exports = router;
