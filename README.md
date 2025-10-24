# Expandi Dashboard

A performance analytics dashboard for LinkedIn outreach campaigns powered by Expandi.io.

## ⚠️ CRITICAL: Current Deployment Status

**IMPORTANT FOR NEW DEVELOPERS:**
- ✅ **Migration completed:** Local SQLite → Railway PostgreSQL
- 🚧 **Currently troubleshooting:** Post-deployment issues on Railway
- 🔧 **Active work:** Production environment fixes and webhook testing
- 📍 **Current focus:** Railway database connection stability

**PRODUCTION URLs:**
- Backend: `https://api.dashboard.orionstrategy.com`
- Frontend: `https://dashboard.orionstrategy.com`
- Database: PostgreSQL (Railway)

**DEVELOPMENT CLARIFICATION:**
- ✅ Local development is fine to work on
- ⚠️ When discussing "server issues" - we mean PRODUCTION server issues
- ⚠️ Do NOT assume localhost issues when troubleshooting production problems
- 🔧 We ARE making changes to production - that's the current focus

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ installed
- npm or yarn package manager
- Git

### Installation

1. **Clone or navigate to project:**
```bash
cd expandi-dashboard
```

2. **Install backend dependencies:**
```bash
cd backend
npm install
```

3. **Install frontend dependencies:**
```bash
cd ../frontend
npm install
```

4. **Start the backend server:**
```bash
cd ../backend
npm run dev
```
Backend runs on `http://localhost:3001`

5. **Start the frontend dev server** (in new terminal):
```bash
cd frontend
npm run dev
```
Frontend runs on `http://localhost:5173`

6. **Open your browser:**
```
http://localhost:5173
```

---

## 📚 Documentation

- **[PRD.md](./PRD.md)** - Complete product requirements and project overview
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Technical architecture and system design
- **[CHANGELOG.md](./CHANGELOG.md)** - All changes and updates (MUST UPDATE ON EVERY CHANGE)
- **[DEPLOYMENT_STATUS.md](./DEPLOYMENT_STATUS.md)** - Current deployment status and troubleshooting
- **[backend/README.md](./backend/README.md)** - Backend setup and API docs
- **[frontend/README.md](./frontend/README.md)** - Frontend setup and component docs

### 📝 Documentation Maintenance
**IMPORTANT:** All developers must update the CHANGELOG.md on every change made to the project. This ensures proper tracking of all modifications and helps with debugging and rollbacks.

---

## 🤖 AI Agent Guidelines

**CRITICAL RULES FOR AI AGENTS:**

### ✅ DO:
- Always assume production systems are working unless explicitly told otherwise
- When you get connection errors, investigate your own network/DNS first
- Ask for clarification if you're unsure about system status
- Use the correct production URLs: `api.dashboard.orionstrategy.com` and `dashboard.orionstrategy.com`

### ❌ DO NOT:
- Assume production systems are broken when you get connection errors
- Fall back to Railway subdomains without checking if custom domains work
- Make changes to fix "broken" systems that are actually working fine
- Assume localhost issues when troubleshooting production problems

### 🔍 Troubleshooting Protocol:
1. **First:** Verify the user is actually experiencing an issue
2. **Second:** Check if it's a network/DNS issue on your end
3. **Third:** Ask the user to confirm system status
4. **Only then:** Investigate potential production issues

### 🚨 Common AI Agent Mistakes:
- ❌ Assuming custom domains don't work when you get DNS errors
- ❌ Falling back to Railway subdomains without checking
- ❌ Making "fixes" for systems that are actually working
- ❌ Confusing localhost issues with production issues

---
---

## 🏗️ Project Structure

```
expandi-dashboard/
├── backend/              # Node.js/Express API
│   ├── src/
│   │   ├── routes/      # API endpoints
│   │   ├── services/    # Business logic
│   │   ├── models/      # Database models
│   │   └── server.js    # Entry point
│   ├── database/        # Database files & schema
│   └── package.json
│
├── frontend/            # React app
│   ├── src/
│   │   ├── components/  # React components
│   │   ├── pages/       # Route pages
│   │   ├── services/    # API client
│   │   └── App.jsx      # Root component
│   └── package.json
│
└── docs/                # Additional documentation
```

---

## 🔧 Configuration

### Backend Environment Variables

Create `backend/.env`:
```bash
PORT=3001
NODE_ENV=development
DATABASE_URL=./database/dev.db
FRONTEND_URL=http://localhost:5173
```

### Frontend Environment Variables

Create `frontend/.env`:
```bash
VITE_API_URL=http://localhost:3001
```

---

## 🧪 Testing Webhooks Locally

Since Expandi needs a public URL to send webhooks, use loca.lt:

1. **Install localtunnel:**
```bash
npm install -g localtunnel
```

2. **Start loca.lt tunnel:**
```bash
lt --port 3001 --subdomain breezy-things-talk
```

3. **Use the public URL:** `https://breezy-things-talk.loca.lt`

4. **Configure in Expandi:**
- Go to Expandi webhook settings
- Set webhook URL to: `https://breezy-things-talk.loca.lt/api/webhooks/expandi`
- Set events: "Connection Request Sent", "Connection Request Accepted", "Contact Replied"

---

## 📊 Key Features

### Admin Dashboard
- Manage companies (ORION's clients)
- Assign LinkedIn accounts to companies
- Generate shareable dashboard links
- View system-wide statistics

### Client Dashboard
- View campaign performance KPIs
- Interactive charts showing activity over time
- Drill down into LinkedIn accounts and campaigns
- Export data to CSV
- No login required (shareable links)

### Metrics Tracked
- **Invites Sent** - Total connection requests sent
- **Connections** - Total connections accepted
- **Connection Rate** - (Connections ÷ Invites) × 100
- **Replies** - Total responses received
- **Response Rate** - (Replies ÷ Connections) × 100

---

## 🔗 API Endpoints

### Webhooks
- `POST /api/webhooks/expandi` - Receive Expandi webhook data

### Authentication
- `POST /api/auth/login` - Admin login
- `POST /api/auth/logout` - Admin logout
- `POST /api/auth/change-password` - Change admin password
- `POST /api/auth/add-admin` - Add new admin user
- `GET /api/auth/admins` - List all admin users

### Admin
- `GET /api/admin/companies` - List all companies
- `POST /api/admin/companies` - Create new company
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

### Dashboard (Public)
- `GET /api/dashboard/:shareToken` - Get company dashboard data
- `GET /api/dashboard/:shareToken/linkedin-account/:accountId` - Get account details
- `GET /api/dashboard/:shareToken/campaign/:campaignId` - Get campaign details
- `GET /api/dashboard/:shareToken/export` - Export as CSV
- `DELETE /api/dashboard/:shareToken/campaign/:campaignId` - Delete campaign
- `DELETE /api/dashboard/:shareToken/contact/:contactId` - Delete contact

See [backend/README.md](./backend/README.md) for detailed API documentation.

---

## 🗄️ Database

### ⚠️ MIGRATION STATUS
- ✅ **Completed:** SQLite → PostgreSQL migration
- 🚧 **Current:** Production PostgreSQL on Railway
- 📍 **Status:** Troubleshooting connection issues

### Production (Current)
PostgreSQL (via Railway)
- **Database:** Railway PostgreSQL
- **Connection:** `DATABASE_URL=postgres://...` (set in Railway)
- **Status:** Active but experiencing connection issues
- **Migration:** Completed from SQLite schema
- **Backend:** `https://api.dashboard.orionstrategy.com`
- **Frontend:** `https://dashboard.orionstrategy.com`

### Local Development (Legacy)
~~SQLite (file-based database)~~ - **NO LONGER USED**
- ~~Location: `backend/database/dev.db`~~ - **Deprecated**
- **Note:** Local development now connects to Railway PostgreSQL

---

## 🚢 Deployment

### Backend (Railway)
1. Create Railway account
2. Connect GitHub repository
3. Create new project from repo
4. Add PostgreSQL database
5. Set environment variables
6. Deploy!

### Frontend (Railway)
1. Create Railway account
2. Connect GitHub repository
3. Create new project from repo
4. Set build command: `cd frontend && npm run build`
5. Set environment variables
6. Deploy!

See [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) for detailed deployment guide.

---

## 🐛 Troubleshooting

### Backend won't start
- Check Node.js version: `node -v` (should be 18+)
- Check if port 3001 is already in use
- Verify `.env` file exists
- Run `npm install` again

### Frontend won't start
- Check if port 5173 is already in use
- Verify `.env` file exists
- Clear cache: `rm -rf node_modules && npm install`

### Webhooks not working
- Check loca.lt tunnel is running
- Verify webhook URL in Expandi settings
- Check backend logs for errors
- Test webhook manually with curl:
```bash
curl -X POST http://localhost:3001/api/webhooks/expandi \
  -H "Content-Type: application/json" \
  -d @test-webhook.json
```

---

## 📝 Development Workflow

### Adding a New Feature

1. **Create feature branch:**
```bash
git checkout -b feature/new-feature-name
```

2. **Make changes** (backend and/or frontend)

3. **Test locally:**
```bash
# Backend tests
cd backend
npm test

# Frontend tests
cd frontend
npm test
```

4. **Commit changes:**
```bash
git add .
git commit -m "Add new feature"
```

5. **Push and create PR:**
```bash
git push origin feature/new-feature-name
```

---

## 📦 Tech Stack

- **Backend:** Node.js + Express
- **Frontend:** React + Vite + Tailwind CSS
- **Database:** SQLite (dev) / PostgreSQL (prod)
- **Charts:** Recharts
- **Hosting:** Railway (backend) + Vercel (frontend)

---

## 🎯 Project Status

### ✅ Completed (MVP + Extensions)
- Webhook receiver
- Database schema (SQLite → PostgreSQL migration completed)
- Admin dashboard with authentication
- Client dashboard (public, no login)
- KPI calculations and analytics
- Activity charts with date filtering
- Shareable links
- CSV export functionality
- **Authentication system** (admin login, password management)
- **CSV backfill system** (historical data import)
- **Railway deployment** (backend + PostgreSQL)
- **Vercel deployment** (frontend)

### 🚧 Currently In Progress
- **Post-deployment troubleshooting** (Railway + PostgreSQL issues)
- **Production environment fixes**
- **Webhook endpoint testing** in production
- **Database connection stability**

### 📋 Planned (Phase 2)
- Employee accounts with role-based access
- Advanced analytics (industry breakdown, job title analysis)
- CRM integrations
- Email notifications
- Contact detail pages

---

## 👥 Team

**Client:** ORION (LinkedIn outreach agency)  
**Developer:** Building with Claude AI + Cursor IDE  
**Status:** MVP Development

---

## 📄 License

Proprietary - © 2025 ORION

---

## 🆘 Need Help?

1. Check [docs/TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md)
2. Review [ARCHITECTURE.md](./ARCHITECTURE.md)
3. Read [PRD.md](./PRD.md)
4. Check inline code comments
5. Contact ORION team

---

## 🚀 Next Steps

1. **Test webhook integration** with Expandi using loca.lt
2. **Create sample companies** in admin dashboard
3. **Assign LinkedIn accounts** to companies
4. **Generate shareable links** and test client dashboard
5. **Export data** to verify CSV functionality
6. **Deploy to production** (Railway + Vercel)

---

**Last Updated:** October 14, 2025  
**Version:** 1.0 MVP
