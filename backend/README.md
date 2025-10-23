# Backend - Expandi Dashboard API

Node.js/Express API server for the Expandi Dashboard.

## 📋 Prerequisites

- Node.js 18+ installed
- npm (comes with Node.js)

## 🚀 Setup

1. **Install dependencies:**
```bash
cd backend
npm install
```

2. **Create environment file:**
```bash
cp .env.example .env
```

3. **Initialize database:**
```bash
npm run init-db
```

This will create the SQLite database and run the schema.

4. **Start development server:**
```bash
npm run dev
```

Server runs on `http://localhost:3001`

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

#### GET `/api/admin/linkedin-accounts`
List all LinkedIn accounts

**Query parameters:**
- `status` (optional): "assigned" or "unassigned"
- `company_id` (optional): Filter by company UUID

**Response:**
```json
{
  "success": true,
  "accounts": [
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

#### PUT `/api/admin/linkedin-accounts/:id/assign`
Assign LinkedIn account to a company

**Request body:**
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
  },
  "message": "LinkedIn account assigned successfully"
}
```

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

### Local Development (SQLite)
- Database file: `backend/database/dev.db`
- Automatically created on first run
- View with: `sqlite3 database/dev.db`

### Useful SQLite commands:
```bash
# Open database
sqlite3 database/dev.db

# List tables
.tables

# View schema
.schema companies

# Query data
SELECT * FROM companies;

# Exit
.quit
```

### Reset database:
```bash
rm database/dev.db
npm run init-db
```

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
