# Backend - Expandi Dashboard API

Node.js/Express API server for the Expandi Dashboard.

## ⚠️ CURRENT DEPLOYMENT STATUS

**CRITICAL FOR NEW DEVELOPERS:**
- ✅ **Migration completed:** SQLite → PostgreSQL (Railway)
- 🚧 **Currently troubleshooting:** Post-deployment issues on Railway
- 🔧 **Active work:** Production environment fixes and webhook testing
- 📍 **Current focus:** Railway database connection stability

**DEVELOPMENT CLARIFICATION:**
- ✅ Local development is fine to work on
- ⚠️ When discussing "server issues" - we mean PRODUCTION server issues
- ⚠️ Do NOT assume localhost issues when troubleshooting production problems
- 🔧 We ARE making changes to production - that's the current focus

**Current Production URLs:**
- Backend: `https://api.dashboard.orionstrategy.com`
- Frontend: `https://dashboard.orionstrategy.com`
- Database: PostgreSQL (Railway)

## 🤖 AI Agent Notes

**IMPORTANT:** This API is running in production and working correctly.

**Before assuming issues:**
- Check your own network connectivity
- Verify you're using the correct URL: `https://api.dashboard.orionstrategy.com`
- Ask the user to confirm if they're experiencing actual issues
- Don't make changes to "fix" working systems

**Common AI Agent Mistakes:**
- Assuming custom domains don't work when you get DNS errors
- Falling back to Railway subdomains unnecessarily
- Making "fixes" for systems that are actually working fine

## 📋 Prerequisites

- Node.js 18+ installed
- npm (comes with Node.js)

## 🚀 Setup

### ⚠️ CURRENT STATUS: PostgreSQL Migration Completed

**Local Development (Legacy - No Longer Used):**
~~SQLite setup is deprecated. Local development now connects to Railway PostgreSQL.~~

### Production Setup (Current)
1. **Install dependencies:**
```bash
cd backend
npm install
```

2. **Environment variables are set in Railway:**
```
PORT=3001
NODE_ENV=production
DATABASE_URL=postgres://... (Railway PostgreSQL)
FRONTEND_URL=https://expandi-dashboard.vercel.app
```

3. **Database is automatically managed by Railway PostgreSQL**

4. **Server runs on Railway:** `https://backend-production-b2e1.up.railway.app`

## 📁 Project Structure

```
backend/
├── src/
│   ├── config/
│   │   ├── database.js          # Database connection
│   │   └── initDatabase.js      # DB initialization script
│   ├── models/
│   │   ├── Company.js           # Company model
│   │   ├── LinkedInAccount.js   # LinkedIn account model
│   │   ├── Campaign.js          # Campaign model
│   │   ├── Event.js             # Event model
│   │   └── Contact.js           # Contact model
│   ├── services/
│   │   ├── webhookProcessor.js  # Webhook processing logic
│   │   └── analyticsService.js  # KPI calculations
│   ├── routes/
│   │   ├── webhooks.js          # Webhook endpoints
│   │   ├── admin.js             # Admin endpoints
│   │   └── dashboard.js         # Dashboard endpoints
│   ├── middleware/
│   │   └── errorHandler.js      # Error handling
│   └── server.js                # Main server file
├── database/
│   ├── schema.sql               # Database schema
│   └── dev.db                   # SQLite database (created on init)
├── package.json
├── .env.example
└── README.md (this file)
```

## 🔌 API Endpoints

### Authentication (Added beyond MVP)

#### POST `/api/auth/login`
Admin login

**Request body:**
```json
{
  "username": "admin@example.com",
  "password": "password"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "user": {
    "id": "uuid",
    "username": "admin@example.com"
  }
}
```

#### POST `/api/auth/logout`
Admin logout

#### POST `/api/auth/change-password`
Change admin password

#### POST `/api/auth/add-admin`
Add new admin user

#### GET `/api/auth/admins`
List all admin users

### Webhooks

#### POST `/api/webhooks/expandi`
Receive webhooks from Expandi.io

**Request body:**
```json
{
  "hook": {
    "event": "linked_in_messenger.campaign_new_contact",
    "fired_datetime": "2025-10-14 17:50:33.104655+00:00"
  },
  "contact": {
    "id": 4172388,
    "first_name": "John",
    "last_name": "Doe",
    "company_name": "Example Corp"
  },
  "messenger": {
    "li_account": 156241,
    "campaign_instance": "2025-09-12+Tobias Millington+A001+M004",
    "connected_at": "2025-10-14 17:50:25.912925+00:00",
    "conversation_status": "Awaiting Reply"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Webhook processed successfully",
  "data": {
    "linkedin_account_id": "uuid",
    "campaign_id": "uuid",
    "event_id": "uuid"
  }
}
```

### Admin Endpoints

#### GET `/api/admin/companies`
List all companies with statistics

**Response:**
```json
{
  "success": true,
  "companies": [
    {
      "id": "uuid",
      "name": "ORION",
      "share_token": "abc123",
      "linkedin_accounts_count": 4,
      "campaigns_count": 18,
      "total_invites": 2847,
      "total_connections": 1234,
      "connection_rate": 43.3,
      "total_replies": 89,
      "response_rate": 7.2
    }
  ]
}
```

#### POST `/api/admin/companies`
Create a new company

**Request body:**
```json
{
  "name": "New Company Name"
}
```

**Response:**
```json
{
  "success": true,
  "company": {
    "id": "uuid",
    "name": "New Company Name",
    "share_token": "xyz789",
    "created_at": "2025-10-14T12:00:00Z"
  }
}
```

#### GET `/api/admin/profiles`
List all profiles (LinkedIn accounts)

**Query parameters:**
- `status` (optional): "assigned" or "unassigned"
- `company_id` (optional): Filter by company UUID

**Response:**
```json
{
  "success": true,
  "profiles": [
    {
      "id": "uuid",
      "account_name": "Tobias Millington",
      "account_email": "tobias@example.com",
      "status": "assigned",
      "company_id": "uuid",
      "company_name": "ORION",
      "campaigns_count": 3
    }
  ]
}
```

#### POST `/api/admin/profiles`
Create new profile

#### PUT `/api/admin/profiles/:id/assign`
Assign profile to a company

#### PUT `/api/admin/profiles/:id/unassign`
Unassign profile from company

#### DELETE `/api/admin/profiles/:id`
Delete profile

#### GET `/api/admin/stats`
Get system-wide statistics

#### GET `/api/admin/webhooks/recent`
Get recent webhook activity

#### POST `/api/admin/backfill`
CSV backfill historical data

**Request body (multipart/form-data):**
- `file`: CSV file
- `profileId`: Profile UUID
- `skipExisting`: boolean
- `updateExisting`: boolean

### Dashboard Endpoints (Public - No Auth)

#### GET `/api/dashboard/:shareToken`
Get company dashboard data

**Query parameters:**
- `start_date` (optional): YYYY-MM-DD format
- `end_date` (optional): YYYY-MM-DD format

**Response:**
```json
{
  "success": true,
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

#### GET `/api/dashboard/:shareToken/export`
Export dashboard data as CSV

**Response:** CSV file download

## 🧪 Testing Webhooks Locally

Since Expandi needs a public URL, use loca.lt:

1. **Install localtunnel:**
```bash
npm install -g localtunnel
```

2. **Start your backend server:**
```bash
npm run dev
```

3. **Start loca.lt tunnel** (in a new terminal):
```bash
lt --port 3001 --subdomain breezy-things-talk
```

4. **Use the public URL:** `https://breezy-things-talk.loca.lt`

5. **Configure Expandi webhook:**
- URL: `https://breezy-things-talk.loca.lt/api/webhooks/expandi`
- Events: "Connection Request Sent", "Connection Request Accepted", "Contact Replied"

6. **Test manually with curl:**
```bash
curl -X POST http://localhost:3001/api/webhooks/expandi \
  -H "Content-Type: application/json" \
  -d @test-webhook.json
```

## 📊 Database

### ⚠️ MIGRATION STATUS
- ✅ **Completed:** SQLite → PostgreSQL migration
- 🚧 **Current:** PostgreSQL on Railway
- 📍 **Status:** Troubleshooting connection issues

### Production (Current)
- **Database:** PostgreSQL (Railway)
- **Connection:** `DATABASE_URL=postgres://...` (set in Railway)
- **Status:** Active but experiencing connection issues
- **Management:** Via Railway dashboard

### Local Development (Legacy - No Longer Used)
~~SQLite setup is deprecated. Local development now connects to Railway PostgreSQL.~~

### Database Schema
- **Tables:** companies, profiles, campaigns, events, contacts, admin_users
- **Key Changes:** 
  - `linkedin_accounts` → `profiles` (with `webhook_id` field)
  - Added `admin_users` table for authentication
  - Added `campaign_id` foreign key to `contacts` table

## 🚀 Production Deployment (Railway)

1. **Create Railway account** at railway.app

2. **Create new project** from GitHub repo

3. **Add PostgreSQL database**

4. **Set environment variables:**
```
PORT=3001
NODE_ENV=production
DATABASE_URL=${{Postgres.DATABASE_URL}}
FRONTEND_URL=https://your-frontend.vercel.app
```

5. **Deploy!** Railway will automatically detect Node.js and run `npm start`

## 🔧 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 3001 |
| `NODE_ENV` | Environment (development/production) | development |
| `DATABASE_URL` | Database connection string | ./database/dev.db |
| `FRONTEND_URL` | Frontend URL for CORS | http://localhost:5173 |

## 🐛 Troubleshooting

### Port already in use
```bash
# Find process using port 3001
lsof -i :3001

# Kill process
kill -9 <PID>
```

### Database locked error
SQLite can lock if multiple processes access it. Make sure only one server instance is running.

### Webhook not received
1. Check loca.lt tunnel is running and forwarding to port 3001
2. Verify webhook URL in Expandi settings
3. Check server logs for errors
4. Test with curl to verify endpoint works

### Module not found
```bash
rm -rf node_modules package-lock.json
npm install
```

## 📝 Development Tips

### Hot reload
The dev server uses nodemon for hot reloading. Changes to any `.js` file will automatically restart the server.

### Logging
All console.log statements will appear in the terminal. Important events are logged with emojis for easy scanning:
- 📨 Webhook received
- ✅ Success
- ❌ Error

### Testing
Create a `test-webhook.json` file with sample webhook data and test with:
```bash
curl -X POST http://localhost:3001/api/webhooks/expandi \
  -H "Content-Type: application/json" \
  -d @test-webhook.json
```

## 🔄 Migration to PostgreSQL

When ready to deploy, the SQLite schema is designed to be compatible with PostgreSQL. Main changes needed:

1. Change `TEXT` to `VARCHAR` where appropriate
2. Use `TIMESTAMP` instead of `TEXT` for dates
3. Update `database.js` to use `pg` library instead of `better-sqlite3`

See `ARCHITECTURE.md` for detailed migration instructions.

## 📚 Additional Documentation

- See `../ARCHITECTURE.md` for system design
- See `../PRD.md` for product requirements
- See `../README.md` for project overview

---

**Need help?** Check the troubleshooting section or review the inline code comments.
