# Expandi Dashboard - Product Requirements Document

## Project Overview

**Project Name:** Expandi Dashboard  
**Client:** ORION (LinkedIn outreach agency)  
**Purpose:** Create a performance analytics dashboard that shows LinkedIn campaign metrics to clients without exposing internal operational data.

**Problem Statement:**  
ORION uses Expandi.io to run LinkedIn outreach campaigns for multiple clients. They need a way to showcase campaign performance (invites sent, connections made, response rates) to clients without sharing the internal CRM data, raw contact lists, or Make.com automation details.

**Solution:**  
A custom web application that receives Expandi webhook data, aggregates it into campaign performance metrics, and displays it through:
1. **Admin Dashboard** - For ORION to manage companies, LinkedIn accounts, and generate shareable links
2. **Client Dashboard** - Public, no-login dashboards accessible via unique URLs that show KPIs and trends

---

## User Personas

### Primary User: ORION (Admin)
- Manages 6+ client companies (growing 1-2 per month)
- Each company has 1-4 LinkedIn accounts running campaigns
- Needs to assign LinkedIn accounts to companies
- Generates shareable dashboard links for clients
- Monitors overall performance across all campaigns

### Secondary User: ORION's Client (Viewer)
- Receives a shareable URL from ORION
- Views their campaign performance metrics
- No login required
- Only sees data for their company
- Uses dashboard to justify ORION's service value

### Future User: ORION Employee (Limited Admin)
- Will need login access to view specific departments/accounts
- Not included in MVP

---

## Data Hierarchy

```
Company (e.g., "ORION Internal", "RWX", "Travis Consulting")
  └─ LinkedIn Account (e.g., "Tobias Millington", "Simon Teed")
      └─ Campaign (e.g., "2025-10-08+Saul Mawby+A00...")
          └─ Events (invited, connected, replied)
              └─ Contact Data (aggregated for KPIs only, not displayed)
```

**Key Points:**
- Each Company has multiple LinkedIn Accounts
- Each LinkedIn Account has multiple Campaigns
- Each Campaign tracks multiple Events (invites, connections, replies)
- Contact details are stored but NOT displayed to end users

---

## Core Features

### MVP Features (Phase 1) - ✅ COMPLETED

#### 1. Webhook Receiver ✅
- Receives webhooks from Expandi.io for three events:
  - `Connection Request Sent` → captures invite data
  - `Connection Request Accepted` → captures connection data
  - `Contact Replied` → captures reply data
- Auto-creates Profiles and Campaigns from webhook data
- New Profiles default to "Unassigned" status
- **ENHANCED:** Real-time webhook monitoring and logging

#### 2. Admin Dashboard ✅ (WITH AUTHENTICATION)
- **Authentication System** (Added beyond MVP)
  - Admin login/logout functionality
  - Password management
  - Multiple admin user support
  - Settings modal for admin management

- **Company Management**
  - List all companies
  - Create/edit/delete companies
  - Generate shareable dashboard URLs
  - Copy shareable link to clipboard
  
- **Profile Management** (LinkedIn Accounts)
  - View all profiles
  - Assign unassigned profiles to companies
  - Reassign profiles if needed
  - Create new profiles manually
  - Delete profiles
  - View profile statistics

- **System Overview**
  - Total invites, connections, replies across all campaigns
  - List of unassigned profiles (alerts)
  - **ENHANCED:** Real-time webhook activity monitoring
  - **ENHANCED:** System-wide statistics dashboard

#### 3. CSV Backfill System ✅ (Added beyond MVP)
- **Historical Data Import**
  - CSV upload with drag & drop interface
  - Duplicate handling (skip existing or update)
  - Bulk data processing
  - Profile-specific backfill
  - Progress tracking and error handling

#### 3. Client Dashboard (Public, No Login)
- Accessible via unique URL: `https://app.com/c/{companyId}`
- **Company-Level KPIs:**
  - Total Invites Sent
  - Total Connections Accepted
  - Connection Rate %
  - Total Replies
  - Response Rate %
  
- **Activity Chart:**
  - Line/bar chart showing invites and connections over time
  - Configurable date range filter (last 7/30/90 days, all time, custom)
  
- **LinkedIn Account Cards:**
  - List of all LinkedIn accounts under this company
  - Each card shows account-level KPIs
  - Click to drill down to account details
  
- **Export:**
  - CSV export of KPI data

#### 4. LinkedIn Account View (Public, No Login)
- Accessible via drill-down from company dashboard
- Shows all campaigns under that LinkedIn account
- Account-level aggregate KPIs
- Campaign cards with individual metrics

#### 5. Campaign View (Public, No Login)
- Accessible via drill-down from LinkedIn account view
- Campaign-specific KPIs
- Activity timeline for that campaign
- Started date, total contacts processed

---

### Phase 2 Features (Future)

#### ✅ Authentication System - COMPLETED (Added to MVP)
- ✅ Admin login for ORION
- 🔲 Employee accounts with role-based access
- 🔲 Permission levels (view-only, edit, admin)

#### Advanced Analytics
- 🔲 Industry breakdown (from contact company data)
- 🔲 Job title analysis
- 🔲 Company size segmentation
- 🔲 Geographic distribution

#### Contact Tables
- 🔲 Detailed contact lists (filterable, searchable)
- 🔲 Individual contact profiles
- 🔲 Export contact lists

#### Expiring Shareable Links
- 🔲 Time-limited access URLs
- 🔲 Password-protected dashboards

#### CRM Integration
- 🔲 Replace Make.com flows entirely
- 🔲 Push contacts directly to client CRMs from the app

#### Notifications
- 🔲 Weekly performance emails to clients
- 🔲 Alerts for low performance campaigns

---

## 🚨 CURRENT DEPLOYMENT STATUS

### ✅ COMPLETED MIGRATIONS
- **Database:** SQLite → PostgreSQL (Railway)
- **Backend:** Local → Railway deployment
- **Frontend:** Local → Vercel deployment
- **Authentication:** Added to MVP

### 🚧 CURRENT ISSUES
- **Railway PostgreSQL:** Connection stability issues
- **Webhook Testing:** Production endpoint testing
- **Environment:** Post-deployment troubleshooting

### ⚠️ FOR NEW DEVELOPERS
- **DO NOT:** Work on local development while production issues are being resolved
- **Current Focus:** Production environment fixes
- **Active Work:** Railway database connection troubleshooting

---

## Key Metrics & Calculations

### Primary KPIs

| Metric | Formula | Data Source |
|--------|---------|-------------|
| **Invites Sent** | Count of events with `invited_at` timestamp | Webhook: Connection Request Sent |
| **Connections** | Count of events with `connected_at` timestamp | Webhook: Connection Request Accepted |
| **Connection Rate** | (Connections ÷ Invites Sent) × 100 | Calculated |
| **Replies** | Count of events where `conversation_status` != "Awaiting Reply" | Webhook: Contact Replied |
| **Response Rate** | (Replies ÷ Connections) × 100 | Calculated |

### Time-Based Metrics
- Daily/Weekly/Monthly aggregate KPIs
- Trend analysis (week-over-week growth)
- Time-to-connection (average time between invite and acceptance)

---

## Technical Requirements

### Backend
- **Framework:** Node.js + Express
- **Database:** SQLite (local dev), PostgreSQL (production)
- **Hosting:** Railway (production), local for development
- **API:** RESTful JSON API

### Frontend
- **Framework:** React + Vite
- **Styling:** Tailwind CSS
- **Charts:** Recharts
- **Hosting:** Vercel

### Data Storage
- Raw webhook data stored for audit trail
- Aggregated metrics cached for performance
- Shareable URLs stored with company mappings

### Security
- No authentication for MVP
- Unique, unguessable URLs for client dashboards (UUID-based)
- Rate limiting on webhook endpoint
- Input validation on all endpoints

---

## User Flows

### Flow 1: New LinkedIn Account Arrives
1. Expandi sends webhook with new `campaign_instance` containing unknown LinkedIn account name
2. Backend parses webhook, extracts LinkedIn account name
3. Creates new LinkedIn Account record with status "Unassigned"
4. Creates Campaign record under that account
5. Stores event data
6. Admin receives notification (future) or checks admin dashboard
7. Admin assigns LinkedIn account to appropriate company
8. Client dashboard now includes data from that account

### Flow 2: Client Views Dashboard
1. Client receives URL from ORION: `https://app.com/c/abc123`
2. Client opens URL in browser
3. Dashboard loads company-level KPIs for all assigned LinkedIn accounts
4. Client selects date range (e.g., "Last 30 days")
5. Charts update to show filtered data
6. Client clicks on a LinkedIn account card to drill down
7. LinkedIn account view loads with campaign breakdowns
8. Client clicks on specific campaign to see campaign details
9. Client exports data as CSV

### Flow 3: Admin Generates Shareable Link
1. Admin opens admin dashboard
2. Views list of companies
3. Clicks "Get Shareable Link" next to company name
4. Modal displays URL: `https://app.com/c/abc123`
5. Admin clicks "Copy Link"
6. Link copied to clipboard
7. Admin shares link with client via email/Slack

---

## Data Models

### Company ✅ IMPLEMENTED
```javascript
{
  id: uuid,
  name: string,
  share_token: uuid (for shareable URL),
  created_at: timestamp,
  updated_at: timestamp
}
```

### Profile (LinkedIn Account) ✅ IMPLEMENTED
```javascript
{
  id: uuid,
  company_id: uuid (null if unassigned),
  account_name: string,
  account_email: string,
  li_account_id: integer (from Expandi),
  webhook_id: uuid (unique webhook identifier), // ADDED
  status: enum('assigned', 'unassigned'),
  created_at: timestamp,
  updated_at: timestamp
}
```

### Admin User ✅ IMPLEMENTED (Added beyond MVP)
```javascript
{
  id: uuid,
  username: string,
  password_hash: string,
  created_at: timestamp
}
```

### Campaign
```javascript
{
  id: uuid,
  linkedin_account_id: uuid,
  campaign_instance: string (from Expandi),
  campaign_name: string (parsed from campaign_instance),
  started_at: timestamp,
  created_at: timestamp,
  updated_at: timestamp
}
```

### Event
```javascript
{
  id: uuid,
  campaign_id: uuid,
  contact_id: integer (from Expandi),
  event_type: enum('invite_sent', 'connection_accepted', 'contact_replied'),
  event_data: json (raw webhook payload),
  invited_at: timestamp,
  connected_at: timestamp,
  replied_at: timestamp,
  conversation_status: string,
  created_at: timestamp
}
```

### Contact (Minimal - for aggregation only)
```javascript
{
  id: uuid,
  contact_id: integer (from Expandi),
  first_name: string,
  last_name: string,
  company_name: string,
  job_title: string,
  profile_link: string,
  email: string,
  phone: string,
  created_at: timestamp,
  updated_at: timestamp
}
```

---

## API Endpoints

### Webhooks ✅ IMPLEMENTED
- `POST /api/webhooks/expandi` - Receive Expandi webhooks

### Authentication ✅ IMPLEMENTED (Added beyond MVP)
- `POST /api/auth/login` - Admin login
- `POST /api/auth/logout` - Admin logout
- `POST /api/auth/change-password` - Change admin password
- `POST /api/auth/add-admin` - Add new admin user
- `GET /api/auth/admins` - List all admin users

### Admin ✅ IMPLEMENTED
- `GET /api/admin/companies` - List all companies
- `POST /api/admin/companies` - Create company
- `PUT /api/admin/companies/:id` - Update company
- `DELETE /api/admin/companies/:id` - Delete company
- `GET /api/admin/profiles` - List all profiles (LinkedIn accounts)
- `POST /api/admin/profiles` - Create new profile
- `PUT /api/admin/profiles/:id/assign` - Assign profile to company
- `PUT /api/admin/profiles/:id/unassign` - Unassign profile
- `DELETE /api/admin/profiles/:id` - Delete profile
- `GET /api/admin/stats` - System-wide statistics
- `GET /api/admin/webhooks/recent` - Recent webhook activity
- `POST /api/admin/backfill` - CSV backfill historical data

### Client Dashboard ✅ IMPLEMENTED
- `GET /api/dashboard/:shareToken` - Get company dashboard data
- `GET /api/dashboard/:shareToken/linkedin-account/:accountId` - Get account details
- `GET /api/dashboard/:shareToken/campaign/:campaignId` - Get campaign details
- `GET /api/dashboard/:shareToken/export` - Export CSV
- `DELETE /api/dashboard/:shareToken/campaign/:campaignId` - Delete campaign
- `DELETE /api/dashboard/:shareToken/contact/:contactId` - Delete contact

---

## Success Metrics

### Business Goals
- Reduce time ORION spends creating manual reports (from hours to minutes)
- Increase client retention through transparent performance tracking
- Enable data-driven campaign optimization
- Support 2x growth in client base without additional reporting overhead

### Technical Goals
- 99.9% uptime for webhook receiver
- Dashboard load time < 2 seconds
- Support 50+ concurrent users
- Process 10,000+ webhook events per day

---

## Out of Scope (For MVP)

- ❌ User authentication/login system
- ❌ Contact detail pages
- ❌ Direct CRM integrations
- ❌ Email notifications
- ❌ Advanced filtering (by industry, title, etc.)
- ❌ A/B test analysis
- ❌ Message content display
- ❌ Conversation threading
- ❌ Multi-language support
- ❌ Mobile app

---

## Development Phases

### Phase 1: MVP (2-3 weeks)
- ✅ Webhook receiver
- ✅ Database schema
- ✅ Admin dashboard (company & account management)
- ✅ Client dashboard (KPIs + charts)
- ✅ Shareable link generation
- ✅ CSV export
- ✅ Local development setup

### Phase 2: Authentication (1 week)
- 🔲 Admin login system
- 🔲 Employee accounts with roles
- 🔲 Protected admin routes

### Phase 3: Advanced Features (2-3 weeks)
- 🔲 Contact tables
- 🔲 Advanced analytics (industry, title breakdown)
- 🔲 CRM integrations
- 🔲 Email notifications

### Phase 4: Production Deployment (1 week)
- 🔲 Railway backend deployment
- 🔲 Vercel frontend deployment
- 🔲 PostgreSQL migration
- 🔲 Monitoring & error tracking
- 🔲 SSL certificates
- 🔲 Performance optimization

---

## Deployment Strategy

### Local Development
- SQLite database (zero configuration)
- Backend runs on `http://localhost:3001`
- Frontend runs on `http://localhost:5173`
- Use loca.lt to test webhooks

### Production
- Backend: Railway (auto-deploy from GitHub)
- Frontend: Vercel (auto-deploy from GitHub)
- Database: Railway PostgreSQL
- Environment variables managed through platform dashboards

---

## Risk & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Expandi webhook changes format | High | Store raw webhook payload, version webhook processor |
| Database performance with millions of events | Medium | Add indexes, implement data archiving, use read replicas |
| Shareable URLs leaked publicly | Medium | Add optional password protection in Phase 2 |
| Webhook endpoint DDoS | Medium | Rate limiting, authentication token from Expandi |
| Client wants feature outside roadmap | Low | Clear scope documentation, phased roadmap |

---

## Documentation Requirements

All code must include:
- ✅ Inline comments explaining complex logic
- ✅ Function/component documentation
- ✅ README files in each major directory
- ✅ API documentation with example requests/responses
- ✅ Database schema documentation
- ✅ Deployment guides
- ✅ Troubleshooting section

---

## Maintenance Plan

### Regular Tasks
- Weekly: Review unassigned LinkedIn accounts
- Monthly: Database cleanup (archive old events)
- Quarterly: Performance review and optimization
- As needed: Update dependencies, security patches

### Monitoring
- Webhook processing success rate
- API response times
- Database query performance
- Error logs and stack traces
- User dashboard access patterns

---

## Contact & Handoff

**Current Developer:** Claude (AI Assistant)  
**Next Developer:** To be determined (via Cursor IDE)  
**Client Contact:** ORION team  
**Project Status:** MVP in development  
**Last Updated:** October 14, 2025

---

## Appendix

### Expandi Webhook Events
- `linked_in_messenger.campaign_new_contact` - Connection accepted
- Additional events to be configured:
  - Connection request sent
  - Contact replied
  - (Possibly: Post liked, Visit sent)

### Campaign Instance Format
Example: `2025-10-08+Saul Mawby+A00...`
- Format: `{Date}+{LinkedIn Account Name}+{Campaign Code}`
- Used to link events to campaigns and LinkedIn accounts

### Reference Screenshots
- See Expandi dashboard structure (8 LinkedIn accounts across 4 companies)
- Campaign view showing performance metrics
- Available in project documentation folder
