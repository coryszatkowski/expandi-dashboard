import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AdminDashboard from './pages/AdminDashboard';
import ClientDashboard from './pages/ClientDashboard';
import AccountView from './pages/AccountView';
import CampaignView from './pages/CampaignView';

function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/c/:shareToken" element={<ClientDashboard />} />
        <Route path="/c/:shareToken/account/:accountId" element={<AccountView />} />
        <Route path="/c/:shareToken/campaign/:campaignId" element={<CampaignView />} />
        <Route path="/" element={<Navigate to="/admin" replace />} />
        <Route path="*" element={<div className="p-8 text-center">Page not found</div>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
