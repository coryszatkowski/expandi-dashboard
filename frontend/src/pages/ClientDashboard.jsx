import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { getCompanyDashboard, exportDashboard } from '../services/api';
import KPICard from '../components/KPICard';
import ActivityChart from '../components/ActivityChart';
import DateRangePicker from '../components/DateRangePicker';
import Header from '../components/Header';
import { Send, Users, TrendingUp, MessageCircle, Download, ChevronRight, ArrowLeft } from 'lucide-react';

export default function ClientDashboard() {
  const { shareToken } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isAdmin = searchParams.get('admin') === 'true';
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({});

  useEffect(() => {
    loadDashboard();
  }, [shareToken, filters]);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getCompanyDashboard(shareToken, filters);
      setDashboard(data);
    } catch (err) {
      console.error('Error loading dashboard:', err);
      setError(err.response?.status === 404 ? 'Dashboard not found' : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    const url = exportDashboard(shareToken, filters);
    window.open(url, '_blank');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
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
        </div>
      </div>
    );
  }

  const kpis = dashboard?.kpis || {};
  const timeline = dashboard?.activity_timeline || [];
  const accounts = dashboard?.linkedin_accounts || [];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <Header>
        <div className="flex items-center gap-4">
          {isAdmin && (
            <button
              onClick={() => navigate('/admin')}
              className="flex items-center gap-2 text-primary hover:text-primary-700"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Admin
            </button>
          )}
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </Header>

      {/* Page Title Section */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{dashboard?.company?.name}</h1>
            <p className="mt-1 text-sm text-gray-500">Campaign Performance Dashboard</p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Date Filter */}
        <div className="mb-6">
          <DateRangePicker onFilter={setFilters} initialRange={filters} />
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
        {timeline.length > 0 && (
          <div className="mb-8">
            <ActivityChart data={timeline} height={350} />
          </div>
        )}

        {/* LinkedIn Accounts */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">LinkedIn Accounts</h2>
            <p className="text-sm text-gray-500 mt-1">
              Click an account to view detailed campaign performance
            </p>
          </div>
          <div className="p-6">
            {accounts.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-500">No LinkedIn accounts assigned yet</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {accounts.map((account) => (
                  <div
                    key={account.id}
                    onClick={() => navigate(`/c/${shareToken}/account/${account.id}${isAdmin ? '?admin=true' : ''}`)}
                    className="border border-gray-200 rounded-lg p-5 hover:border-blue-500 hover:shadow-md transition-all cursor-pointer"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {account.account_name}
                      </h3>
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-sm">
                      <div>
                        <p className="text-gray-500">Invites</p>
                        <p className="font-semibold text-gray-900">
                          {account.total_invites?.toLocaleString() || 0}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">Connections</p>
                        <p className="font-semibold text-gray-900">
                          {account.total_connections?.toLocaleString() || 0}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">Rate</p>
                        <p className="font-semibold text-green-600">
                          {account.connection_rate || 0}%
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 text-xs text-gray-500">
                      {account.campaigns_count || 0} {account.campaigns_count === 1 ? 'campaign' : 'campaigns'}
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
