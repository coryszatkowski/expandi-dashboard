import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { getAccountDashboard, deleteCampaign } from '../services/api';
import KPICard from '../components/KPICard';
import ActivityChart from '../components/ActivityChart';
import DateRangePicker from '../components/DateRangePicker';
import Header from '../components/Header';
import { Send, Users, TrendingUp, MessageCircle, ArrowLeft, ChevronRight, Calendar, Edit3, Trash2 } from 'lucide-react';
import { subMonths, startOfMonth, endOfMonth, format } from 'date-fns';
import { formatDateForBackend } from '../utils/timezone';

export default function AccountView() {
  const { shareToken, accountId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isAdmin = searchParams.get('admin') === 'true';
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Calculate last month date range for initial load
  const now = new Date();
  const lastMonth = subMonths(now, 1);
  const start = startOfMonth(lastMonth);
  const end = endOfMonth(lastMonth);
  
  const [filters, setFilters] = useState({
    start_date: formatDateForBackend(start),
    end_date: formatDateForBackend(end)
  });
  const [editMode, setEditMode] = useState(false);
  const [deletingCampaigns, setDeletingCampaigns] = useState(new Set());

  useEffect(() => {
    loadDashboard();
  }, [accountId, filters]);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getAccountDashboard(shareToken, accountId, filters);
      setDashboard(data);
    } catch (err) {
      console.error('Error loading account dashboard:', err);
      setError('Failed to load account data');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCampaign = async (campaignId, campaignName) => {
    if (!window.confirm(`Are you sure you want to delete campaign "${campaignName}"? This action cannot be undone.`)) {
      return;
    }

    setDeletingCampaigns(prev => new Set([...prev, campaignId]));

    try {
      await deleteCampaign(shareToken, campaignId);
      
      // Remove from local state
      setDashboard(prev => ({
        ...prev,
        campaigns: prev.campaigns.filter(campaign => campaign.id !== campaignId)
      }));
      
      // Show success message
      alert(`Campaign "${campaignName}" has been deleted successfully.`);
    } catch (error) {
      console.error('Error deleting campaign:', error);
      alert('Failed to delete campaign. Please try again.');
    } finally {
      setDeletingCampaigns(prev => {
        const newSet = new Set(prev);
        newSet.delete(campaignId);
        return newSet;
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading account data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="text-red-600 text-5xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-600">{error}</p>
          <button
            onClick={() => navigate(`/c/${shareToken}${isAdmin ? '?admin=true' : ''}`)}
            className="mt-4 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-700"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const account = dashboard?.account || {};
  const kpis = dashboard?.kpis || {};
  const campaigns = dashboard?.campaigns || [];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <Header>
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(`/c/${shareToken}${isAdmin ? '?admin=true' : ''}`)}
            className="flex items-center gap-2 text-primary hover:text-primary-700"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>
          <div className="text-sm text-gray-500">
            {account.account_name} Dashboard
          </div>
        </div>
      </Header>

      {/* Page Title Section */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{account.account_name}</h1>
            {account.company_name && (
              <p className="mt-1 text-sm text-gray-500">{account.company_name}</p>
            )}
            {account.account_email && (
              <p className="mt-1 text-sm text-gray-500">{account.account_email}</p>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Date Filter */}
        <div className="mb-6">
          <DateRangePicker onFilter={setFilters} initialRange={filters} shareToken={shareToken} />
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          <KPICard
            title="Invites Sent"
            value={kpis.total_invites?.toLocaleString() || 0}
            icon={Send}
            color="blue"
          />
          <KPICard
            title="Connections"
            value={kpis.total_connections?.toLocaleString() || 0}
            icon={Users}
            color="green"
          />
          <KPICard
            title="Connection Rate"
            value={`${kpis.connection_rate || 0}%`}
            icon={TrendingUp}
            color="blue"
          />
          <KPICard
            title="Replies"
            value={kpis.total_replies?.toLocaleString() || 0}
            icon={MessageCircle}
            color="yellow"
          />
          <KPICard
            title="Response Rate"
            value={`${kpis.response_rate || 0}%`}
            icon={TrendingUp}
            color="green"
          />
        </div>

        {/* Activity Chart */}
        {dashboard?.activity_timeline && dashboard.activity_timeline.length > 0 && (
          <div className="mb-8">
            <ActivityChart data={dashboard.activity_timeline} />
          </div>
        )}

        {/* Campaigns */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Campaigns</h2>
                <p className="text-sm text-gray-500 mt-1">
                  {campaigns.length} {campaigns.length === 1 ? 'campaign' : 'campaigns'} under this account
                </p>
              </div>
              {campaigns.length > 0 && isAdmin && (
                <button
                  onClick={() => setEditMode(!editMode)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    editMode 
                      ? 'bg-red-100 text-red-700 hover:bg-red-200' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <Edit3 className="w-4 h-4" />
                  {editMode ? 'Done' : 'Edit'}
                </button>
              )}
            </div>
          </div>
          <div className="p-6">
            {campaigns.length === 0 ? (
              <div className="text-center py-12">
                <TrendingUp className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-500">No campaigns found</p>
              </div>
            ) : (
              <div className="space-y-4">
                {campaigns.map((campaign) => (
                  <div
                    key={campaign.id}
                    className={`border border-gray-200 rounded-lg p-5 transition-all ${
                      editMode 
                        ? 'hover:border-red-500' 
                        : 'hover:border-blue-500 hover:shadow-md cursor-pointer'
                    }`}
                    onClick={editMode ? undefined : () => navigate(`/c/${shareToken}/campaign/${campaign.id}${isAdmin ? '?admin=true' : ''}`)}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 mb-1">
                          {campaign.campaign_name}
                        </h3>
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <Calendar className="w-4 h-4" />
                          Started: {new Date(campaign.started_at).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {editMode && isAdmin ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteCampaign(campaign.id, campaign.campaign_name);
                            }}
                            disabled={deletingCampaigns.has(campaign.id)}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-full text-red-600 hover:bg-red-100 hover:text-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Delete campaign"
                          >
                            {deletingCampaigns.has(campaign.id) ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        ) : (
                          <ChevronRight className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4">
                      <div>
                        <p className="text-xs text-gray-500">Invites</p>
                        <p className="font-semibold text-gray-900">
                          {campaign.total_invites?.toLocaleString() || 0}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Connections</p>
                        <p className="font-semibold text-gray-900">
                          {campaign.total_connections?.toLocaleString() || 0}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Connection Rate</p>
                        <p className="font-semibold text-green-600">
                          {campaign.connection_rate || 0}%
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Replies</p>
                        <p className="font-semibold text-gray-900">
                          {campaign.total_replies?.toLocaleString() || 0}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Response Rate</p>
                        <p className="font-semibold text-yellow-600">
                          {campaign.response_rate || 0}%
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
