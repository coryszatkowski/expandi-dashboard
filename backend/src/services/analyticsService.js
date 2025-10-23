/**
 * Analytics Service
 * 
 * Calculates KPIs and aggregates data for dashboards.
 * Handles all business logic for performance metrics.
 */

const { getDatabase } = require('../config/database');
const { format, parseISO, startOfDay, endOfDay } = require('date-fns');

class AnalyticsService {
  /**
   * Get company dashboard data
   * @param {string} companyId - Company UUID
   * @param {Object} options - Filter options
   * @param {string} [options.start_date] - ISO 8601 date
   * @param {string} [options.end_date] - ISO 8601 date
   * @returns {Object} Dashboard data with KPIs and trends
   */
  static getCompanyDashboard(companyId, options = {}) {
    const db = getDatabase();

    // Get all profiles for this company
    const profilesStmt = db.prepare(`
      SELECT * FROM profiles 
      WHERE company_id = ? AND status = 'assigned'
      ORDER BY account_name
    `);
    const profiles = profilesStmt.all(companyId);

    if (profiles.length === 0) {
      return {
        kpis: this.emptyKPIs(),
        activity_timeline: [],
        profiles: []
      };
    }

    const profileIds = profiles.map(p => p.id);

    // Get aggregate KPIs across all profiles
    const kpis = this.getAggregateKPIs(profileIds, options);

    // Get activity timeline
    const timeline = this.getActivityTimeline(profileIds, options);

    // Get per-profile summaries
    const profileSummaries = profiles.map(profile => {
      const profileKPIs = this.getProfileKPIs(profile.id, options);
      return {
        id: profile.id,
        account_name: profile.account_name,
        account_email: profile.account_email,
        ...profileKPIs
      };
    });

    return {
      kpis,
      activity_timeline: timeline,
      profiles: profileSummaries
    };
  }

  /**
   * Get profile dashboard data
   * @param {string} profileId - Profile UUID
   * @param {Object} options - Filter options
   * @returns {Object} Profile dashboard data
   */
  static getProfileDashboard(profileId, options = {}) {
    const db = getDatabase();

    // Get profile information
    const profileStmt = db.prepare(`
      SELECT p.*, c.name as company_name
      FROM profiles p
      LEFT JOIN companies c ON p.company_id = c.id
      WHERE p.id = ?
    `);
    const profile = profileStmt.get(profileId);

    if (!profile) {
      throw new Error('Profile not found');
    }

    // Get profile KPIs
    const kpis = this.getProfileKPIs(profileId, options);

    // Get activity timeline for this profile
    const timeline = this.getActivityTimeline([profileId], options);

    // Get all campaigns for this profile
    const campaignsStmt = db.prepare(`
      SELECT * FROM campaigns 
      WHERE profile_id = ?
      ORDER BY started_at DESC
    `);
    const campaigns = campaignsStmt.all(profileId);

    // Get KPIs for each campaign
    const campaignSummaries = campaigns.map(campaign => {
      const campaignKPIs = this.getCampaignKPIs(campaign.id, options);
      return {
        id: campaign.id,
        campaign_name: campaign.campaign_name,
        campaign_instance: campaign.campaign_instance,
        started_at: campaign.started_at,
        ...campaignKPIs
      };
    });

    return {
      account: {
        id: profile.id,
        account_name: profile.account_name,
        account_email: profile.account_email,
        company_name: profile.company_name
      },
      kpis,
      activity_timeline: timeline,
      campaigns: campaignSummaries
    };
  }

  /**
   * Get campaign dashboard data
   * @param {string} campaignId - Campaign UUID
   * @param {Object} options - Filter options
   * @returns {Object} Campaign dashboard data
   */
  static getCampaignDashboard(campaignId, options = {}) {
    const kpis = this.getCampaignKPIs(campaignId, options);
    const timeline = this.getCampaignTimeline(campaignId, options);
    const contacts = this.getCampaignContacts(campaignId, options);

    return {
      kpis,
      activity_timeline: timeline,
      contacts
    };
  }

  /**
   * Get KPIs for multiple profiles (aggregated)
   * @param {Array<string>} profileIds - Array of profile UUIDs
   * @param {Object} options - Filter options
   * @returns {Object} Aggregate KPIs
   */
  static getAggregateKPIs(profileIds, options = {}) {
    const db = getDatabase();

    if (profileIds.length === 0) {
      return this.emptyKPIs();
    }

    // Build WHERE clause for date filtering
    const { whereClause, params } = this.buildDateFilter(options);

    // Get campaign IDs for these profiles
    const campaignIds = db.prepare(`
      SELECT id FROM campaigns 
      WHERE profile_id IN (${profileIds.map(() => '?').join(',')})
    `).all(...profileIds).map(c => c.id);

    if (campaignIds.length === 0) {
      return this.emptyKPIs();
    }

    // Get aggregate counts based on event types
    const stmt = db.prepare(`
      SELECT 
        COUNT(CASE WHEN event_type = 'invite_sent' THEN 1 END) as invites_sent,
        COUNT(CASE WHEN event_type = 'connection_accepted' THEN 1 END) as connections,
        COUNT(CASE WHEN event_type = 'contact_replied' THEN 1 END) as replies
      FROM events
      WHERE campaign_id IN (${campaignIds.map(() => '?').join(',')})
      ${whereClause}
    `);

    const counts = stmt.get(...campaignIds, ...params);

    return this.calculateRates(counts);
  }

  /**
   * Get KPIs for a single profile
   * @param {string} profileId - Profile UUID
   * @param {Object} options - Filter options
   * @returns {Object} Profile KPIs
   */
  static getProfileKPIs(profileId, options = {}) {
    const db = getDatabase();

    // Get campaign IDs for this profile
    const campaignIds = db.prepare(`
      SELECT id FROM campaigns WHERE profile_id = ?
    `).all(profileId).map(c => c.id);

    if (campaignIds.length === 0) {
      return { ...this.emptyKPIs(), campaigns_count: 0 };
    }

    const { whereClause, params } = this.buildDateFilter(options);

    const stmt = db.prepare(`
      SELECT 
        COUNT(CASE WHEN event_type = 'invite_sent' THEN 1 END) as invites_sent,
        COUNT(CASE WHEN event_type = 'connection_accepted' THEN 1 END) as connections,
        COUNT(CASE WHEN event_type = 'contact_replied' THEN 1 END) as replies
      FROM events
      WHERE campaign_id IN (${campaignIds.map(() => '?').join(',')})
      ${whereClause}
    `);

    const counts = stmt.get(...campaignIds, ...params);

    return {
      ...this.calculateRates(counts),
      campaigns_count: campaignIds.length
    };
  }

  /**
   * Get KPIs for a single campaign
   * @param {string} campaignId - Campaign UUID
   * @param {Object} options - Filter options
   * @returns {Object} Campaign KPIs
   */
  static getCampaignKPIs(campaignId, options = {}) {
    const { whereClause, params } = this.buildDateFilter(options);

    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT 
        COUNT(CASE WHEN event_type = 'invite_sent' THEN 1 END) as invites_sent,
        COUNT(CASE WHEN event_type = 'connection_accepted' THEN 1 END) as connections,
        COUNT(CASE WHEN event_type = 'contact_replied' THEN 1 END) as replies
      FROM events
      WHERE campaign_id = ?
      ${whereClause}
    `);

    const counts = stmt.get(campaignId, ...params);

    return this.calculateRates(counts);
  }

  /**
   * Get activity timeline (daily aggregates) for multiple accounts
   * @param {Array<string>} accountIds - LinkedIn account UUIDs
   * @param {Object} options - Filter options
   * @returns {Array} Timeline data points
   */
  static getActivityTimeline(accountIds, options = {}) {
    const db = getDatabase();

    if (accountIds.length === 0) {
      return [];
    }

    // Get campaign IDs
    const campaignIds = db.prepare(`
      SELECT id FROM campaigns 
      WHERE profile_id IN (${accountIds.map(() => '?').join(',')})
    `).all(...accountIds).map(c => c.id);

    if (campaignIds.length === 0) {
      return [];
    }

    // Build timeline-specific date filter
    const { timelineWhereClause, timelineParams } = this.buildTimelineDateFilter(options);

    // Group by date
    const stmt = db.prepare(`
      SELECT 
        DATE(COALESCE(invited_at, connected_at, replied_at)) as date,
        COUNT(DISTINCT CASE WHEN event_type = 'invite_sent' THEN contact_id END) as invites,
        COUNT(DISTINCT CASE WHEN event_type = 'connection_accepted' THEN contact_id END) as connections,
        COUNT(DISTINCT CASE WHEN event_type = 'contact_replied' THEN contact_id END) as replies
      FROM events
      WHERE campaign_id IN (${campaignIds.map(() => '?').join(',')})
      ${timelineWhereClause}
      AND DATE(COALESCE(invited_at, connected_at, replied_at)) IS NOT NULL
      GROUP BY date
      ORDER BY date ASC
    `);

    return stmt.all(...campaignIds, ...timelineParams);
  }

  /**
   * Get activity timeline for a single campaign
   * @param {string} campaignId - Campaign UUID
   * @param {Object} options - Filter options
   * @returns {Array} Timeline data points
   */
  static getCampaignTimeline(campaignId, options = {}) {
    const db = getDatabase();
    const { whereClause, params } = this.buildDateFilter(options);

    const stmt = db.prepare(`
      SELECT 
        DATE(COALESCE(invited_at, connected_at, replied_at)) as date,
        COUNT(DISTINCT CASE WHEN event_type = 'invite_sent' THEN contact_id END) as invites,
        COUNT(DISTINCT CASE WHEN event_type = 'connection_accepted' THEN contact_id END) as connections,
        COUNT(DISTINCT CASE WHEN event_type = 'contact_replied' THEN contact_id END) as replies
      FROM events
      WHERE campaign_id = ?
      ${whereClause}
      AND DATE(COALESCE(invited_at, connected_at, replied_at)) IS NOT NULL
      GROUP BY date
      ORDER BY date ASC
    `);

    return stmt.all(campaignId, ...params);
  }

  /**
   * Calculate rates (connection rate, response rate)
   * @param {Object} counts - Raw counts object
   * @returns {Object} Counts with calculated rates
   */
  static calculateRates(counts) {
    const invitesSent = counts.invites_sent || 0;
    const connections = counts.connections || 0;
    const replies = counts.replies || 0;

    const connectionRate = invitesSent > 0 ? (connections / invitesSent) * 100 : 0;
    const responseRate = connections > 0 ? (replies / connections) * 100 : 0;

    return {
      total_invites: invitesSent,
      total_connections: connections,
      connection_rate: Math.round(connectionRate * 10) / 10, // Round to 1 decimal
      total_replies: replies,
      response_rate: Math.round(responseRate * 10) / 10 // Round to 1 decimal
    };
  }

  /**
   * Build WHERE clause for date filtering
   * @param {Object} options - Filter options with start_date and end_date
   * @returns {Object} { whereClause: string, params: array }
   */
  static buildDateFilter(options) {
    const params = [];
    let whereClause = '';

    if (options.start_date && options.end_date && options.start_date === options.end_date) {
      // Single day filter: check if any timestamp falls on this date
      whereClause += ' AND (DATE(invited_at) = ? OR DATE(connected_at) = ? OR DATE(replied_at) = ?)';
      params.push(options.start_date, options.start_date, options.start_date);
    } else {
      // Date range filter: check if any timestamp falls within the range
      if (options.start_date) {
        whereClause += ' AND (invited_at >= ? OR connected_at >= ? OR replied_at >= ?)';
        params.push(options.start_date, options.start_date, options.start_date);
      }

      if (options.end_date) {
        whereClause += ' AND (invited_at <= ? OR connected_at <= ? OR replied_at <= ?)';
        params.push(options.end_date, options.end_date, options.end_date);
      }
    }

    return { whereClause, params };
  }

  /**
   * Build WHERE clause for timeline date filtering (uses COALESCE date)
   * @param {Object} options - Filter options with start_date and end_date
   * @returns {Object} { timelineWhereClause: string, timelineParams: array }
   */
  static buildTimelineDateFilter(options) {
    const params = [];
    let whereClause = '';

    if (options.start_date) {
      whereClause += ' AND DATE(COALESCE(invited_at, connected_at, replied_at)) >= ?';
      params.push(options.start_date);
    }

    if (options.end_date) {
      whereClause += ' AND DATE(COALESCE(invited_at, connected_at, replied_at)) <= ?';
      params.push(options.end_date);
    }

    return { timelineWhereClause: whereClause, timelineParams: params };
  }

  /**
   * Return empty KPIs structure
   * @returns {Object} Empty KPIs
   */
  static emptyKPIs() {
    return {
      total_invites: 0,
      total_connections: 0,
      connection_rate: 0,
      total_replies: 0,
      response_rate: 0
    };
  }

  /**
   * Get contacts for a campaign with their progress status
   * @param {string} campaignId - Campaign UUID
   * @param {Object} options - Filter options
   * @returns {Array} Array of contact objects with progress status
   */
  static getCampaignContacts(campaignId, options = {}) {
    const db = getDatabase();
    
    // Get all unique contacts for this campaign
    const contactsStmt = db.prepare(`
      SELECT DISTINCT 
        c.contact_id,
        c.first_name,
        c.last_name,
        c.company_name,
        c.job_title,
        c.email
      FROM contacts c
      WHERE c.campaign_id = ?
      ORDER BY c.first_name, c.last_name
    `);
    
    const contacts = contactsStmt.all(campaignId);
    
    // For each contact, get their progress status
    return contacts.map(contact => {
      // Get the latest event for this contact in this campaign
      const latestEventStmt = db.prepare(`
        SELECT 
          invited_at,
          connected_at,
          replied_at,
          conversation_status
        FROM events 
        WHERE campaign_id = ? AND contact_id = ?
        ORDER BY created_at DESC
        LIMIT 1
      `);
      
      const latestEvent = latestEventStmt.get(campaignId, contact.contact_id);
      
      // Get the invite timestamp from the invite_sent event specifically
      const inviteEventStmt = db.prepare(`
        SELECT invited_at
        FROM events 
        WHERE campaign_id = ? AND contact_id = ? AND event_type = 'invite_sent'
        ORDER BY created_at DESC
        LIMIT 1
      `);
      
      const inviteEvent = inviteEventStmt.get(campaignId, contact.contact_id);
      
      // Get the connection timestamp from the connection_accepted event specifically
      const connectionEventStmt = db.prepare(`
        SELECT connected_at
        FROM events 
        WHERE campaign_id = ? AND contact_id = ? AND event_type = 'connection_accepted'
        ORDER BY created_at DESC
        LIMIT 1
      `);
      
      const connectionEvent = connectionEventStmt.get(campaignId, contact.contact_id);
      
      // Get the reply status from any event (not just latest)
      const replyEventStmt = db.prepare(`
        SELECT replied_at, conversation_status
        FROM events 
        WHERE campaign_id = ? AND contact_id = ? 
        AND (replied_at IS NOT NULL OR conversation_status = 'Replied')
        ORDER BY created_at DESC
        LIMIT 1
      `);
      
      const replyEvent = replyEventStmt.get(campaignId, contact.contact_id);
      
      // Determine the appropriate status based on progress
      let status;
      // Check if replied based on conversation_status (for historical imports) or replied_at (for webhooks)
      const hasReplied = replyEvent?.replied_at || replyEvent?.conversation_status === 'Replied';
      
      if (hasReplied) {
        status = 'Replied';
      } else if (connectionEvent?.connected_at) {
        status = 'Awaiting Reply';
      } else if (inviteEvent?.invited_at) {
        status = 'Pending Connection';
      } else {
        status = 'Not Invited';
      }

      return {
        contact_id: contact.contact_id,
        first_name: contact.first_name,
        last_name: contact.last_name,
        company_name: contact.company_name,
        job_title: contact.job_title,
        email: contact.email,
        invited: !!inviteEvent?.invited_at,
        connected: !!connectionEvent?.connected_at,
        replied: hasReplied,
        invited_at: inviteEvent?.invited_at,
        connected_at: connectionEvent?.connected_at,
        replied_at: replyEvent?.replied_at || null,
        conversation_status: status
      };
    });
  }

  /**
   * Generate CSV export for company dashboard
   * @param {string} companyId - Company UUID
   * @param {Object} options - Filter options
   * @returns {string} CSV string
   */
  static generateCSVExport(companyId, options = {}) {
    const dashboard = this.getCompanyDashboard(companyId, options);

    // CSV headers
    let csv = 'LinkedIn Account,Total Invites,Total Connections,Connection Rate %,Total Replies,Response Rate %\n';

    // Add summary row
    csv += `All Accounts (Total),${dashboard.kpis.total_invites},${dashboard.kpis.total_connections},${dashboard.kpis.connection_rate},${dashboard.kpis.total_replies},${dashboard.kpis.response_rate}\n`;

    // Add per-profile rows
    dashboard.profiles.forEach(profile => {
      csv += `${profile.account_name},${profile.total_invites},${profile.total_connections},${profile.connection_rate},${profile.total_replies},${profile.response_rate}\n`;
    });

    return csv;
  }
}

module.exports = AnalyticsService;
