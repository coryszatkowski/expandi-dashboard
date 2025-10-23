# Frontend - Expandi Dashboard

React + Vite application for the Expandi Dashboard interface.

## 🚀 Quick Start

1. **Install dependencies:**
```bash
cd frontend
npm install
```

2. **Create environment file:**
```bash
cp .env.example .env
```

3. **Start development server:**
```bash
npm run dev
```

Frontend runs on `http://localhost:5173`

## 📁 Project Structure

```
frontend/
├── src/
│   ├── components/       # Reusable React components
│   │   ├── KPICard.jsx
│   │   ├── ActivityChart.jsx
│   │   ├── AccountCard.jsx
│   │   └── ...
│   ├── pages/            # Page components (routes)
│   │   ├── AdminDashboard.jsx
│   │   ├── ClientDashboard.jsx
│   │   ├── AccountView.jsx
│   │   └── CampaignView.jsx
│   ├── services/         # API client
│   │   └── api.js
│   ├── App.jsx           # Root component with routing
│   ├── main.jsx          # Entry point
│   └── index.css         # Tailwind imports
├── public/               # Static assets
├── index.html            # HTML template
├── vite.config.js        # Vite configuration
├── tailwind.config.js    # Tailwind CSS config
├── postcss.config.js     # PostCSS config
└── package.json
```

## 🎨 Tech Stack

- **Framework:** React 18
- **Build Tool:** Vite
- **Routing:** React Router 6
- **Styling:** Tailwind CSS
- **Charts:** Recharts
- **HTTP Client:** Axios
- **Icons:** Lucide React

## 🔧 Configuration Files Needed

### `vite.config.js`
```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173
  }
})
```

### `tailwind.config.js`
```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

### `postcss.config.js`
```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

### `.env`
```
VITE_API_URL=http://localhost:3001
```

## 📄 Core Files to Create

### 1. `index.html`
```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Expandi Dashboard</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

### 2. `src/main.jsx`
```javascript
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

### 3. `src/index.css`
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

### 4. `src/services/api.js`
Complete API client with all endpoints. See implementation details in ARCHITECTURE.md

### 5. `src/App.jsx`
Main app with React Router setup:
- `/admin` - Admin dashboard
- `/c/:shareToken` - Client dashboard
- `/c/:shareToken/account/:accountId` - Account view
- `/c/:shareToken/campaign/:campaignId` - Campaign view

## 🎯 Pages to Build

### Admin Dashboard (`/admin`)
**Features:**
- List all companies
- Create new company
- View unassigned LinkedIn accounts
- Assign accounts to companies
- Generate shareable links
- System stats overview

### Client Dashboard (`/c/:shareToken`)
**Features:**
- Company name header
- 4 KPI cards (Invites, Connections, Connection Rate, Replies, Response Rate)
- Activity chart (line chart showing trends)
- LinkedIn account cards (click to drill down)
- Date range filter
- Export CSV button

### Account View (`/c/:shareToken/account/:accountId`)
**Features:**
- Back button to company dashboard
- Account info header
- Account-level KPIs
- List of campaigns under this account
- Each campaign card shows metrics

### Campaign View (`/c/:shareToken/campaign/:campaignId`)
**Features:**
- Back button to account view
- Campaign info header
- Campaign-level KPIs
- Activity timeline chart

## 🧩 Components to Build

### KPICard.jsx
```javascript
// Props: title, value, subtitle (optional), icon (optional)
// Display: Large number with label, optional comparison
```

### ActivityChart.jsx
```javascript
// Props: data (timeline array), height
// Uses Recharts LineChart
// X-axis: dates, Y-axis: invites/connections/replies
```

### AccountCard.jsx
```javascript
// Props: account object, onClick
// Display: Account name, KPIs, campaigns count
// Clickable card to navigate to account view
```

### CampaignCard.jsx
```javascript
// Props: campaign object, onClick
// Display: Campaign name, start date, KPIs
```

### DateRangeFilter.jsx
```javascript
// Props: onFilter callback
// Buttons: Last 7 days, 30 days, 90 days, All time, Custom
```

### ShareableLink.jsx
```javascript
// Props: shareToken
// Display: URL with copy button
// URL format: {window.location.origin}/c/{shareToken}
```

## 🎨 Styling Guidelines

- Use Tailwind utility classes
- Color scheme:
  - Primary: blue-600
  - Success: green-600
  - Warning: yellow-600
  - Danger: red-600
  - Gray scale for backgrounds

- Component structure:
  - Cards: `bg-white rounded-lg shadow p-6`
  - Buttons: `px-4 py-2 rounded-lg`
  - Headers: `text-2xl font-bold`

## 🔌 API Integration

### Example API calls with axios:

```javascript
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL;

// Get companies
const getCompanies = async () => {
  const response = await axios.get(`${API_URL}/api/admin/companies`);
  return response.data;
};

// Get dashboard data
const getDashboard = async (shareToken, filters = {}) => {
  const params = new URLSearchParams(filters);
  const response = await axios.get(
    `${API_URL}/api/dashboard/${shareToken}?${params}`
  );
  return response.data;
};
```

## 🚀 Development Workflow

1. Start backend: `cd backend && npm run dev`
2. Start frontend: `cd frontend && npm run dev`
3. Open browser: `http://localhost:5173`

## 📦 Building for Production

```bash
npm run build
```

Output in `dist/` folder, ready for Vercel deployment.

## 🐛 Troubleshooting

### CORS errors
- Verify backend is running on port 3001
- Check FRONTEND_URL in backend/.env matches frontend URL
- Clear browser cache

### Module not found
```bash
rm -rf node_modules package-lock.json
npm install
```

### Vite not starting
- Check port 5173 is not already in use
- Delete `.vite` cache folder

## 📚 Next Steps for Developer

1. ✅ Create all configuration files (vite.config.js, tailwind.config.js, etc.)
2. ✅ Create src/services/api.js with all API methods
3. ✅ Create src/App.jsx with React Router
4. ✅ Build Admin Dashboard page
5. ✅ Build Client Dashboard page
6. ✅ Build reusable components (KPICard, ActivityChart, etc.)
7. ✅ Test with real data from backend
8. ✅ Add error handling and loading states
9. ✅ Polish UI/UX
10. ✅ Deploy to Vercel

---

**See `FRONTEND_IMPLEMENTATION_GUIDE.md` for detailed implementation instructions.**
