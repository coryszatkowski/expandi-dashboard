# Expandi Dashboard

A performance analytics dashboard for LinkedIn outreach campaigns powered by Expandi.io.

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
- **[backend/README.md](./backend/README.md)** - Backend setup and API docs
- **[frontend/README.md](./frontend/README.md)** - Frontend setup and component docs

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

### Admin
- `GET /api/admin/companies` - List all companies
- `POST /api/admin/companies` - Create new company
- `GET /api/admin/linkedin-accounts` - List LinkedIn accounts
- `PUT /api/admin/linkedin-accounts/:id/assign` - Assign account to company

### Dashboard (Public)
- `GET /api/dashboard/:shareToken` - Get company dashboard data
- `GET /api/dashboard/:shareToken/linkedin-account/:accountId` - Get account details
- `GET /api/dashboard/:shareToken/campaign/:campaignId` - Get campaign details
- `GET /api/dashboard/:shareToken/export` - Export as CSV

See [backend/README.md](./backend/README.md) for detailed API documentation.

---

## 🗄️ Database

### Local Development
Uses SQLite (file-based database)
- Location: `backend/database/dev.db`
- No setup required - automatically created on first run

### Production
PostgreSQL (via Railway)
- Automatic migration from SQLite schema
- Environment variable: `DATABASE_URL=postgres://...`

---

## 🚢 Deployment

### Backend (Railway)
1. Create Railway account
2. Connect GitHub repository
3. Create new project from repo
4. Add PostgreSQL database
5. Set environment variables
6. Deploy!

### Frontend (Vercel)
1. Create Vercel account
2. Import GitHub repository
3. Set build command: `cd frontend && npm run build`
4. Set environment variables
5. Deploy!

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

### ✅ Completed (MVP)
- Webhook receiver
- Database schema
- Admin dashboard
- Client dashboard
- KPI calculations
- Activity charts
- Shareable links
- CSV export

### 🚧 In Progress
- Final testing
- Bug fixes
- Documentation

### 📋 Planned (Phase 2)
- User authentication
- Employee accounts
- Advanced analytics
- CRM integrations
- Email notifications

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
