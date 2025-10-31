import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCompanies, createCompany, updateCompany, deleteCompany, getLinkedInAccounts, assignAccount, unassignAccount, getAdminStats, createLinkedInAccount, deleteLinkedInAccount } from '../services/api';
import { logout, login, isAuthenticated } from '../services/auth';
import SettingsModal from '../components/SettingsModal';
import BackfillModal from '../components/BackfillModal';
import CompanyContactsModal from '../components/CompanyContactsModal';
import ErrorNotificationBell from '../components/ErrorNotificationBell';
import Header from '../components/Header';
import { Plus, TrendingUp, Users, Briefcase, AlertCircle, ExternalLink, Edit, Trash2, Copy, Check, ArrowUpDown, LogOut, Lock, User, Settings, FileSpreadsheet } from 'lucide-react';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [loginForm, setLoginForm] = useState({
    username: '',
    password: ''
  });
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showBackfillModal, setShowBackfillModal] = useState(false);
  const [backfillProfile, setBackfillProfile] = useState(null);
  const [showContactsModal, setShowContactsModal] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [showNewCompanyModal, setShowNewCompanyModal] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [showEditCompanyModal, setShowEditCompanyModal] = useState(false);
  const [editingCompany, setEditingCompany] = useState(null);
  const [editCompanyName, setEditCompanyName] = useState('');
  const [showAddLinkedInModal, setShowAddLinkedInModal] = useState(false);
  const [newLinkedInAccount, setNewLinkedInAccount] = useState({
    account_name: '',
    company_id: ''
  });
  const [editCompaniesMode, setEditCompaniesMode] = useState(false);
  const [editAccountsMode, setEditAccountsMode] = useState(false);
  const [deletingCompanies, setDeletingCompanies] = useState(new Set());
  const [deletingAccounts, setDeletingAccounts] = useState(new Set());
  const [generatedWebhookUrl, setGeneratedWebhookUrl] = useState('');
  const [generatedAccountId, setGeneratedAccountId] = useState('');
  const [copiedToClipboard, setCopiedToClipboard] = useState(false);
  const [accountSortBy, setAccountSortBy] = useState('name'); // 'name' or 'date'

  useEffect(() => {
    // Check authentication status
    const authStatus = isAuthenticated();
    setAuthenticated(authStatus);
    
    if (authStatus) {
      loadData();
    } else {
      setLoading(false);
    }
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError('');

    try {
      const result = await login(loginForm.username, loginForm.password);
      
      if (result.success) {
        setAuthenticated(true);
        setLoginForm({ username: '', password: '' });
        loadData();
      } else {
        setLoginError(result.error || 'Login failed');
      }
    } catch (error) {
      console.error('Login error:', error);
      setLoginError('Network error. Please try again.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLoginChange = (e) => {
    setLoginForm({
      ...loginForm,
      [e.target.name]: e.target.value
    });
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [companiesData, accountsData, statsData] = await Promise.all([
        getCompanies(),
        getLinkedInAccounts(),
        getAdminStats(),
      ]);

      // Ensure we have valid data before setting state
      setCompanies(companiesData?.companies || []);
      setAccounts(accountsData?.accounts || []);
      setStats(statsData?.stats || {});
      
      console.log('Data loaded successfully:', {
        companies: companiesData?.companies?.length || 0,
        accounts: accountsData?.accounts?.length || 0,
        stats: statsData?.stats ? 'loaded' : 'empty'
      });
    } catch (error) {
      console.error('Error loading data:', error);
      // Set empty arrays on error to prevent undefined state
      setCompanies([]);
      setAccounts([]);
      setStats({});
      alert('Failed to load data. Please refresh the page.');
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
      if (companyId === '') {
        // Unassign account
        await unassignAccount(accountId);
      } else {
        // Assign or reassign account
        await assignAccount(accountId, companyId);
      }
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

  const openCompanyDashboard = (shareToken) => {
    navigate(`/c/${shareToken}?admin=true`);
  };

  const openAccountDashboard = (account) => {
    if (account.company_id) {
      // Find the company to get the share token
      const company = companies.find(c => c.id === account.company_id);
      if (company) {
        navigate(`/c/${company.share_token}/account/${account.id}?admin=true`);
      }
    }
  };

  const openEditCompanyModal = (company) => {
    setEditingCompany(company);
    setEditCompanyName(company.name);
    setShowEditCompanyModal(true);
  };

  const handleEditCompany = async (e) => {
    e.preventDefault();
    try {
      await updateCompany(editingCompany.id, { name: editCompanyName });
      setShowEditCompanyModal(false);
      setEditingCompany(null);
      setEditCompanyName('');
      loadData();
    } catch (error) {
      console.error('Error updating company:', error);
      alert('Failed to update company');
    }
  };


  const openAddLinkedInModal = (companyId = '') => {
    setNewLinkedInAccount({
      account_name: '',
      company_id: companyId
    });
    setGeneratedWebhookUrl('');
    setGeneratedAccountId('');
    setCopiedToClipboard(false);
    setShowAddLinkedInModal(true);
  };

  const openBackfillModal = (account) => {
    setBackfillProfile(account);
    setShowBackfillModal(true);
  };

  const openContactsModal = (company) => {
    setSelectedCompany({ id: company.id, name: company.name });
    setShowContactsModal(true);
  };

  const closeAddLinkedInModal = () => {
    setShowAddLinkedInModal(false);
    setNewLinkedInAccount({
      account_name: '',
      company_id: ''
    });
    setGeneratedWebhookUrl('');
    setGeneratedAccountId('');
    setCopiedToClipboard(false);
  };


  const handleCreateLinkedInAccount = async (e) => {
    e.preventDefault();
    if (!newLinkedInAccount.account_name.trim()) {
      alert('Please enter an account name');
      return;
    }

    try {
      const response = await createLinkedInAccount({
        account_name: newLinkedInAccount.account_name,
        company_id: newLinkedInAccount.company_id || null
      });
      
      // Show webhook URL from backend response
      if (response.webhook_url) {
        setGeneratedWebhookUrl(response.webhook_url);
        // Don't close modal yet - let user copy the webhook URL
        loadData();
        // Don't call closeAddLinkedInModal() here - let user close it manually after copying
      } else {
        loadData();
        closeAddLinkedInModal();
      }
    } catch (error) {
      console.error('Error creating LinkedIn account:', error);
      alert('Failed to create LinkedIn account: ' + (error.response?.data?.error || error.message));
    }
  };

  const copyWebhookUrl = async () => {
    if (generatedWebhookUrl) {
      try {
        await navigator.clipboard.writeText(generatedWebhookUrl);
        setCopiedToClipboard(true);
        setTimeout(() => setCopiedToClipboard(false), 2000);
      } catch (error) {
        console.error('Failed to copy to clipboard:', error);
        alert('Failed to copy to clipboard');
      }
    }
  };

  const handleDeleteCompany = async (companyId, companyName) => {
    if (!window.confirm(`Are you sure you want to delete the company "${companyName}"? This action cannot be undone.`)) {
      return;
    }

    setDeletingCompanies(prev => new Set([...prev, companyId]));

    try {
      await deleteCompany(companyId);
      setCompanies(prev => prev.filter(company => company.id !== companyId));
      alert(`Company "${companyName}" deleted successfully!`);
    } catch (error) {
      console.error('Error deleting company:', error);
      alert('Failed to delete company: ' + (error.response?.data?.error || error.message));
    } finally {
      setDeletingCompanies(prev => {
        const newSet = new Set(prev);
        newSet.delete(companyId);
        return newSet;
      });
    }
  };

  const handleDeleteLinkedInAccount = async (accountId, accountName) => {
    if (!window.confirm(`Are you sure you want to delete the LinkedIn account "${accountName}"? This action cannot be undone.`)) {
      return;
    }

    setDeletingAccounts(prev => new Set([...prev, accountId]));

    try {
      await deleteLinkedInAccount(accountId);
      setAccounts(prev => prev.filter(account => account.id !== accountId));
      alert(`LinkedIn account "${accountName}" deleted successfully!`);
    } catch (error) {
      console.error('Error deleting LinkedIn account:', error);
      alert('Failed to delete LinkedIn account: ' + (error.response?.data?.error || error.message));
    } finally {
      setDeletingAccounts(prev => {
        const newSet = new Set(prev);
        newSet.delete(accountId);
        return newSet;
      });
    }
  };

  const handleLogout = () => {
    logout();
    setAuthenticated(false);
    setLoginForm({ username: '', password: '' });
    setLoginError('');
  };

  // Show login form if not authenticated
  if (!authenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="flex justify-center">
            <div className="bg-primary p-3 rounded-full">
              <Lock className="w-8 h-8 text-white" />
            </div>
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Admin Login
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Sign in to access the admin dashboard
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
            <form className="space-y-6" onSubmit={handleLogin}>
              {loginError && (
                <div className="bg-red-50 border border-red-200 rounded-md p-4">
                  <div className="flex">
                    <AlertCircle className="w-5 h-5 text-red-400" />
                    <div className="ml-3">
                      <p className="text-sm text-red-800">{loginError}</p>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                  Username
                </label>
                <div className="mt-1 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="username"
                    name="username"
                    type="email"
                    autoComplete="email"
                    required
                    value={loginForm.username}
                    onChange={handleLoginChange}
                    className="appearance-none block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm bg-white text-gray-900"
                    placeholder="Enter your email"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Password
                </label>
                <div className="mt-1 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={loginForm.password}
                    onChange={handleLoginChange}
                    className="appearance-none block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm bg-white text-gray-900"
                    placeholder="Enter your password"
                  />
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={loginLoading}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loginLoading ? (
                    <div className="flex items-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Signing in...
                    </div>
                  ) : (
                    'Sign in'
                  )}
                </button>
              </div>
            </form>

            <div className="mt-6">
              <div className="text-center">
                <p className="text-sm text-gray-600">
                  Need access? Contact your administrator.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const unassignedAccounts = accounts.filter(a => a.status === 'unassigned');

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }


  // Sort accounts based on selected criteria
  const getSortedAccounts = () => {
    const sortedAccounts = [...accounts];
    if (accountSortBy === 'name') {
      return sortedAccounts.sort((a, b) => a.account_name.localeCompare(b.account_name));
    } else if (accountSortBy === 'date') {
      return sortedAccounts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }
    return sortedAccounts;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <Header>
        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"
          >
            Refresh Data
          </button>
          <ErrorNotificationBell />
          <button
            onClick={() => setShowSettingsModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            <Settings className="w-4 h-4" />
            Settings
          </button>
        </div>
      </Header>

      {/* Page Title Section */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
            <p className="mt-1 text-sm text-gray-500">Manage companies and LinkedIn accounts</p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Companies</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.total_companies}</p>
                </div>
                <Briefcase className="w-8 h-8 text-primary" />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">LinkedIn Accounts</p>
                  <p className="text-2xl font-bold text-gray-900">{stats?.total_linkedin_accounts || accounts.length}</p>
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
            <div className="flex items-center gap-4">
              <h2 className="text-xl font-semibold text-gray-900">Companies</h2>
              {companies.length > 0 && (
                <button
                  onClick={() => setEditCompaniesMode(!editCompaniesMode)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    editCompaniesMode 
                      ? 'bg-red-100 text-red-700 hover:bg-red-200' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <Edit className="w-4 h-4" />
                  {editCompaniesMode ? 'Done' : 'Edit'}
                </button>
              )}
            </div>
            <button
              onClick={() => setShowNewCompanyModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-700"
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
                      <button
                        onClick={() => openCompanyDashboard(company.share_token)}
                        className="text-lg font-semibold text-primary hover:text-primary-800 hover:underline flex items-center gap-2 transition-colors"
                      >
                        {company.name}
                        <ExternalLink className="w-4 h-4" />
                      </button>
                      <p className="text-sm text-gray-500">
                        {company.profiles_count} accounts • {company.campaigns_count} campaigns
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {editCompaniesMode ? (
                        <button
                          onClick={() => handleDeleteCompany(company.id, company.name)}
                          disabled={deletingCompanies.has(company.id)}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-full text-red-600 hover:bg-red-100 hover:text-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Delete company"
                        >
                          {deletingCompanies.has(company.id) ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => openContactsModal(company)}
                            className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 flex items-center gap-2"
                          >
                            <FileSpreadsheet className="w-4 h-4" />
                            View Contacts
                          </button>
                          <button
                            onClick={() => openEditCompanyModal(company)}
                            className="px-4 py-2 bg-primary-100 text-primary-700 rounded-lg hover:bg-primary-200 flex items-center gap-2"
                          >
                            <Edit className="w-4 h-4" />
                            Edit Company
                          </button>
                          <button
                            onClick={() => copyShareLink(company.share_token)}
                            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                          >
                            Copy Dashboard Link
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* LinkedIn Accounts */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h2 className="text-xl font-semibold text-gray-900">LinkedIn Accounts</h2>
              {accounts.length > 0 && (
                <>
                  <button
                    onClick={() => setEditAccountsMode(!editAccountsMode)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      editAccountsMode 
                        ? 'bg-red-100 text-red-700 hover:bg-red-200' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <Edit className="w-4 h-4" />
                    {editAccountsMode ? 'Done' : 'Edit'}
                  </button>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              <ArrowUpDown className="w-4 h-4 text-gray-500" />
              <select
                value={accountSortBy}
                onChange={(e) => setAccountSortBy(e.target.value)}
                className="px-3 py-1 border border-gray-300 rounded-lg text-sm bg-white text-gray-900"
              >
                <option value="name">Sort by Name</option>
                <option value="date">Sort by Date Added</option>
              </select>
            </div>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {getSortedAccounts().map(account => (
                <div key={account.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      {account.company_id ? (
                        <button
                          onClick={() => openAccountDashboard(account)}
                          className="text-lg font-medium text-primary hover:text-primary-800 hover:underline flex items-center gap-2 transition-colors"
                        >
                          {account.account_name}
                          <ExternalLink className="w-4 h-4" />
                        </button>
                      ) : (
                        <h3 className="text-lg font-medium text-gray-900">{account.account_name}</h3>
                      )}
                      <p className="text-sm text-gray-500">
                        {account.company_name || 'Unassigned'} • {account.campaigns_count} campaigns
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {editAccountsMode ? (
                        <button
                          onClick={() => handleDeleteLinkedInAccount(account.id, account.account_name)}
                          disabled={deletingAccounts.has(account.id)}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-full text-red-600 hover:bg-red-100 hover:text-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Delete LinkedIn account"
                        >
                          {deletingAccounts.has(account.id) ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => {
                              setBackfillProfile({ id: account.id, account_name: account.account_name });
                              setShowBackfillModal(true);
                            }}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-primary-100 text-primary-700 hover:bg-primary-200 transition-colors"
                          >
                            <FileSpreadsheet className="w-4 h-4" />
                            Import Data
                          </button>
                          <button
                            onClick={async (e) => {
                              try {
                                const webhookUrl = `https://api.dashboard.theorionstrategy.com/api/webhooks/expandi/account/${account.webhook_id}`;
                                console.log('Webhook URL:', webhookUrl); // Debug log
                                
                                // Try modern clipboard API first
                                if (navigator.clipboard && window.isSecureContext) {
                                  await navigator.clipboard.writeText(webhookUrl);
                                } else {
                                  // Fallback for older browsers or non-secure contexts
                                  const textArea = document.createElement('textarea');
                                  textArea.value = webhookUrl;
                                  textArea.style.position = 'fixed';
                                  textArea.style.left = '-999999px';
                                  textArea.style.top = '-999999px';
                                  document.body.appendChild(textArea);
                                  textArea.focus();
                                  textArea.select();
                                  document.execCommand('copy');
                                  document.body.removeChild(textArea);
                                }
                                
                                // Show success message
                                const button = e.currentTarget;
                                const originalText = button.textContent;
                                button.textContent = 'Copied!';
                                button.className = button.className.replace('bg-green-100 text-green-700 hover:bg-green-200', 'bg-green-200 text-green-800');
                                setTimeout(() => {
                                  button.textContent = originalText;
                                  button.className = button.className.replace('bg-green-200 text-green-800', 'bg-green-100 text-green-700 hover:bg-green-200');
                                }, 2000);
                              } catch (error) {
                                console.error('Copy error:', error);
                                // Show error feedback on button
                                const button = e.currentTarget;
                                const originalText = button.textContent;
                                button.textContent = 'Copy Failed';
                                button.className = button.className.replace('bg-green-100 text-green-700 hover:bg-green-200', 'bg-red-100 text-red-700');
                                setTimeout(() => {
                                  button.textContent = originalText;
                                  button.className = button.className.replace('bg-red-100 text-red-700', 'bg-green-100 text-green-700 hover:bg-green-200');
                                }, 2000);
                              }
                            }}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-green-100 text-green-700 hover:bg-green-200 transition-colors"
                          >
                            <Copy className="w-4 h-4" />
                            Copy Webhook URL
                          </button>
                          {account.status === 'unassigned' && (
                            <span className="px-3 py-2 bg-yellow-100 text-yellow-800 rounded-lg text-sm">
                              Unassigned
                            </span>
                          )}
                        </>
                      )}
                    </div>
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-4 bg-white text-gray-900"
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
                    className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-700"
                  >
                    Create
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Company Modal */}
        {showEditCompanyModal && editingCompany && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Edit Company: {editingCompany.name}</h3>
              
              {/* Company Name Edit */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Company Name</label>
                <form onSubmit={handleEditCompany} className="flex gap-2">
                  <input
                    type="text"
                    value={editCompanyName}
                    onChange={(e) => setEditCompanyName(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                    required
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-700"
                  >
                    Update Name
                  </button>
                </form>
              </div>

              {/* LinkedIn Accounts Management */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-md font-medium text-gray-900">LinkedIn Accounts</h4>
                  <button
                    onClick={() => openAddLinkedInModal(editingCompany.id)}
                    className="px-3 py-1 bg-primary-100 text-primary-700 rounded text-sm hover:bg-primary-200 flex items-center gap-1"
                  >
                    <Plus className="w-4 h-4" />
                    Add LinkedIn Account
                  </button>
                </div>
                <div className="space-y-2">
                  {accounts
                    .filter(account => account.company_id === editingCompany.id)
                    .map(account => (
                      <div key={account.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <span className="font-medium text-gray-900">{account.account_name}</span>
                          <span className="text-sm text-gray-500 ml-2">• {account.campaigns_count} campaigns</span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleAssignAccount(account.id, '')}
                            className="px-3 py-1 bg-red-100 text-red-700 rounded text-sm hover:bg-red-200"
                          >
                            Unassign
                          </button>
                          <button
                            onClick={() => handleDeleteLinkedInAccount(account.id, account.account_name)}
                            className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 flex items-center gap-1"
                          >
                            <Trash2 className="w-3 h-3" />
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  
                  {accounts.filter(account => account.company_id === editingCompany.id).length === 0 && (
                    <p className="text-gray-500 text-sm">No LinkedIn accounts assigned to this company.</p>
                  )}
                </div>
              </div>

              {/* Unassigned Accounts */}
              <div className="mb-6">
                <h4 className="text-md font-medium text-gray-900 mb-3">Available LinkedIn Accounts</h4>
                <div className="space-y-2">
                  {accounts
                    .filter(account => account.status === 'unassigned')
                    .map(account => (
                      <div key={account.id} className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                        <div>
                          <span className="font-medium text-gray-900">{account.account_name}</span>
                          <span className="text-sm text-gray-500 ml-2">• {account.campaigns_count} campaigns</span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleAssignAccount(account.id, editingCompany.id)}
                            className="px-3 py-1 bg-green-100 text-green-700 rounded text-sm hover:bg-green-200"
                          >
                            Assign
                          </button>
                          <button
                            onClick={() => handleDeleteLinkedInAccount(account.id, account.account_name)}
                            className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 flex items-center gap-1"
                          >
                            <Trash2 className="w-3 h-3" />
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  
                  {accounts.filter(account => account.status === 'unassigned').length === 0 && (
                    <p className="text-gray-500 text-sm">No unassigned LinkedIn accounts available.</p>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 justify-between pt-4 border-t border-gray-200">
                <button
                  onClick={() => handleDeleteCompany(editingCompany.id, editingCompany.name)}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Company
                </button>
                <button
                  onClick={() => {
                    setShowEditCompanyModal(false);
                    setEditingCompany(null);
                    setEditCompanyName('');
                  }}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add LinkedIn Account Modal */}
        {showAddLinkedInModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Add LinkedIn Account</h3>
              
              <form onSubmit={handleCreateLinkedInAccount} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Account Name</label>
                  <input
                    type="text"
                    value={newLinkedInAccount.account_name}
                    onChange={(e) => {
                      setNewLinkedInAccount({...newLinkedInAccount, account_name: e.target.value});
                    }}
                    placeholder="e.g., John Doe"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Assign to Company</label>
                  <select
                    value={newLinkedInAccount.company_id}
                    onChange={(e) => setNewLinkedInAccount({...newLinkedInAccount, company_id: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                  >
                    <option value="">Leave unassigned</option>
                    {companies.map(company => (
                      <option key={company.id} value={company.id}>{company.name}</option>
                    ))}
                  </select>
                </div>

                {generatedWebhookUrl && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Webhook URL for Expandi</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={generatedWebhookUrl}
                        readOnly
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-black text-white text-sm font-mono"
                      />
                      <button
                        type="button"
                        onClick={copyWebhookUrl}
                        className="px-3 py-2 bg-primary-100 text-primary-700 rounded-lg hover:bg-primary-200 flex items-center gap-1"
                      >
                        {copiedToClipboard ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        {copiedToClipboard ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Copy this URL and paste it into Expandi's webhook settings</p>
                  </div>
                )}

                <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
                  <h5 className="text-sm font-medium text-primary-800 mb-2">Instructions:</h5>
                  <ol className="text-sm text-primary-700 space-y-1 list-decimal list-inside">
                    <li>Enter the account name above</li>
                    <li>Click "Create Account" below to save it to your dashboard</li>
                    <li>Copy the generated webhook URL that appears after creation</li>
                    <li>In Expandi, go to your LinkedIn account settings</li>
                    <li>Paste the webhook URL in the webhook settings</li>
                  </ol>
                </div>

                <div className="flex gap-2 justify-end pt-4">
                  <button
                    type="button"
                    onClick={closeAddLinkedInModal}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!newLinkedInAccount.account_name.trim()}
                    className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    Create Account
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Settings Modal */}
        <SettingsModal 
          isOpen={showSettingsModal} 
          onClose={() => setShowSettingsModal(false)} 
        />

        {/* Backfill Modal */}
        <BackfillModal 
          isOpen={showBackfillModal} 
          onClose={() => setShowBackfillModal(false)}
          profileId={backfillProfile?.id}
          profileName={backfillProfile?.account_name}
          profiles={accounts}
        />

        {/* Company Contacts Modal */}
        {showContactsModal && selectedCompany && (
          <CompanyContactsModal
            isOpen={showContactsModal}
            onClose={() => {
              setShowContactsModal(false);
              setSelectedCompany(null);
            }}
            companyId={selectedCompany.id}
            companyName={selectedCompany.name}
          />
        )}
    </div>
  );
}
