# Frontend Implementation Guide

**Status:** Framework and structure complete, components need implementation  
**For:** Next developer working in Cursor IDE  
**Estimated Time:** 1-2 weeks for complete implementation

---

## 🎯 Implementation Checklist

### Phase 1: Setup & Configuration (30 minutes)
- [ ] Create all config files
- [ ] Test dev server starts
- [ ] Verify API connection

### Phase 2: Core Infrastructure (2-3 hours)
- [ ] API service layer
- [ ] Router setup
- [ ] Layout components

### Phase 3: Admin Dashboard (1-2 days)
- [ ] Company management
- [ ] Account assignment
- [ ] Link generation

### Phase 4: Client Dashboard (2-3 days)
- [ ] Main dashboard view
- [ ] KPI calculations
- [ ] Charts implementation
- [ ] Date filtering

### Phase 5: Drill-Down Views (1-2 days)
- [ ] Account detail page
- [ ] Campaign detail page
- [ ] Navigation flow

### Phase 6: Polish & Testing (1-2 days)
- [ ] Error handling
- [ ] Loading states
- [ ] Responsive design
- [ ] CSV export

---

## Step-by-Step Implementation

### Step 1: Configuration Files

Create these files in the frontend root:

**vite.config.js:**
```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  }
})
```

**tailwind.config.js:**
```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
        }
      }
    },
  },
  plugins: [],
}
```

**postcss.config.js:**
```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

**.env:**
```
VITE_API_URL=http://localhost:3001
```

**index.html:**
```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Expandi Dashboard</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

### Step 2: Entry Point Files

**src/main.jsx:**
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

**src/index.css:**
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  @apply bg-gray-50;
}
```

### Step 3: API Service

**src/services/api.js:**
```javascript
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ========== ADMIN ENDPOINTS ==========

export const getCompanies = async () => {
  const response = await api.get('/api/admin/companies');
  return response.data;
};

export const createCompany = async (name) => {
  const response = await api.post('/api/admin/companies', { name });
  return response.data;
};

export const deleteCompany = async (id) => {
  const response = await api.delete(`/api/admin/companies/${id}`);
  return response.data;
};

export const getLinkedInAccounts = async (filters = {}) => {
  const params = new URLSearchParams(filters);
  const response = await api.get(`/api/admin/linkedin-accounts?${params}`);
  return response.data;
};

export const assignAccount = async (accountId, companyId) => {
  const response = await api.put(
    `/api/admin/linkedin-accounts/${accountId}/assign`,
    { company_id: companyId }
  );
  return response.data;
};

export const getAdminStats = async () => {
  const response = await api.get('/api/admin/stats');
  return response.data;
};

// ========== DASHBOARD ENDPOINTS ==========

export const getCompanyDashboard = async (shareToken, filters = {}) => {
  const params = new URLSearchParams(filters);
  const response = await api.get(`/api/dashboard/${shareToken}?${params}`);
  return response.data;
};

export const getAccountDashboard = async (shareToken, accountId, filters = {}) => {
  const params = new URLSearchParams(filters);
  const response = await api.get(
    `/api/dashboard/${shareToken}/linkedin-account/${accountId}?${params}`
  );
  return response.data;
};

export const getCampaignDashboard = async (shareToken, campaignId, filters = {}) => {
  const params = new URLSearchParams(filters);
  const response = await api.get(
    `/api/dashboard/${shareToken}/campaign/${campaignId}?${params}`
  );
  return response.data;
};

export const exportDashboard = (shareToken, filters = {}) => {
  const params = new URLSearchParams(filters);
  return `${API_URL}/api/dashboard/${shareToken}/export?${params}`;
};

export default api;
```

### Step 4: Router Setup

**src/App.jsx:**
```javascript
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AdminDashboard from './pages/AdminDashboard';
import ClientDashboard from './pages/ClientDashboard';
import AccountView from './pages/AccountView';
import CampaignView from './pages/CampaignView';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Admin routes */}
        <Route path="/admin" element={<AdminDashboard />} />
        
        {/* Client dashboard routes (public, no auth) */}
        <Route path="/c/:shareToken" element={<ClientDashboard />} />
        <Route path="/c/:shareToken/account/:accountId" element={<AccountView />} />
        <Route path="/c/:shareToken/campaign/:campaignId" element={<CampaignView />} />
        
        {/* Default redirect */}
        <Route path="/" element={<Navigate to="/admin" replace />} />
        
        {/* 404 */}
        <Route path="*" element={<div className="p-8 text-center">Page not found</div>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
```

### Step 5: Reusable Components

**src/components/KPICard.jsx:**
```javascript
import React from 'react';

export default function KPICard({ title, value, subtitle, icon: Icon, color = 'blue' }) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-700',
    green: 'bg-green-50 text-green-700',
    yellow: 'bg-yellow-50 text-yellow-700',
    red: 'bg-red-50 text-red-700',
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
          {subtitle && (
            <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
          )}
        </div>
        {Icon && (
          <div className={`p-3 rounded-full ${colorClasses[color]}`}>
            <Icon className="w-6 h-6" />
          </div>
        )}
      </div>
    </div>
  );
}
```

**src/components/ActivityChart.jsx:**
```javascript
import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format, parseISO } from 'date-fns';

export default function ActivityChart({ data, height = 300 }) {
  // Format dates for display
  const formattedData = data.map(item => ({
    ...item,
    displayDate: format(parseISO(item.date), 'MMM d'),
  }));

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Activity Over Time</h3>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={formattedData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="displayDate" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="invites" stroke="#3b82f6" name="Invites" />
          <Line type="monotone" dataKey="connections" stroke="#10b981" name="Connections" />
          <Line type="monotone" dataKey="replies" stroke="#f59e0b" name="Replies" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

**src/components/DateRangeFilter.jsx:**
```javascript
import React, { useState } from 'react';
import { subDays, format } from 'date-fns';

export default function DateRangeFilter({ onFilter }) {
  const [activeFilter, setActiveFilter] = useState('all');

  const handleFilter = (days, label) => {
    setActiveFilter(label);
    
    if (days === 'all') {
      onFilter({});
    } else {
      const endDate = new Date();
      const startDate = subDays(endDate, days);
      onFilter({
        start_date: format(startDate, 'yyyy-MM-dd'),
        end_date: format(endDate, 'yyyy-MM-dd'),
      });
    }
  };

  const filters = [
    { label: '7d', days: 7 },
    { label: '30d', days: 30 },
    { label: '90d', days: 90 },
    { label: 'all', days: 'all' },
  ];

  return (
    <div className="flex gap-2">
      {filters.map(({ label, days }) => (
        <button
          key={label}
          onClick={() => handleFilter(days, label)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeFilter === label
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
          }`}
        >
          {label === 'all' ? 'All Time' : `Last ${label}`}
        </button>
      ))}
    </div>
  );
}
```

### Step 6: Admin Dashboard Page

**src/pages/AdminDashboard.jsx:**
```javascript
import React, { useState, useEffect } from 'react';
import { getCompanies, createCompany, getLinkedInAccounts, assignAccount, getAdminStats } from '../services/api';
import { Plus, TrendingUp, Users, Briefcase, AlertCircle } from 'lucide-react';

export default function AdminDashboard() {
  const [companies, setCompanies] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showNewCompanyModal, setShowNewCompanyModal] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [companiesData, accountsData, statsData] = await Promise.all([
        getCompanies(),
        getLinkedInAccounts(),
        getAdminStats(),
      ]);
      
      setCompanies(companiesData.companies || []);
      setAccounts(accountsData.accounts || []);
      setStats(statsData.stats || {});
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCompany = async (e) => {
    e.preventDefault();
    try {
      await createCompany(newCompanyName);
      setNewCompanyName('');
      setShowNewCompanyModal(false);
      loadData();
    } catch (error) {
      console.error('Error creating company:', error);
      alert('Failed to create company');
    }
  };

  const handleAssignAccount = async (accountId, companyId) => {
    try {
      await assignAccount(accountId, companyId);
      loadData();
    } catch (error) {
      console.error('Error assigning account:', error);
      alert('Failed to assign account');
    }
  };

  const copyShareLink = (shareToken) => {
    const url = `${window.location.origin}/c/${shareToken}`;
    navigator.clipboard.writeText(url);
    alert('Link copied to clipboard!');
  };

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  const unassignedAccounts = accounts.filter(a => a.status === 'unassigned');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">Manage companies and LinkedIn accounts</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Companies</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.total_companies}</p>
                </div>
                <Briefcase className="w-8 h-8 text-blue-600" />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">LinkedIn Accounts</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.total_linkedin_accounts}</p>
                </div>
                <Users className="w-8 h-8 text-green-600" />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Campaigns</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.total_campaigns}</p>
                </div>
                <TrendingUp className="w-8 h-8 text-purple-600" />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Unassigned</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.unassigned_accounts}</p>
                </div>
                <AlertCircle className="w-8 h-8 text-yellow-600" />
              </div>
            </div>
          </div>
        )}

        {/* Unassigned Accounts Alert */}
        {unassignedAccounts.length > 0 && (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-8">
            <div className="flex">
              <AlertCircle className="h-5 w-5 text-yellow-400" />
              <div className="ml-3">
                <p className="text-sm text-yellow-700">
                  You have {unassignedAccounts.length} unassigned LinkedIn account(s). 
                  Assign them to a company below.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Companies */}
        <div className="bg-white rounded-lg shadow mb-8">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Companies</h2>
            <button
              onClick={() => setShowNewCompanyModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              New Company
            </button>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {companies.map(company => (
                <div key={company.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{company.name}</h3>
                      <p className="text-sm text-gray-500">
                        {company.linkedin_accounts_count} accounts • {company.campaigns_count} campaigns
                      </p>
                    </div>
                    <button
                      onClick={() => copyShareLink(company.share_token)}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                    >
                      Copy Dashboard Link
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* LinkedIn Accounts */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">LinkedIn Accounts</h2>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {accounts.map(account => (
                <div key={account.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-medium text-gray-900">{account.account_name}</h3>
                      <p className="text-sm text-gray-500">
                        {account.company_name || 'Unassigned'} • {account.campaigns_count} campaigns
                      </p>
                    </div>
                    {account.status === 'unassigned' && (
                      <select
                        onChange={(e) => handleAssignAccount(account.id, e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg"
                      >
                        <option value="">Assign to company...</option>
                        {companies.map(company => (
                          <option key={company.id} value={company.id}>{company.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* New Company Modal */}
      {showNewCompanyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Create New Company</h3>
            <form onSubmit={handleCreateCompany}>
              <input
                type="text"
                value={newCompanyName}
                onChange={(e) => setNewCompanyName(e.target.value)}
                placeholder="Company name"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-4"
                required
              />
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowNewCompanyModal(false)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
```

**(See frontend/README.md for remaining page implementations: ClientDashboard, AccountView, CampaignView)**

---

## 🎨 Design Guidelines

- Clean, modern interface
- Consistent spacing (use Tailwind's spacing scale)
- Clear visual hierarchy
- Responsive design (mobile-first)
- Loading states for all async operations
- Error handling with user-friendly messages

## 🧪 Testing Checklist

- [ ] Admin can create companies
- [ ] Admin can assign accounts
- [ ] Share links work
- [ ] Client dashboards load correctly
- [ ] Charts render with data
- [ ] Date filters work
- [ ] Drill-down navigation works
- [ ] CSV export works
- [ ] Responsive on mobile

## 🚀 Deployment

Build command: `npm run build`  
Output directory: `dist`  
Deploy to: Vercel

---

**Need Help?** Refer to component examples in this guide, check React Router docs for routing, and Recharts docs for charts.
