/**
 * Analytics Service
 * 
 * Calculates KPIs and aggregates data for dashboards.
 * Handles all business logic for performance metrics.
 */

const db = require('../utils/databaseHelper');
const { format, parseISO, startOfDay, endOfDay, addDays } = require('date-fns');
const Tag = require('../models/Tag');

class AnalyticsService {
  /**
   * Get company dashboard data
   * @param {string} companyId - Company UUID
   * @param {Object} options - Filter options
   * @param {string} [options.start_date] - ISO 8601 date
   * @param {string} [options.end_date] - ISO 8601 date
   * @returns {Object} Dashboard data with KPIs and trends
   */
  static async getCompanyDashboard(companyId, options = {}) {
    // Get all profiles for this company
    const profiles = await db.selectAll(`
      SELECT * FROM profiles 
      WHERE company_id = ? AND status = 'assigned'
      ORDER BY account_name
    `, [companyId]);

    if (profiles.length === 0) {
      return {
        kpis: this.emptyKPIs(),
        activity_timeline: [],
        profiles: []
      };
    }

    const profileIds = profiles.map(p => p.id);

    // Get aggregate KPIs across all profiles
    const kpis = await this.getAggregateKPIs(profileIds, options);

    // Get activity timeline
    const timeline = await this.getActivityTimeline(profileIds, options);

    // Get per-profile summaries
    const profileSummaries = [];
    for (const profile of profiles) {
      const profileKPIs = await this.getProfileKPIs(profile.id, options);
      profileSummaries.push({
        id: profile.id,
        account_name: profile.account_name,
        account_email: profile.account_email,
        ...profileKPIs
      });
    }

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
  static async getProfileDashboard(profileId, options = {}) {
    // Get profile information
    const profile = await db.selectOne(`
      SELECT p.*, c.name as company_name
      FROM profiles p
      LEFT JOIN companies c ON p.company_id = c.id
      WHERE p.id = ?
    `, [profileId]);

    if (!profile) {
      throw new Error('Profile not found');
    }

    // Get profile KPIs
    const kpis = await this.getProfileKPIs(profileId, options);

    // Get activity timeline for this profile
    const timeline = await this.getActivityTimeline([profileId], options);

    // Get all campaigns for this profile
    const campaigns = await db.selectAll(`
      SELECT * FROM campaigns 
      WHERE profile_id = ?
      ORDER BY started_at DESC
    `, [profileId]);

    // Get KPIs for each campaign
    const campaignSummaries = [];
    for (const campaign of campaigns) {
      const campaignKPIs = await this.getCampaignKPIs(campaign.id, options);
      const tags = await Tag.getForCampaign(campaign.id);
      
      campaignSummaries.push({
        id: campaign.id,
        campaign_name: campaign.campaign_name,
        campaign_instance: campaign.campaign_instance,
        started_at: campaign.started_at,
        ...campaignKPIs,
        tags
      });
    }

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
  static async getCampaignDashboard(campaignId, options = {}) {
    const kpis = await this.getCampaignKPIs(campaignId, options);
    const timeline = await this.getCampaignTimeline(campaignId, options);
    const contacts = await this.getCampaignContacts(campaignId, options);
    const tags = await Tag.getForCampaign(campaignId);

    return {
      kpis,
      activity_timeline: timeline,
      contacts,
      tags
    };
  }

  /**
   * Get KPIs for multiple profiles (aggregated)
   * @param {Array<string>} profileIds - Array of profile UUIDs
   * @param {Object} options - Filter options
   * @returns {Object} Aggregate KPIs
   */
  static async getAggregateKPIs(profileIds, options = {}) {
    if (profileIds.length === 0) {
      return this.emptyKPIs();
    }

    // Build WHERE clause for date filtering
    const { whereClause, params } = this.buildDateFilter(options);

    // Get campaign IDs for these profiles
    const campaigns = await db.selectAll(`
      SELECT id FROM campaigns 
      WHERE profile_id IN (${profileIds.map(() => '?').join(',')})
    `, profileIds);
    const campaignIds = campaigns.map(c => c.id);

    if (campaignIds.length === 0) {
      return this.emptyKPIs();
    }

    // Get aggregate counts based on event types - use DISTINCT for replies
    const counts = await db.selectOne(`
      SELECT 
        COUNT(CASE WHEN event_type = 'invite_sent' THEN 1 END) as invites_sent,
        COUNT(CASE WHEN event_type = 'connection_accepted' THEN 1 END) as connections,
        COUNT(DISTINCT CASE WHEN event_type = 'contact_replied' THEN contact_id END) as replies
      FROM events
      WHERE campaign_id IN (${campaignIds.map(() => '?').join(',')})
      ${whereClause}
    `, [...campaignIds, ...params]);

    return this.calculateRates(counts);
  }

  /**
   * Get KPIs for a single profile
   * @param {string} profileId - Profile UUID
   * @param {Object} options - Filter options
   * @returns {Object} Profile KPIs
   */
  static async getProfileKPIs(profileId, options = {}) {
    // Get campaign IDs for this profile
    const campaigns = await db.selectAll(`
      SELECT id FROM campaigns WHERE profile_id = ?
    `, [profileId]);
    const campaignIds = campaigns.map(c => c.id);

    if (campaignIds.length === 0) {
      return { ...this.emptyKPIs(), campaigns_count: 0 };
    }

    const { whereClause, params } = this.buildDateFilter(options);

    const counts = await db.selectOne(`
      SELECT 
        COUNT(CASE WHEN event_type = 'invite_sent' THEN 1 END) as invites_sent,
        COUNT(CASE WHEN event_type = 'connection_accepted' THEN 1 END) as connections,
        COUNT(DISTINCT CASE WHEN event_type = 'contact_replied' THEN contact_id END) as replies
      FROM events
      WHERE campaign_id IN (${campaignIds.map(() => '?').join(',')})
      ${whereClause}
    `, [...campaignIds, ...params]);

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
  static async getCampaignKPIs(campaignId, options = {}) {
    // Build COUNT conditions that check both event_type AND specific timestamp
    // Use parameterized queries for date conditions
    // IMPORTANT: Parameters must match the order of ? placeholders in the SQL
    // The ? placeholders appear in the COUNT conditions first, then in the WHERE clause
    
    // Build COUNT conditions with parameterized date filters
    // Match the logic used in getCampaignTimeline: count based on timestamp columns, not event_type
    // This ensures consistency with the timeline chart
    let invitesCondition = `invited_at IS NOT NULL`;
    let connectionsCondition = `connected_at IS NOT NULL`;
    let repliesCondition = `replied_at IS NOT NULL`;
    const allParams = [];
    
    if (options.start_date) {
      let startOfDay;
      if (options.start_date.includes('T')) {
        startOfDay = new Date(options.start_date);
      } else {
        startOfDay = new Date(options.start_date + 'T00:00:00');
      }
      if (isNaN(startOfDay.getTime())) {
        throw new Error(`Invalid start_date: ${options.start_date}`);
      }
      // Use space-separated format to match getCampaignTimeline
      // This ensures consistency between KPI counts and timeline chart
      const startUTC = startOfDay.toISOString().replace('T', ' ').replace('Z', '');
      invitesCondition += ` AND invited_at >= ?`;
      connectionsCondition += ` AND connected_at >= ?`;
      repliesCondition += ` AND replied_at >= ?`;
      // These ? appear first in the SQL (in the SELECT COUNT clauses)
      allParams.push(startUTC, startUTC, startUTC);
    }
    
    if (options.end_date) {
      let endOfDay;
      if (options.end_date.includes('T')) {
        endOfDay = new Date(options.end_date);
      } else {
        endOfDay = new Date(options.end_date + 'T23:59:59.999');
      }
      if (isNaN(endOfDay.getTime())) {
        throw new Error(`Invalid end_date: ${options.end_date}`);
      }
      // Use space-separated format to match getCampaignTimeline
      // This ensures consistency between KPI counts and timeline chart
      const endUTC = endOfDay.toISOString().replace('T', ' ').replace('Z', '');
      invitesCondition += ` AND invited_at <= ?`;
      connectionsCondition += ` AND connected_at <= ?`;
      repliesCondition += ` AND replied_at <= ?`;
      // These ? appear after start_date params but before WHERE clause
      allParams.push(endUTC, endUTC, endUTC);
    }
    
    // campaign_id = ? appears last in the SQL (in the WHERE clause)
    allParams.push(campaignId);

    const query = `
      SELECT 
        COUNT(CASE WHEN ${invitesCondition} THEN 1 END) as invites_sent,
        COUNT(CASE WHEN ${connectionsCondition} THEN 1 END) as connections,
        COUNT(DISTINCT CASE WHEN ${repliesCondition} THEN contact_id END) as replies
      FROM events
      WHERE campaign_id = ?
    `;

    // DEBUG: Log query, parameters, and results
    console.log('=== getCampaignKPIs DEBUG ===');
    console.log('campaignId:', campaignId);
    console.log('options:', JSON.stringify(options, null, 2));
    console.log('invitesCondition:', invitesCondition);
    console.log('connectionsCondition:', connectionsCondition);
    console.log('repliesCondition:', repliesCondition);
    console.log('allParams:', JSON.stringify(allParams, null, 2));
    console.log('SQL Query:', query);
    
    // Also get some sample data to see what's actually in the database
    const sampleEvents = await db.selectAll(`
      SELECT 
        event_type,
        invited_at,
        connected_at,
        replied_at,
        contact_id,
        created_at
      FROM events
      WHERE campaign_id = ?
      ORDER BY created_at DESC
      LIMIT 20
    `, [campaignId]);
    console.log('Sample events (last 20):', JSON.stringify(sampleEvents, null, 2));

    const counts = await db.selectOne(query, allParams);
    console.log('Raw counts result:', JSON.stringify(counts, null, 2));
    
    const rates = this.calculateRates(counts);
    console.log('Calculated rates:', JSON.stringify(rates, null, 2));
    console.log('=== END getCampaignKPIs DEBUG ===');

    return rates;
  }

  /**
   * Get activity timeline (daily aggregates) for multiple accounts
   * @param {Array<string>} accountIds - LinkedIn account UUIDs
   * @param {Object} options - Filter options
   * @returns {Array} Timeline data points
   */
  static async getActivityTimeline(accountIds, options = {}) {
    if (accountIds.length === 0) {
      return [];
    }

    // Get campaign IDs
    const campaigns = await db.selectAll(`
      SELECT id FROM campaigns 
      WHERE profile_id IN (${accountIds.map(() => '?').join(',')})
    `, accountIds);
    const campaignIds = campaigns.map(c => c.id);

    if (campaignIds.length === 0) {
      return [];
    }

    // Build date filter for WHERE clause (include events with any timestamp in range)
    let dateWhereClause = '';
    const dateParams = [];
    
    if (options.start_date || options.end_date) {
      let startOfDayUTC = null;
      let endOfDayUTC = null;
      
      if (options.start_date) {
        let startOfDay;
        if (options.start_date.includes('T')) {
          startOfDay = new Date(options.start_date);
        } else {
          startOfDay = new Date(options.start_date + 'T00:00:00');
        }
        if (isNaN(startOfDay.getTime())) {
          throw new Error(`Invalid start_date: ${options.start_date}`);
        }
        startOfDayUTC = startOfDay.toISOString().replace('T', ' ').replace('Z', '');
      }
      
      if (options.end_date) {
        let endOfDay;
        if (options.end_date.includes('T')) {
          endOfDay = new Date(options.end_date);
        } else {
          endOfDay = new Date(options.end_date + 'T23:59:59');
        }
        if (isNaN(endOfDay.getTime())) {
          throw new Error(`Invalid end_date: ${options.end_date}`);
        }
        endOfDayUTC = endOfDay.toISOString().replace('T', ' ').replace('Z', '');
      }
      
      // Include events that have ANY timestamp in the date range
      const conditions = [];
      if (startOfDayUTC && endOfDayUTC) {
        conditions.push(`(invited_at IS NOT NULL AND invited_at >= ? AND invited_at <= ?)`);
        conditions.push(`(connected_at IS NOT NULL AND connected_at >= ? AND connected_at <= ?)`);
        conditions.push(`(replied_at IS NOT NULL AND replied_at >= ? AND replied_at <= ?)`);
        dateParams.push(startOfDayUTC, endOfDayUTC, startOfDayUTC, endOfDayUTC, startOfDayUTC, endOfDayUTC);
      } else if (startOfDayUTC) {
        conditions.push(`(invited_at IS NOT NULL AND invited_at >= ?)`);
        conditions.push(`(connected_at IS NOT NULL AND connected_at >= ?)`);
        conditions.push(`(replied_at IS NOT NULL AND replied_at >= ?)`);
        dateParams.push(startOfDayUTC, startOfDayUTC, startOfDayUTC);
      } else if (endOfDayUTC) {
        conditions.push(`(invited_at IS NOT NULL AND invited_at <= ?)`);
        conditions.push(`(connected_at IS NOT NULL AND connected_at <= ?)`);
        conditions.push(`(replied_at IS NOT NULL AND replied_at <= ?)`);
        dateParams.push(endOfDayUTC, endOfDayUTC, endOfDayUTC);
      }
      
      if (conditions.length > 0) {
        dateWhereClause = ` AND (${conditions.join(' OR ')})`;
      }
    }

    // Build date conditions for filtering
    let startUTC = null;
    let endUTC = null;
    
    if (options.start_date) {
      const startOfDay = new Date(options.start_date + 'T00:00:00');
      startUTC = startOfDay.toISOString().replace('T', ' ').replace('Z', '');
    }
    
    if (options.end_date) {
      const endOfDay = new Date(options.end_date + 'T23:59:59');
      endUTC = endOfDay.toISOString().replace('T', ' ').replace('Z', '');
    }

    // Use database-agnostic date extraction
    const isPostgreSQL = process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('postgres');
    const dateExtract = isPostgreSQL ? `(invited_at::date)` : `DATE(invited_at)`;
    const dateExtractConn = isPostgreSQL ? `(connected_at::date)` : `DATE(connected_at)`;
    const dateExtractRepl = isPostgreSQL ? `(replied_at::date)` : `DATE(replied_at)`;

    // Query each metric type separately to avoid complex UNION parameter binding issues
    const invitesParams = [...campaignIds];
    let invitesWhere = 'invited_at IS NOT NULL';
    if (startUTC) {
      invitesWhere += ' AND invited_at >= ?';
      invitesParams.push(startUTC);
    }
    if (endUTC) {
      invitesWhere += ' AND invited_at <= ?';
      invitesParams.push(endUTC);
    }

    const connectionsParams = [...campaignIds];
    let connectionsWhere = 'connected_at IS NOT NULL';
    if (startUTC) {
      connectionsWhere += ' AND connected_at >= ?';
      connectionsParams.push(startUTC);
    }
    if (endUTC) {
      connectionsWhere += ' AND connected_at <= ?';
      connectionsParams.push(endUTC);
    }

    const repliesParams = [...campaignIds];
    let repliesWhere = 'replied_at IS NOT NULL';
    if (startUTC) {
      repliesWhere += ' AND replied_at >= ?';
      repliesParams.push(startUTC);
    }
    if (endUTC) {
      repliesWhere += ' AND replied_at <= ?';
      repliesParams.push(endUTC);
    }

    // Get data for each metric type separately
    const [invitesData, connectionsData, repliesData] = await Promise.all([
      db.selectAll(`
        SELECT 
          ${dateExtract} as date,
          COUNT(DISTINCT contact_id) as invites
        FROM events
        WHERE campaign_id IN (${campaignIds.map(() => '?').join(',')})
        AND ${invitesWhere}
        GROUP BY ${dateExtract}
        ORDER BY date ASC
      `, invitesParams),
      db.selectAll(`
        SELECT 
          ${dateExtractConn} as date,
          COUNT(DISTINCT contact_id) as connections
        FROM events
        WHERE campaign_id IN (${campaignIds.map(() => '?').join(',')})
        AND ${connectionsWhere}
        GROUP BY ${dateExtractConn}
        ORDER BY date ASC
      `, connectionsParams),
      db.selectAll(`
        SELECT 
          ${dateExtractRepl} as date,
          COUNT(DISTINCT contact_id) as replies
        FROM events
        WHERE campaign_id IN (${campaignIds.map(() => '?').join(',')})
        AND ${repliesWhere}
        GROUP BY ${dateExtractRepl}
        ORDER BY date ASC
      `, repliesParams)
    ]);

    // Combine results by date
    const dateMap = new Map();
    
    invitesData.forEach(row => {
      const dateStr = typeof row.date === 'string' ? row.date : new Date(row.date).toISOString().split('T')[0];
      if (!dateMap.has(dateStr)) {
        dateMap.set(dateStr, { date: dateStr, invites: 0, connections: 0, replies: 0 });
      }
      dateMap.get(dateStr).invites = parseInt(row.invites) || 0;
    });
    
    connectionsData.forEach(row => {
      const dateStr = typeof row.date === 'string' ? row.date : new Date(row.date).toISOString().split('T')[0];
      if (!dateMap.has(dateStr)) {
        dateMap.set(dateStr, { date: dateStr, invites: 0, connections: 0, replies: 0 });
      }
      dateMap.get(dateStr).connections = parseInt(row.connections) || 0;
    });
    
    repliesData.forEach(row => {
      const dateStr = typeof row.date === 'string' ? row.date : new Date(row.date).toISOString().split('T')[0];
      if (!dateMap.has(dateStr)) {
        dateMap.set(dateStr, { date: dateStr, invites: 0, connections: 0, replies: 0 });
      }
      dateMap.get(dateStr).replies = parseInt(row.replies) || 0;
    });

    const actualData = Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));

    // If no date range specified, return actual data
    if (!options.start_date || !options.end_date) {
      return actualData;
    }

    // Generate complete date range with zero values for days with no activity
    const startDate = new Date(options.start_date + 'T00:00:00');
    const endDate = new Date(options.end_date + 'T23:59:59');
    const completeRange = [];
    
    let currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dateString = format(currentDate, 'yyyy-MM-dd');
      
      // Find actual data for this date
      const dayData = actualData.find(d => {
        // Handle both date string and Date object
        const dbDateStr = typeof d.date === 'string' 
          ? d.date 
          : new Date(d.date).toISOString().split('T')[0];
        return dbDateStr === dateString;
      });
      
      completeRange.push({
        date: dateString,
        invites: dayData ? (parseInt(dayData.invites) || 0) : 0,
        connections: dayData ? (parseInt(dayData.connections) || 0) : 0,
        replies: dayData ? (parseInt(dayData.replies) || 0) : 0
      });
      
      currentDate = addDays(currentDate, 1);
    }

    return completeRange;
  }

  /**
   * Get activity timeline for a single campaign
   * @param {string} campaignId - Campaign UUID
   * @param {Object} options - Filter options
   * @returns {Array} Timeline data points
   */
  static async getCampaignTimeline(campaignId, options = {}) {
    // Build date filter for WHERE clause (include events with any timestamp in range)
    let dateWhereClause = '';
    const dateParams = [];
    
    if (options.start_date || options.end_date) {
      let startOfDayUTC = null;
      let endOfDayUTC = null;
      
      if (options.start_date) {
        const startOfDay = new Date(options.start_date + 'T00:00:00');
        startOfDayUTC = startOfDay.toISOString().replace('T', ' ').replace('Z', '');
      }
      
      if (options.end_date) {
        const endOfDay = new Date(options.end_date + 'T23:59:59');
        endOfDayUTC = endOfDay.toISOString().replace('T', ' ').replace('Z', '');
      }
      
      // Include events that have ANY timestamp in the date range
      const conditions = [];
      if (startOfDayUTC && endOfDayUTC) {
        conditions.push(`(invited_at IS NOT NULL AND invited_at >= ? AND invited_at <= ?)`);
        conditions.push(`(connected_at IS NOT NULL AND connected_at >= ? AND connected_at <= ?)`);
        conditions.push(`(replied_at IS NOT NULL AND replied_at >= ? AND replied_at <= ?)`);
        dateParams.push(startOfDayUTC, endOfDayUTC, startOfDayUTC, endOfDayUTC, startOfDayUTC, endOfDayUTC);
      } else if (startOfDayUTC) {
        conditions.push(`(invited_at IS NOT NULL AND invited_at >= ?)`);
        conditions.push(`(connected_at IS NOT NULL AND connected_at >= ?)`);
        conditions.push(`(replied_at IS NOT NULL AND replied_at >= ?)`);
        dateParams.push(startOfDayUTC, startOfDayUTC, startOfDayUTC);
      } else if (endOfDayUTC) {
        conditions.push(`(invited_at IS NOT NULL AND invited_at <= ?)`);
        conditions.push(`(connected_at IS NOT NULL AND connected_at <= ?)`);
        conditions.push(`(replied_at IS NOT NULL AND replied_at <= ?)`);
        dateParams.push(endOfDayUTC, endOfDayUTC, endOfDayUTC);
      }
      
      if (conditions.length > 0) {
        dateWhereClause = ` AND (${conditions.join(' OR ')})`;
      }
    }

    // Build date conditions for each metric type
    let startUTC = null;
    let endUTC = null;
    
    if (options.start_date) {
      const startOfDay = new Date(options.start_date + 'T00:00:00');
      startUTC = startOfDay.toISOString().replace('T', ' ').replace('Z', '');
    }
    
    if (options.end_date) {
      const endOfDay = new Date(options.end_date + 'T23:59:59');
      endUTC = endOfDay.toISOString().replace('T', ' ').replace('Z', '');
    }

    // Use database-agnostic date extraction
    const isPostgreSQL = process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('postgres');
    const dateExtract = isPostgreSQL ? `(invited_at::date)` : `DATE(invited_at)`;
    const dateExtractConn = isPostgreSQL ? `(connected_at::date)` : `DATE(connected_at)`;
    const dateExtractRepl = isPostgreSQL ? `(replied_at::date)` : `DATE(replied_at)`;

    // Query each metric type separately to avoid complex UNION parameter binding issues
    const invitesParams = [campaignId];
    let invitesWhere = 'invited_at IS NOT NULL';
    if (startUTC) {
      invitesWhere += ' AND invited_at >= ?';
      invitesParams.push(startUTC);
    }
    if (endUTC) {
      invitesWhere += ' AND invited_at <= ?';
      invitesParams.push(endUTC);
    }

    const connectionsParams = [campaignId];
    let connectionsWhere = 'connected_at IS NOT NULL';
    if (startUTC) {
      connectionsWhere += ' AND connected_at >= ?';
      connectionsParams.push(startUTC);
    }
    if (endUTC) {
      connectionsWhere += ' AND connected_at <= ?';
      connectionsParams.push(endUTC);
    }

    const repliesParams = [campaignId];
    let repliesWhere = 'replied_at IS NOT NULL';
    if (startUTC) {
      repliesWhere += ' AND replied_at >= ?';
      repliesParams.push(startUTC);
    }
    if (endUTC) {
      repliesWhere += ' AND replied_at <= ?';
      repliesParams.push(endUTC);
    }

    // Get data for each metric type separately
    const [invitesData, connectionsData, repliesData] = await Promise.all([
      db.selectAll(`
        SELECT 
          ${dateExtract} as date,
          COUNT(DISTINCT contact_id) as invites
        FROM events
        WHERE campaign_id = ?
        AND ${invitesWhere}
        GROUP BY ${dateExtract}
        ORDER BY date ASC
      `, invitesParams),
      db.selectAll(`
        SELECT 
          ${dateExtractConn} as date,
          COUNT(DISTINCT contact_id) as connections
        FROM events
        WHERE campaign_id = ?
        AND ${connectionsWhere}
        GROUP BY ${dateExtractConn}
        ORDER BY date ASC
      `, connectionsParams),
      db.selectAll(`
        SELECT 
          ${dateExtractRepl} as date,
          COUNT(DISTINCT contact_id) as replies
        FROM events
        WHERE campaign_id = ?
        AND ${repliesWhere}
        GROUP BY ${dateExtractRepl}
        ORDER BY date ASC
      `, repliesParams)
    ]);

    // Combine results by date
    const dateMap = new Map();
    
    invitesData.forEach(row => {
      const dateStr = typeof row.date === 'string' ? row.date : new Date(row.date).toISOString().split('T')[0];
      if (!dateMap.has(dateStr)) {
        dateMap.set(dateStr, { date: dateStr, invites: 0, connections: 0, replies: 0 });
      }
      dateMap.get(dateStr).invites = parseInt(row.invites) || 0;
    });
    
    connectionsData.forEach(row => {
      const dateStr = typeof row.date === 'string' ? row.date : new Date(row.date).toISOString().split('T')[0];
      if (!dateMap.has(dateStr)) {
        dateMap.set(dateStr, { date: dateStr, invites: 0, connections: 0, replies: 0 });
      }
      dateMap.get(dateStr).connections = parseInt(row.connections) || 0;
    });
    
    repliesData.forEach(row => {
      const dateStr = typeof row.date === 'string' ? row.date : new Date(row.date).toISOString().split('T')[0];
      if (!dateMap.has(dateStr)) {
        dateMap.set(dateStr, { date: dateStr, invites: 0, connections: 0, replies: 0 });
      }
      dateMap.get(dateStr).replies = parseInt(row.replies) || 0;
    });

    const actualData = Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));

    // If no date range specified, return actual data
    if (!options.start_date || !options.end_date) {
      return actualData;
    }

    // Generate complete date range with zero values for days with no activity
    // Treat frontend dates as local dates (not UTC)
    const startDate = new Date(options.start_date + 'T00:00:00');
    const endDate = new Date(options.end_date + 'T23:59:59');
    const completeRange = [];
    
    let currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dateString = format(currentDate, 'yyyy-MM-dd');
      
      // Find actual data for this date
      // Convert database ISO timestamp to yyyy-MM-dd for comparison
      const dayData = actualData.find(d => {
        const dbDate = new Date(d.date).toISOString().split('T')[0];
        return dbDate === dateString;
      });
      
      completeRange.push({
        date: dateString,
        invites: dayData ? parseInt(dayData.invites) : 0,
        connections: dayData ? parseInt(dayData.connections) : 0,
        replies: dayData ? parseInt(dayData.replies) : 0
      });
      
      currentDate = addDays(currentDate, 1);
    }

    return completeRange;
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
   * Build WHERE clause for date filtering (uses event-type-specific timestamps)
   * @param {Object} options - Filter options with start_date and end_date
   * @returns {Object} { whereClause: string, params: array }
   */
  static buildDateFilter(options) {
    const params = [];
    let whereClause = '';

    if (options.start_date) {
      // Handle both yyyy-MM-dd and ISO format dates
      let startOfDay;
      if (options.start_date.includes('T')) {
        // Already an ISO date, use it directly
        startOfDay = new Date(options.start_date);
      } else {
        // yyyy-MM-dd format, append time
        startOfDay = new Date(options.start_date + 'T00:00:00');
      }
      
      // Validate the date
      if (isNaN(startOfDay.getTime())) {
        throw new Error(`Invalid start_date: ${options.start_date}`);
      }
      
      const startOfDayUTC = startOfDay.toISOString().replace('T', ' ').replace('Z', '');
      
      // Filter each event type by its corresponding timestamp
      whereClause += ` AND (
        (event_type = 'invite_sent' AND invited_at >= ?) OR
        (event_type = 'connection_accepted' AND connected_at >= ?) OR
        (event_type = 'contact_replied' AND replied_at >= ?)
      )`;
      params.push(startOfDayUTC, startOfDayUTC, startOfDayUTC);
    }

    if (options.end_date) {
      // Handle both yyyy-MM-dd and ISO format dates
      let endOfDay;
      if (options.end_date.includes('T')) {
        // Already an ISO date, use it directly
        endOfDay = new Date(options.end_date);
      } else {
        // yyyy-MM-dd format, append time
        endOfDay = new Date(options.end_date + 'T23:59:59');
      }
      
      // Validate the date
      if (isNaN(endOfDay.getTime())) {
        throw new Error(`Invalid end_date: ${options.end_date}`);
      }
      
      const endOfDayUTC = endOfDay.toISOString().replace('T', ' ').replace('Z', '');
      
      // Filter each event type by its corresponding timestamp
      whereClause += ` AND (
        (event_type = 'invite_sent' AND invited_at <= ?) OR
        (event_type = 'connection_accepted' AND connected_at <= ?) OR
        (event_type = 'contact_replied' AND replied_at <= ?)
      )`;
      params.push(endOfDayUTC, endOfDayUTC, endOfDayUTC);
    }

    return { whereClause, params };
  }

  /**
   * Get the earliest date with actual data for an account
   * @param {string} accountId - Account UUID
   * @returns {string|null} Earliest date with data in yyyy-MM-dd format, or null if no data
   */
  static async getEarliestDataDate(accountId) {
    const campaigns = await db.selectAll(`
      SELECT id FROM campaigns 
      WHERE profile_id = ?
    `, [accountId]);
    
    if (campaigns.length === 0) {
      return null;
    }
    
    const campaignIds = campaigns.map(c => c.id);
    
    // Find earliest date - check all timestamps, not just by event_type
    // Use UNION to get all timestamps, then MIN (works for both SQLite and PostgreSQL)
    const result = await db.selectOne(`
      SELECT MIN(date_val) as earliest_date
      FROM (
        SELECT invited_at as date_val FROM events 
        WHERE campaign_id IN (${campaignIds.map(() => '?').join(',')}) AND invited_at IS NOT NULL
        UNION ALL
        SELECT connected_at as date_val FROM events 
        WHERE campaign_id IN (${campaignIds.map(() => '?').join(',')}) AND connected_at IS NOT NULL
        UNION ALL
        SELECT replied_at as date_val FROM events 
        WHERE campaign_id IN (${campaignIds.map(() => '?').join(',')}) AND replied_at IS NOT NULL
      ) all_dates
    `, [...campaignIds, ...campaignIds, ...campaignIds]);
    
    if (result?.earliest_date) {
      // Return as yyyy-MM-dd format
      const date = new Date(result.earliest_date);
      return format(date, 'yyyy-MM-dd');
    }
    
    return null;
  }

  /**
   * Get the earliest date with actual data for a company (across all accounts)
   * @param {string} companyId - Company UUID
   * @returns {string|null} Earliest date with data in yyyy-MM-dd format, or null if no data
   */
  static async getCompanyEarliestDataDate(companyId) {
    const profiles = await db.selectAll(`
      SELECT id FROM profiles 
      WHERE company_id = ? AND status = 'assigned'
    `, [companyId]);
    
    if (profiles.length === 0) {
      return null;
    }
    
    const profileIds = profiles.map(p => p.id);
    
    // Get all campaigns for these profiles
    const campaigns = await db.selectAll(`
      SELECT id FROM campaigns 
      WHERE profile_id IN (${profileIds.map(() => '?').join(',')})
    `, profileIds);
    
    if (campaigns.length === 0) {
      return null;
    }
    
    const campaignIds = campaigns.map(c => c.id);
    
    // Find earliest date across all events - check all timestamps, not just by event_type
    // Use UNION to get all timestamps, then MIN (works for both SQLite and PostgreSQL)
    const result = await db.selectOne(`
      SELECT MIN(date_val) as earliest_date
      FROM (
        SELECT invited_at as date_val FROM events 
        WHERE campaign_id IN (${campaignIds.map(() => '?').join(',')}) AND invited_at IS NOT NULL
        UNION ALL
        SELECT connected_at as date_val FROM events 
        WHERE campaign_id IN (${campaignIds.map(() => '?').join(',')}) AND connected_at IS NOT NULL
        UNION ALL
        SELECT replied_at as date_val FROM events 
        WHERE campaign_id IN (${campaignIds.map(() => '?').join(',')}) AND replied_at IS NOT NULL
      ) all_dates
    `, [...campaignIds, ...campaignIds, ...campaignIds]);
    
    if (result?.earliest_date) {
      // Return as yyyy-MM-dd format
      const date = new Date(result.earliest_date);
      return format(date, 'yyyy-MM-dd');
    }
    
    return null;
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
   * Get contacts for a campaign with their progress status, filtering, and sorting
   * @param {string} campaignId - Campaign UUID
   * @param {Object} options - Filter options
   * @returns {Array} Array of contact objects with progress status
   */
  static async getCampaignContacts(campaignId, options = {}) {
    const { search, status: statusFilter, sortBy, sortOrder, start_date, end_date } = options;

    // Build date filter clause (matching timeline approach - check if any timestamp is in range)
    let dateWhereClause = '';
    const dateParams = [];
    
    if (start_date) {
      const startOfDay = new Date(start_date + 'T00:00:00');
      const startUTC = startOfDay.toISOString();
      dateWhereClause += ` AND (
        (invited_at IS NOT NULL AND invited_at >= ?) OR
        (connected_at IS NOT NULL AND connected_at >= ?) OR
        (replied_at IS NOT NULL AND replied_at >= ?)
      )`;
      dateParams.push(startUTC, startUTC, startUTC);
    }

    if (end_date) {
      const endOfDay = new Date(end_date + 'T23:59:59');
      const endUTC = endOfDay.toISOString();
      const endClause = ` AND (
        (invited_at IS NOT NULL AND invited_at <= ?) OR
        (connected_at IS NOT NULL AND connected_at <= ?) OR
        (replied_at IS NOT NULL AND replied_at <= ?)
      )`;
      dateWhereClause += endClause;
      dateParams.push(endUTC, endUTC, endUTC);
    }

    // Get all unique contacts for this campaign
    // Base query
    let query = `
      SELECT DISTINCT 
        c.contact_id,
        c.first_name,
        c.last_name,
        c.company_name,
        c.job_title,
        c.email
      FROM contacts c
      WHERE c.campaign_id = ?
    `;
    
    const params = [campaignId];

    // Apply search filter
    if (search) {
      const searchTerm = `%${search.toLowerCase()}%`;
      if (db.isPostgreSQL) {
        query += ` AND (
          LOWER(c.first_name) LIKE ? OR 
          LOWER(c.last_name) LIKE ? OR 
          LOWER(c.company_name) LIKE ?
        )`;
      } else {
        query += ` AND (
          LOWER(c.first_name) LIKE ? OR 
          LOWER(c.last_name) LIKE ? OR 
          LOWER(c.company_name) LIKE ?
        )`;
      }
      params.push(searchTerm, searchTerm, searchTerm);
    }

    query += ` ORDER BY c.first_name, c.last_name`;

    const contacts = await db.selectAll(query, params);
    
    // Batch fetch tags for all contacts in this campaign
    const contactTagsMap = await Tag.getForContactsInCampaign(campaignId);

    // For each contact, get their progress status
    let contactsWithStatus = [];
    for (const contact of contacts) {
      // Get the invite timestamp from the invite_sent event specifically
      // Don't filter by date range - show all timestamps for contacts that have events in range
      const inviteEvent = await db.selectOne(`
        SELECT invited_at
        FROM events 
        WHERE campaign_id = ? AND contact_id = ? AND event_type = 'invite_sent'
        ORDER BY created_at DESC
        LIMIT 1
      `, [campaignId, contact.contact_id]);
      
      // Get the connection timestamp from the connection_accepted event specifically
      const connectionEvent = await db.selectOne(`
        SELECT connected_at
        FROM events 
        WHERE campaign_id = ? AND contact_id = ? AND event_type = 'connection_accepted'
        ORDER BY created_at DESC
        LIMIT 1
      `, [campaignId, contact.contact_id]);
      
      // Get the reply status from any event (not just latest)
      const replyEvent = await db.selectOne(`
        SELECT replied_at, conversation_status
        FROM events 
        WHERE campaign_id = ? AND contact_id = ? 
        AND (replied_at IS NOT NULL OR conversation_status = 'Replied')
        ORDER BY created_at DESC
        LIMIT 1
      `, [campaignId, contact.contact_id]);
      
      // Check if contact has at least one event in the date range
      // We need to check the actual timestamps against the date range
      let hasEventInRange = !start_date && !end_date;
      
      if (!hasEventInRange) {
        // Check if any timestamp falls within the date range
        if (inviteEvent?.invited_at) {
          const invitedDate = new Date(inviteEvent.invited_at);
          if ((!start_date || invitedDate >= new Date(start_date + 'T00:00:00')) &&
              (!end_date || invitedDate <= new Date(end_date + 'T23:59:59'))) {
            hasEventInRange = true;
          }
        }
        
        if (!hasEventInRange && connectionEvent?.connected_at) {
          const connectedDate = new Date(connectionEvent.connected_at);
          if ((!start_date || connectedDate >= new Date(start_date + 'T00:00:00')) &&
              (!end_date || connectedDate <= new Date(end_date + 'T23:59:59'))) {
            hasEventInRange = true;
          }
        }
        
        if (!hasEventInRange && replyEvent?.replied_at) {
          const repliedDate = new Date(replyEvent.replied_at);
          if ((!start_date || repliedDate >= new Date(start_date + 'T00:00:00')) &&
              (!end_date || repliedDate <= new Date(end_date + 'T23:59:59'))) {
            hasEventInRange = true;
          }
        }
      }
      
      if (!hasEventInRange) {
        continue; // Skip this contact if no events in date range
      }
      
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

      contactsWithStatus.push({
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
        conversation_status: status,
        tags: contactTagsMap[contact.contact_id] || []
      });
    }
    
    // Apply Status Filtering (in memory since status is derived)
    if (statusFilter && statusFilter !== 'All') {
      contactsWithStatus = contactsWithStatus.filter(c => c.conversation_status === statusFilter);
    }

    // Apply Sorting (in memory since status/dates are derived)
    if (sortBy) {
      contactsWithStatus.sort((a, b) => {
        let valA = a[sortBy];
        let valB = b[sortBy];

        // Handle dates
        if (['invited_at', 'connected_at', 'replied_at'].includes(sortBy)) {
          valA = valA ? new Date(valA).getTime() : 0;
          valB = valB ? new Date(valB).getTime() : 0;
        } 
        // Handle strings
        else if (typeof valA === 'string') {
          valA = valA.toLowerCase();
          valB = valB ? valB.toLowerCase() : '';
        }

        if (valA < valB) return sortOrder === 'desc' ? 1 : -1;
        if (valA > valB) return sortOrder === 'desc' ? -1 : 1;
        return 0;
      });
    }

    return contactsWithStatus;
  }

  /**
   * Get unique contacts for a company (deduplicated)
   * @param {string} companyId - Company UUID
   * @param {Object} options - Filter options
   * @param {string} [options.startDate] - Filter contacts created after this date
   * @param {string} [options.endDate] - Filter contacts created before this date
   * @param {number} [options.limit] - Maximum number of contacts to return
   * @param {number} [options.offset] - Number of contacts to skip
   * @returns {Array} Array of unique contact records
   */
  static async getUniqueContactsForCompany(companyId, options = {}) {
    try {
      const contacts = await Contact.getUniqueContactsForCompany(companyId, options);
      
      // Apply additional filtering if needed
      let filteredContacts = contacts;
      
      if (options.startDate) {
        filteredContacts = filteredContacts.filter(contact => 
          new Date(contact.created_at) >= new Date(options.startDate)
        );
      }
      
      if (options.endDate) {
        filteredContacts = filteredContacts.filter(contact => 
          new Date(contact.created_at) <= new Date(options.endDate)
        );
      }
      
      return filteredContacts;
    } catch (error) {
      console.error('Error getting unique contacts for company:', error);
      throw error;
    }
  }

  /**
   * Generate CSV export for company dashboard
   * @param {string} companyId - Company UUID
   * @param {Object} options - Filter options
   * @returns {string} CSV string
   */
  static async generateCSVExport(companyId, options = {}) {
    const dashboard = await this.getCompanyDashboard(companyId, options);

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
