import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'https://api.dashboard.theorionstrategy.com';

const api = axios.create({
  baseURL: API_URL.replace(/\/$/, ''),
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor to include JWT token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('adminToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Add response interceptor to handle token expiration
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token is invalid or expired
      localStorage.removeItem('adminToken');
      localStorage.removeItem('adminSession');
      // Redirect to login or show login modal
      window.location.href = '/admin';
    }
    return Promise.reject(error);
  }
);

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

// Admin: Update contact events (invited/connected/replied) for a campaign contact
export const updateContactEvents = async (campaignId, contactId, data) => {
  const response = await api.put(`/api/admin/campaigns/${campaignId}/contacts/${contactId}/events`, data);
  return response.data;
};

// Admin: Get all contacts for a company
export const getCompanyContacts = async (companyId, options = {}) => {
  const params = new URLSearchParams({
    limit: options.limit || 10000,
    offset: options.offset || 0,
    ...(options.startDate && { startDate: options.startDate }),
    ...(options.endDate && { endDate: options.endDate })
  });
  const response = await api.get(`/api/admin/companies/${companyId}/contacts?${params}`);
  return response.data;
};

// Admin: Update a contact for a company
export const updateCompanyContact = async (companyId, contactId, data) => {
  const response = await api.put(`/api/admin/companies/${companyId}/contacts/${contactId}`, data);
  return response.data;
};

// Admin: Tag Management
export const addCampaignTag = async (campaignId, tagName) => {
  const response = await api.post(`/api/admin/campaigns/${campaignId}/tags`, { tagName });
  return response.data;
};

export const removeCampaignTag = async (campaignId, tagId) => {
  const response = await api.delete(`/api/admin/campaigns/${campaignId}/tags/${tagId}`);
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

export const getEarliestDataDate = async (shareToken) => {
  const response = await fetch(`${API_URL}/api/dashboard/${shareToken}/earliest-date`);
  if (!response.ok) {
    throw new Error('Failed to fetch earliest date');
  }
  return response.json();
};

export const exportDashboard = (shareToken, filters = {}) => {
  const params = new URLSearchParams(filters);
  return `${API_URL.replace(/\/$/, '')}/api/dashboard/${shareToken}/export?${params}`;
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
