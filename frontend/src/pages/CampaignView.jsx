import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { getCampaignDashboard, deleteContact } from '../services/api';
import KPICard from '../components/KPICard';
import ActivityChart from '../components/ActivityChart';
import DateRangePicker from '../components/DateRangePicker';
import Header from '../components/Header';
import { formatDateTime, formatDate } from '../utils/timezone';
import { Send, Users, TrendingUp, MessageCircle, ArrowLeft, Calendar, Edit3, Trash2 } from 'lucide-react';
import { subMonths, startOfMonth, endOfMonth, format } from 'date-fns';
import { formatDateForBackend } from '../utils/timezone';


export default function CampaignView() {
  const { shareToken, campaignId } = useParams();
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
  const [deletingContacts, setDeletingContacts] = useState(new Set());

  useEffect(() => {
    loadDashboard();
  }, [campaignId, filters]);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getCampaignDashboard(shareToken, campaignId, filters);
      setDashboard(data);
    } catch (err) {
      console.error('Error loading campaign dashboard:', err);
      setError('Failed to load campaign data');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteContact = async (contactId, contactName) => {
    if (!window.confirm(`Are you sure you want to delete ${contactName}? This action cannot be undone.`)) {
      return;
    }

    setDeletingContacts(prev => new Set([...prev, contactId]));

    try {
      await deleteContact(shareToken, contactId);
      
      // Remove from local state
      setDashboard(prev => ({
        ...prev,
        contacts: prev.contacts.filter(contact => contact.contact_id !== contactId)
      }));
      
      // Show success message
      alert(`${contactName} has been deleted successfully.`);
    } catch (error) {
      console.error('Error deleting contact:', error);
      alert('Failed to delete contact. Please try again.');
    } finally {
      setDeletingContacts(prev => {
        const newSet = new Set(prev);
        newSet.delete(contactId);
        return newSet;
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading campaign data...</p>
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

  const campaign = dashboard?.campaign || {};
  const kpis = dashboard?.kpis || {};
  const timeline = dashboard?.activity_timeline || [];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <Header>
        <div className="flex items-center gap-4">
          <button
            onClick={() => window.history.back()}
            className="flex items-center gap-2 text-primary hover:text-primary-700"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <div className="text-sm text-gray-500">
            Campaign: {campaign.campaign_name}
          </div>
        </div>
      </Header>

      {/* Page Title Section */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">{campaign.campaign_name}</h1>
            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                {campaign.account_name}
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Started: {formatDate(campaign.started_at)}
              </div>
            </div>
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

        {/* Activity Timeline */}
        {timeline.length > 0 ? (
          <div className="mb-8">
            <ActivityChart data={timeline} height={350} />
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow p-12 text-center mb-8">
            <TrendingUp className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500">No activity data available yet</p>
          </div>
        )}

        {/* Contacts Table */}
        {dashboard?.contacts && dashboard.contacts.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Contacts ({dashboard.contacts.length})</h2>
              {isAdmin && (
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
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Contact
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Invited
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Connected
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Replied
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    {editMode && (
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {dashboard.contacts.map((contact) => (
                    <tr key={contact.contact_id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="max-w-xs">
                          <div className="text-sm font-medium text-gray-900 truncate">
                            {contact.first_name} {contact.last_name}
                          </div>
                          <div className="text-xs text-gray-500 truncate">
                            {contact.job_title} at {contact.company_name}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex flex-col items-center">
                          {contact.invited ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              ✓
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                              ✗
                            </span>
                          )}
                          {contact.invited_at && (
                            <div className="text-xs text-gray-500 mt-1">
                              {formatDateTime(contact.invited_at)}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex flex-col items-center">
                          {contact.connected ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              ✓
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                              ✗
                            </span>
                          )}
                          {contact.connected_at && (
                            <div className="text-xs text-gray-500 mt-1">
                              {formatDateTime(contact.connected_at)}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex flex-col items-center">
                          {contact.replied ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              ✓
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                              ✗
                            </span>
                          )}
                          {contact.replied_at && (
                            <div className="text-xs text-gray-500 mt-1">
                              {formatDateTime(contact.replied_at)}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          contact.conversation_status === 'Replied'
                            ? 'bg-green-100 text-green-800'
                            : contact.conversation_status === 'Awaiting Reply'
                            ? 'bg-yellow-100 text-yellow-800'
                            : contact.conversation_status === 'Pending Connection'
                            ? 'bg-blue-100 text-blue-800'
                            : contact.conversation_status === 'Not Invited'
                            ? 'bg-gray-100 text-gray-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {contact.conversation_status}
                        </span>
                      </td>
                      {editMode && isAdmin && (
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <button
                            onClick={() => handleDeleteContact(
                              contact.contact_id, 
                              `${contact.first_name} ${contact.last_name}`
                            )}
                            disabled={deletingContacts.has(contact.contact_id)}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-full text-red-600 hover:bg-red-100 hover:text-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Delete contact"
                          >
                            {deletingContacts.has(contact.contact_id) ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Campaign Details */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Campaign Details</h2>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <dt className="text-sm font-medium text-gray-500">Campaign ID</dt>
              <dd className="mt-1 text-sm text-gray-900 font-mono">{campaign.campaign_instance}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">LinkedIn Account</dt>
              <dd className="mt-1 text-sm text-gray-900">{campaign.account_name}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Start Date</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {formatDate(campaign.started_at)}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Status</dt>
              <dd className="mt-1">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  Active
                </span>
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
