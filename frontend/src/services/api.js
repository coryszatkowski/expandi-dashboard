import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'https://api.dashboard.theorionstrategy.com';

const api = axios.create({
  baseURL: API_URL.replace(/\/$/, ''),
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

export const updateCompany = async (id, data) => {
  const response = await api.put(`/api/admin/companies/${id}`, data);
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

export const unassignAccount = async (accountId) => {
  const response = await api.put(
    `/api/admin/linkedin-accounts/${accountId}/unassign`
  );
  return response.data;
};

export const createLinkedInAccount = async (accountData) => {
  const response = await api.post('/api/admin/linkedin-accounts', accountData);
  return response.data;
};

export const deleteLinkedInAccount = async (accountId) => {
  const response = await api.delete(`/api/admin/linkedin-accounts/${accountId}`);
  return response.data;
};

export const getAdminStats = async () => {
  const response = await api.get('/api/admin/stats');
  return response.data;
};

export const getRecentWebhooks = async () => {
  const response = await api.get('/api/admin/webhooks/recent');
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
    `/api/dashboard/${shareToken}/profile/${accountId}?${params}`
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

export const deleteContact = async (shareToken, contactId) => {
  const response = await api.delete(`/api/dashboard/${shareToken}/contact/${contactId}`);
  return response.data;
};

export const deleteCampaign = async (shareToken, campaignId) => {
  const response = await api.delete(`/api/dashboard/${shareToken}/campaign/${campaignId}`);
  return response.data;
};

export default api;
