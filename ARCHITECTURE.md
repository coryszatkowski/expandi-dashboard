# Expandi Dashboard - Technical Architecture

## System Overview

The Expandi Dashboard is a full-stack web application built with a decoupled architecture:
- **Backend:** RESTful API (Node.js + Express)
- **Frontend:** Single Page Application (React + Vite)
- **Database:** SQLite (development) / PostgreSQL (production)

```
┌─────────────────────────────────────────────────────────────────┐
│                         EXPANDI.IO                              │
│                    (LinkedIn Automation)                         │
└──────────────────────┬──────────────────────────────────────────┘
                       │ Webhooks (HTTP POST)
                       │ - Connection Request Sent
                       │ - Connection Request Accepted  
                       │ - Contact Replied
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                     BACKEND (Node.js/Express)                   │
│                                                                 │
│  ┌────────────────────────────────────────────────────────┐   │
│  │ Webhook Receiver (/api/webhooks/expandi)              │   │
│  │  - Validates payload                                    │   │
│  │  - Parses campaign_instance                            │   │
│  │  - Creates/updates records                             │   │
│  └────────────────────┬───────────────────────────────────┘   │
│                       │                                          │
│  ┌────────────────────▼───────────────────────────────────┐   │
│  │ Webhook Processor Service                              │   │
│  │  - LinkedIn Account auto-creation                      │   │
│  │  - Campaign auto-creation                              │   │
│  │  - Event logging                                       │   │
│  │  - Contact upsert                                      │   │
│  └────────────────────┬───────────────────────────────────┘   │
│                       │                                          │
│  ┌────────────────────▼───────────────────────────────────┐   │
│  │ Database (SQLite/PostgreSQL)                           │   │
│  │  - companies                                            │   │
│  │  - linkedin_accounts                                    │   │
│  │  - campaigns                                            │   │
│  │  - events                                               │   │
│  │  - contacts                                             │   │
│  └────────────────────┬───────────────────────────────────┘   │
│                       │                                          │
│  ┌────────────────────▼───────────────────────────────────┐   │
│  │ Analytics Service                                       │   │
│  │  - KPI calculations                                     │   │
│  │  - Time-series aggregations                            │   │
│  │  - Export generation                                    │   │
│  └────────────────────┬───────────────────────────────────┘   │
│                       │                                          │
│  ┌────────────────────▼───────────────────────────────────┐   │
│  │ REST API                                                │   │
│  │  - /api/admin/*        (company/account management)    │   │
│  │  - /api/dashboard/*    (client dashboard data)         │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                                 │
└──────────────────────┬──────────────────────────────────────────┘
                       │ HTTP/JSON
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                    FRONTEND (React + Vite)                      │
│                                                                 │
│  ┌────────────────────────────────────────────────────────┐   │
│  │ Admin Dashboard (/admin)                               │   │
│  │  - Company List                                         │   │
│  │  - LinkedIn Account Assignment                         │   │
│  │  - Shareable Link Generation                           │   │
│  │  - System Overview                                      │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌────────────────────────────────────────────────────────┐   │
│  │ Client Dashboard (/c/:shareToken)                      │   │
│  │  - Company KPIs                                         │   │
│  │  - Activity Charts                                      │   │
│  │  - LinkedIn Account Cards                              │   │
│  │  - Date Range Filters                                   │   │
│  │  - CSV Export                                           │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌────────────────────────────────────────────────────────┐   │
│  │ LinkedIn Account View (/c/:token/account/:id)          │   │
│  │  - Account KPIs                                         │   │
│  │  - Campaign List                                        │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌────────────────────────────────────────────────────────┐   │
│  │ Campaign View (/c/:token/campaign/:id)                 │   │
│  │  - Campaign KPIs                                        │   │
│  │  - Activity Timeline                                    │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

### Backend
- **Runtime:** Node.js 18+
- **Framework:** Express.js 4.x
- **Database:** 
  - Development: SQLite3 (better-sqlite3)
  - Production: PostgreSQL (via Railway)
- **ORM:** None (raw SQL for simplicity and performance)
- **Validation:** Joi
- **Environment:** dotenv
- **Date Handling:** date-fns

### Frontend
- **Framework:** React 18+
- **Build Tool:** Vite 5+
- **Router:** React Router 6+
- **Styling:** Tailwind CSS 3+
- **Charts:** Recharts 2+
- **HTTP Client:** Axios
- **State Management:** React Context (no Redux needed for MVP)
- **Date Picker:** react-datepicker
- **Icons:** lucide-react

### Development Tools
- **Testing:** 
  - Backend: Jest
  - Frontend: Vitest + React Testing Library
- **Linting:** ESLint
- **Formatting:** Prettier
- **Version Control:** Git

### Deployment
- **Backend Hosting:** Railway (with PostgreSQL)
- **Frontend Hosting:** Vercel
- **Domain:** TBD
- **SSL:** Auto-managed by platforms

---

## Database Schema

### Entity Relationship Diagram

```
┌──────────────┐         ┌─────────────────────┐
│  companies   │         │  linkedin_accounts  │
├──────────────┤         ├─────────────────────┤
│ id (PK)      │◄────┐   │ id (PK)             │
│ name         │     └───│ company_id (FK)     │
│ share_token  │         │ account_name        │
│ created_at   │         │ account_email       │
│ updated_at   │         │ li_account_id       │
└──────────────┘         │ status              │
                         │ created_at          │
                         │ updated_at          │
                         └─────────────────────┘
                                   │
                                   │ 1:N
                                   ▼
                         ┌─────────────────────┐
                         │    campaigns        │
                         ├─────────────────────┤
                         │ id (PK)             │
                    ┌────│ linkedin_account_id │
                    │    │ campaign_instance   │
                    │    │ campaign_name       │
                    │    │ started_at          │
                    │    │ created_at          │
                    │    │ updated_at          │
                    │    └─────────────────────┘
                    │              │
                    │              │ 1:N
                    │              ▼
                    │    ┌─────────────────────┐
                    │    │      events         │
                    │    ├─────────────────────┤
                    │    │ id (PK)             │
                    │    │ campaign_id (FK)    │
                    │    │ contact_id          │
                    │    │ event_type          │
                    │    │ event_data          │
                    │    │ invited_at          │
                    │    │ connected_at        │
                    │    │ replied_at          │
                    │    │ conversation_status │
                    │    │ created_at          │
                    │    └─────────────────────┘
                    │
                    │    ┌─────────────────────┐
                    │    │     contacts        │
                    │    ├─────────────────────┤
                    └───►│ contact_id (PK)     │
                         │ first_name          │
                         │ last_name           │
                         │ company_name        │
                         │ job_title           │
                         │ profile_link        │
                         │ email               │
                         │ phone               │
                         │ created_at          │
                         │ updated_at          │
                         └─────────────────────┘
```

### Table Specifications

#### companies
```sql
CREATE TABLE companies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  share_token TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

#### linkedin_accounts
```sql
CREATE TABLE linkedin_accounts (
  id TEXT PRIMARY KEY,
  company_id TEXT,
  account_name TEXT NOT NULL,
  account_email TEXT,
  li_account_id INTEGER NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'unassigned',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL
);
```

#### campaigns
```sql
CREATE TABLE campaigns (
  id TEXT PRIMARY KEY,
  linkedin_account_id TEXT NOT NULL,
  campaign_instance TEXT NOT NULL UNIQUE,
  campaign_name TEXT NOT NULL,
  started_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (linkedin_account_id) REFERENCES linkedin_accounts(id) ON DELETE CASCADE
);
```

#### events
```sql
CREATE TABLE events (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  contact_id INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  event_data TEXT NOT NULL,
  invited_at TEXT,
  connected_at TEXT,
  replied_at TEXT,
  conversation_status TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
);
```

#### contacts
```sql
CREATE TABLE contacts (
  contact_id INTEGER PRIMARY KEY,
  first_name TEXT,
  last_name TEXT,
  company_name TEXT,
  job_title TEXT,
  profile_link TEXT,
  email TEXT,
  phone TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### Indexes
```sql
CREATE INDEX idx_linkedin_accounts_company_id ON linkedin_accounts(company_id);
CREATE INDEX idx_campaigns_linkedin_account_id ON campaigns(linkedin_account_id);
CREATE INDEX idx_events_campaign_id ON events(campaign_id);
CREATE INDEX idx_events_contact_id ON events(contact_id);
CREATE INDEX idx_events_invited_at ON events(invited_at);
CREATE INDEX idx_events_connected_at ON events(connected_at);
CREATE INDEX idx_events_replied_at ON events(replied_at);
```

---

## API Design

### Webhook Endpoint

#### `POST /api/webhooks/expandi`
Receives webhooks from Expandi.io

**Request Body (Example):**
```json
{
  "hook": {
    "event": "linked_in_messenger.campaign_new_contact",
    "fired_datetime": "2025-10-14 17:50:33.104655+00:00"
  },
  "contact": {
    "id": 4172388,
    "first_name": "Rob",
    "last_name": "Carpenter",
    "company_name": "Trucksafe",
    "email": "robert@example.com"
  },
  "messenger": {
    "li_account": 156241,
    "connected_at": "2025-10-14 17:50:25.912925+00:00",
    "campaign_instance": "2025-09-12+Tobias Millington+A001+M004",
    "conversation_status": "Awaiting Reply"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Webhook processed successfully"
}
```

### Admin Endpoints

#### `GET /api/admin/companies`
List all companies

**Response:**
```json
{
  "companies": [
    {
      "id": "uuid",
      "name": "ORION",
      "share_token": "abc123",
      "linkedin_accounts_count": 4,
      "campaigns_count": 18,
      "total_invites": 2847,
      "total_connections": 1234,
      "connection_rate": 43.3
    }
  ]
}
```

#### `POST /api/admin/companies`
Create a new company

**Request Body:**
```json
{
  "name": "New Company Name"
}
```

**Response:**
```json
{
  "company": {
    "id": "uuid",
    "name": "New Company Name",
    "share_token": "xyz789",
    "created_at": "2025-10-14T12:00:00Z"
  }
}
```

#### `GET /api/admin/linkedin-accounts`
List all LinkedIn accounts

**Query Parameters:**
- `status` (optional): "assigned" or "unassigned"
- `company_id` (optional): Filter by company

**Response:**
```json
{
  "accounts": [
    {
      "id": "uuid",
      "account_name": "Tobias Millington",
      "account_email": "tobias@example.com",
      "status": "assigned",
      "company_id": "uuid",
      "company_name": "ORION",
      "campaigns_count": 3,
      "total_invites": 847
    }
  ]
}
```

#### `PUT /api/admin/linkedin-accounts/:id/assign`
Assign LinkedIn account to a company

**Request Body:**
```json
{
  "company_id": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "account": {
    "id": "uuid",
    "company_id": "uuid",
    "status": "assigned"
  }
}
```

### Dashboard Endpoints

#### `GET /api/dashboard/:shareToken`
Get company dashboard data

**Query Parameters:**
- `start_date` (optional): ISO 8601 date
- `end_date` (optional): ISO 8601 date

**Response:**
```json
{
  "company": {
    "name": "ORION"
  },
  "kpis": {
    "total_invites": 2847,
    "total_connections": 1234,
    "connection_rate": 43.3,
    "total_replies": 89,
    "response_rate": 7.2
  },
  "activity_timeline": [
    {
      "date": "2025-10-01",
      "invites": 145,
      "connections": 62,
      "replies": 5
    }
  ],
  "linkedin_accounts": [
    {
      "id": "uuid",
      "account_name": "Tobias Millington",
      "total_invites": 847,
      "total_connections": 412,
      "connection_rate": 48.6,
      "campaigns_count": 3
    }
  ]
}
```

#### `GET /api/dashboard/:shareToken/linkedin-account/:accountId`
Get LinkedIn account details

**Response:**
```json
{
  "account": {
    "id": "uuid",
    "account_name": "Tobias Millington",
    "account_email": "tobias@example.com"
  },
  "kpis": {
    "total_invites": 847,
    "total_connections": 412,
    "connection_rate": 48.6,
    "total_replies": 34,
    "response_rate": 8.3
  },
  "campaigns": [
    {
      "id": "uuid",
      "campaign_name": "2025-10-08+Saul Mawby+A00",
      "started_at": "2025-10-08",
      "total_invites": 222,
      "total_connections": 38,
      "connection_rate": 17.1
    }
  ]
}
```

#### `GET /api/dashboard/:shareToken/export`
Export dashboard data as CSV

**Query Parameters:**
- `start_date` (optional)
- `end_date` (optional)
- `type`: "summary" or "detailed"

**Response:** CSV file download

---

## Data Flow

### Webhook Processing Flow

```
1. Webhook Arrives
   └─> Validate payload structure
       └─> Extract key fields:
           - hook.event
           - messenger.li_account_id
           - messenger.campaign_instance
           - contact data
           
2. Parse Campaign Instance
   └─> "2025-10-08+Saul Mawby+A00..." 
       └─> Extract: Date, LinkedIn Account Name, Campaign Code
       
3. Upsert LinkedIn Account
   └─> Query by li_account_id
       └─> If exists: update
       └─> If not exists: create with status='unassigned'
       
4. Upsert Campaign
   └─> Query by campaign_instance
       └─> If exists: update
       └─> If not exists: create under LinkedIn Account
       
5. Upsert Contact
   └─> Query by contact_id
       └─> If exists: update
       └─> If not exists: create
       
6. Create Event
   └─> Determine event_type based on hook.event:
       - "Connection Request Sent" → 'invite_sent'
       - "Connection Request Accepted" → 'connection_accepted'
       - "Contact Replied" → 'contact_replied'
   └─> Store timestamps (invited_at, connected_at, replied_at)
   └─> Store raw payload in event_data (JSON)
   
7. Return Success
   └─> HTTP 200 OK
```

### Dashboard Data Aggregation Flow

```
1. Client Requests Dashboard
   └─> Extract share_token from URL
   
2. Validate Share Token
   └─> Query companies table
       └─> If not found: return 404
       └─> If found: get company_id
       
3. Get Assigned LinkedIn Accounts
   └─> Query linkedin_accounts where company_id matches
   
4. Get Campaigns
   └─> Query campaigns for all linked accounts
   
5. Aggregate Events
   └─> For each campaign:
       └─> Count events by type
       └─> Calculate KPIs
       └─> Group by date for timeline
       
6. Return JSON
   └─> Company info
   └─> Aggregate KPIs
   └─> Timeline data
   └─> LinkedIn account summaries
```

---

## Security Considerations

### MVP (Phase 1)
- ✅ No authentication required for client dashboards
- ✅ Share tokens are UUIDs (unguessable)
- ✅ Rate limiting on webhook endpoint (prevent abuse)
- ✅ Input validation on all endpoints
- ✅ SQL injection prevention (parameterized queries)
- ✅ CORS configured for frontend domain only

### Future Phases
- 🔲 Admin authentication (JWT tokens)
- 🔲 Role-based access control
- 🔲 Webhook signature verification (if Expandi supports it)
- 🔲 Share token expiration
- 🔲 Password protection for dashboards
- 🔲 Audit logging for admin actions

---

## Performance Considerations

### Database Optimization
- Indexes on foreign keys and frequently queried fields
- Denormalized KPI cache table (for faster dashboard loads)
- Archive old events after 2 years

### API Optimization
- Response caching (5-minute TTL for dashboard data)
- Pagination for large result sets
- Gzip compression for API responses
- Database connection pooling

### Frontend Optimization
- Code splitting (lazy load route components)
- Image optimization
- Memoization for expensive calculations
- Virtual scrolling for large lists

---

## Error Handling

### Webhook Errors
- Invalid payload → Return 400 Bad Request, log error
- Database error → Return 500 Internal Server Error, retry logic
- Duplicate webhook → Idempotent processing, return 200 OK

### API Errors
- Invalid share token → Return 404 Not Found
- Invalid date range → Return 400 Bad Request
- Server error → Return 500 Internal Server Error, log stack trace

### Frontend Errors
- API request fails → Show error toast, retry button
- Invalid route → Redirect to 404 page
- Chart rendering error → Show fallback message

---

## Testing Strategy

### Backend Testing
- **Unit Tests:** Models, services, utilities
- **Integration Tests:** API endpoints, database operations
- **E2E Tests:** Webhook processing flow

### Frontend Testing
- **Component Tests:** Individual React components
- **Integration Tests:** Page-level interactions
- **E2E Tests:** Cypress for critical user flows

### Manual Testing
- Webhook testing with loca.lt
- Cross-browser testing (Chrome, Firefox, Safari)
- Mobile responsiveness testing

---

## Deployment Architecture

### Development
```
Local Machine
├── Backend: localhost:3001
├── Frontend: localhost:5173
└── Database: SQLite file (./database/dev.db)
```

### Production
```
Railway
├── Backend Service
│   ├── Node.js app
│   ├── PostgreSQL database
│   └── Environment variables
│
Vercel
└── Frontend Service
    ├── Static React build
    └── Environment variables (API URL)
```

---

## Environment Variables

### Backend (.env)
```bash
# Server
PORT=3001
NODE_ENV=development

# Database
DATABASE_URL=./database/dev.db  # or postgres://...

# CORS
FRONTEND_URL=http://localhost:5173

# Optional
WEBHOOK_SECRET=your-secret-key
```

### Frontend (.env)
```bash
# API
VITE_API_URL=http://localhost:3001

# Optional
VITE_ENVIRONMENT=development
```

---

## Monitoring & Logging

### Logs to Track
- Webhook receipt (timestamp, event type, campaign)
- Webhook processing errors
- API request logs (endpoint, response time, status code)
- Database query performance
- User actions (admin dashboard)

### Metrics to Monitor
- Webhook processing rate (events/minute)
- API response times (p50, p95, p99)
- Error rates by endpoint
- Database connection pool usage
- Disk space usage

### Tools (Future)
- Sentry for error tracking
- LogRocket for session replay
- Railway metrics dashboard

---

## Migration Strategy

### SQLite → PostgreSQL
When moving to production:

1. Export SQLite schema: `sqlite3 dev.db .schema > schema.sql`
2. Convert SQLite syntax to PostgreSQL
3. Run migrations on Railway PostgreSQL
4. Export data: `sqlite3 dev.db .dump > data.sql`
5. Import data to PostgreSQL
6. Update DATABASE_URL environment variable
7. Test all endpoints

### Schema Migrations
Use a migration tool in Phase 2:
- Option 1: Knex.js
- Option 2: Prisma
- Option 3: Custom SQL migration scripts

---

## Future Enhancements

### Performance
- Redis caching layer
- GraphQL API (more efficient than REST for nested data)
- Serverless functions for webhooks (auto-scaling)

### Features
- Real-time dashboard updates (WebSockets)
- Advanced filtering and search
- Scheduled reports (PDF generation)
- Webhook retry queue (Bull/BullMQ)

### Infrastructure
- Multi-region deployment
- CDN for frontend assets
- Database read replicas
- Automated backups

---

## Development Workflow

### Local Development
```bash
# Terminal 1: Backend
cd backend
npm install
npm run dev  # Starts on localhost:3001

# Terminal 2: Frontend  
cd frontend
npm install
npm run dev  # Starts on localhost:5173

# Terminal 3: Webhook testing
lt --port 3001 --subdomain breezy-things-talk  # Get public URL for Expandi webhooks
```

### Git Workflow
```
main (production)
  └─ develop (staging)
      └─ feature/* (feature branches)
```

### Deployment
- Push to `main` → Auto-deploy to production
- Push to `develop` → Auto-deploy to staging
- Pull requests required for merges

---

## Documentation Structure

```
expandi-dashboard/
├── PRD.md                    # Product requirements (this doc)
├── ARCHITECTURE.md           # Technical architecture (this doc)
├── README.md                 # Quick start guide
├── backend/
│   ├── README.md            # Backend setup
│   └── API.md               # API documentation
├── frontend/
│   ├── README.md            # Frontend setup
│   └── COMPONENTS.md        # Component docs
└── docs/
    ├── DEPLOYMENT.md        # Deployment guide
    ├── TROUBLESHOOTING.md   # Common issues
    └── DATABASE.md          # Database guide
```

---

## Support & Maintenance

### For Next Developer
- All code has inline comments
- Complex logic explained in detail
- TODOs marked clearly
- README files in each directory
- This architecture document as reference

### For ORION Team
- User guide for admin dashboard (to be created)
- FAQ document
- Support contact information
- Bug reporting process

---

**Last Updated:** October 14, 2025  
**Version:** 1.0 (MVP)  
**Status:** In Development
