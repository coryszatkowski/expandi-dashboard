/**
 * Dashboard Routes
 * 
 * Public endpoints for client dashboards (no authentication required - uses share tokens)
 */

const express = require('express');
const router = express.Router();
const Company = require('../models/Company');
const Profile = require('../models/Profile');
const Campaign = require('../models/Campaign');
const AnalyticsService = require('../services/analyticsService');

/**
 * GET /api/dashboard/:shareToken
 * 
 * Get company dashboard data by share token
 * Query params: ?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
 */
router.get('/:shareToken', async (req, res) => {
  try {
    const { shareToken } = req.params;

    // Find company by share token
    const company = await Company.findByShareToken(shareToken);

    if (!company) {
      return res.status(404).json({
        success: false,
        error: 'Dashboard not found'
      });
    }

    // Parse date filters
    const options = {};
    if (req.query.start_date) {
      options.start_date = req.query.start_date;
    }
    if (req.query.end_date) {
      options.end_date = req.query.end_date;
    }

    // Get dashboard data
    const dashboard = await AnalyticsService.getCompanyDashboard(company.id, options);

    res.json({
      success: true,
      company: {
        name: company.name
      },
      ...dashboard,
      linkedin_accounts: dashboard.profiles, // Frontend compatibility
      accounts: dashboard.profiles // Alternative frontend compatibility
    });

  } catch (error) {
    console.error('Error fetching dashboard:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard',
      message: error.message
    });
  }
});

/**
 * GET /api/dashboard/:shareToken/earliest-date
 * Get the earliest date with data for this dashboard
 */
router.get('/:shareToken/earliest-date', async (req, res) => {
  try {
    const { shareToken } = req.params;
    
    // Find company by share token
    const company = await Company.findByShareToken(shareToken);
    if (!company) {
      return res.status(404).json({ success: false, error: 'Dashboard not found' });
    }
    
    // Get earliest date for this company
    const earliestDate = await AnalyticsService.getCompanyEarliestDataDate(company.id);
    
    res.json({
      success: true,
      earliest_date: earliestDate
    });
    
  } catch (error) {
    console.error('Error fetching earliest date:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch earliest date'
    });
  }
});

/**
 * Helper function to get profile dashboard data
 */
async function getProfileDashboard(req, res, shareToken, profileId) {
  try {
    // Find company by share token
    const company = await Company.findByShareToken(shareToken);

    if (!company) {
      return res.status(404).json({
        success: false,
        error: 'Dashboard not found'
      });
    }

    // Find Profile
    const profile = await Profile.findById(profileId);

    if (!profile) {
      return res.status(404).json({
        success: false,
        error: 'Profile not found'
      });
    }

    // Verify profile belongs to this company
    if (profile.company_id !== company.id) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized access to this Profile'
      });
    }

    // Parse date filters
    const options = {};
    if (req.query.start_date) {
      options.start_date = req.query.start_date;
    }
    if (req.query.end_date) {
      options.end_date = req.query.end_date;
    }

    // Get profile dashboard data
    const dashboard = await AnalyticsService.getProfileDashboard(profileId, options);

    res.json({
      success: true,
      account: {
        id: profile.id,
        account_name: profile.account_name,
        account_email: profile.account_email,
        company_name: profile.company_name
      },
      ...dashboard
    });
  } catch (error) {
    console.error('Error in getProfileDashboard:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch profile dashboard',
      message: error.message
    });
  }
}

/**
 * GET /api/dashboard/:shareToken/profile/:profileId
 * 
 * Get Profile details
 * Query params: ?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
 */
router.get('/:shareToken/profile/:profileId', async (req, res) => {
  try {
    const { shareToken, profileId } = req.params;
    return await getProfileDashboard(req, res, shareToken, profileId);
  } catch (error) {
    console.error('Error fetching profile dashboard:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch profile dashboard',
      message: error.message
    });
  }
});

/**
 * GET /api/dashboard/:shareToken/linkedin-account/:accountId
 * 
 * Legacy endpoint - redirects to profile endpoint
 * Query params: ?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
 */
router.get('/:shareToken/linkedin-account/:accountId', async (req, res) => {
  try {
    const { shareToken, accountId } = req.params;
    return await getProfileDashboard(req, res, shareToken, accountId);
  } catch (error) {
    console.error('Error fetching profile dashboard:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch profile dashboard',
      message: error.message
    });
  }
});

/**
 * GET /api/dashboard/:shareToken/campaign/:campaignId
 * 
 * Get campaign details
 * Query params: ?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
 */
router.get('/:shareToken/campaign/:campaignId', async (req, res) => {
  try {
    const { shareToken, campaignId } = req.params;

    // Find company by share token
    const company = await Company.findByShareToken(shareToken);

    if (!company) {
      return res.status(404).json({
        success: false,
        error: 'Dashboard not found'
      });
    }

    // Find campaign
    const campaign = await Campaign.findById(campaignId);

    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found'
      });
    }

    // Verify campaign's profile belongs to this company
    if (campaign.company_id !== company.id) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized access to this campaign'
      });
    }

    // Parse filters
    const options = {};
    if (req.query.start_date) options.start_date = req.query.start_date;
    if (req.query.end_date) options.end_date = req.query.end_date;
    if (req.query.search) options.search = req.query.search;
    if (req.query.status) options.status = req.query.status;
    if (req.query.sortBy) options.sortBy = req.query.sortBy;
    if (req.query.sortOrder) options.sortOrder = req.query.sortOrder;

    // Get campaign dashboard data
    const dashboard = await AnalyticsService.getCampaignDashboard(campaignId, options);

    res.json({
      success: true,
      campaign: {
        id: campaign.id,
        campaign_name: campaign.campaign_name,
        campaign_instance: campaign.campaign_instance,
        started_at: campaign.started_at,
        account_name: campaign.account_name
      },
      ...dashboard
    });

  } catch (error) {
    console.error('Error fetching campaign dashboard:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch campaign dashboard',
      message: error.message
    });
  }
});

/**
 * DELETE /api/dashboard/:shareToken/contact/:contactId
 * 
 * Delete a contact and all associated events
 */
router.delete('/:shareToken/contact/:contactId', (req, res) => {
  try {
    const { shareToken, contactId } = req.params;

    // Find company by share token
    const company = Company.findByShareToken(shareToken);

    if (!company) {
      return res.status(404).json({
        success: false,
        error: 'Dashboard not found'
      });
    }

    // TODO: Verify contact belongs to this company's campaigns
    // For now, we'll allow deletion (in production, add proper authorization)

    // Delete contact and all associated events
    const db = require('../config/database').getDatabase();
    
    // Delete events first (due to foreign key constraints)
    const deleteEventsStmt = db.prepare('DELETE FROM events WHERE contact_id = ?');
    const eventsResult = deleteEventsStmt.run(contactId);
    
    // Delete contact
    const deleteContactStmt = db.prepare('DELETE FROM contacts WHERE contact_id = ?');
    const contactResult = deleteContactStmt.run(contactId);

    if (contactResult.changes === 0) {
      return res.status(404).json({
        success: false,
        error: 'Contact not found'
      });
    }

    res.json({
      success: true,
      message: 'Contact deleted successfully',
      deleted_events: eventsResult.changes
    });

  } catch (error) {
    console.error('Error deleting contact:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete contact',
      message: error.message
    });
  }
});

router.delete('/:shareToken/campaign/:campaignId', (req, res) => {
  try {
    const { shareToken, campaignId } = req.params;

    // Find company by share token
    const company = Company.findByShareToken(shareToken);

    if (!company) {
      return res.status(404).json({
        success: false,
        error: 'Dashboard not found'
      });
    }

    // Verify campaign belongs to this company
    const Campaign = require('../models/Campaign');
    const campaign = Campaign.findById(campaignId);
    
    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found'
      });
    }

    if (campaign.company_id !== company.id) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized access to this campaign'
      });
    }

    // Delete campaign (this will also delete all associated events due to CASCADE)
    const deleted = Campaign.delete(campaignId);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found'
      });
    }

    res.json({
      success: true,
      message: 'Campaign deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting campaign:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete campaign',
      message: error.message
    });
  }
});

/**
 * GET /api/dashboard/:shareToken/export
 * 
 * Export dashboard data as CSV
 * Query params: ?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
 */
router.get('/:shareToken/export', async (req, res) => {
  try {
    const { shareToken } = req.params;

    // Find company by share token
    const company = await Company.findByShareToken(shareToken);

    if (!company) {
      return res.status(404).json({
        success: false,
        error: 'Dashboard not found'
      });
    }

    // Parse date filters
    const options = {};
    if (req.query.start_date) {
      options.start_date = req.query.start_date;
    }
    if (req.query.end_date) {
      options.end_date = req.query.end_date;
    }

    // Generate CSV
    const csv = await AnalyticsService.generateCSVExport(company.id, options);

    // Set headers for file download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${company.name}-dashboard-export.csv"`);
    
    res.send(csv);

  } catch (error) {
    console.error('Error exporting dashboard:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export dashboard',
      message: error.message
    });
  }
});

module.exports = router;
