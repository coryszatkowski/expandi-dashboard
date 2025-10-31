import React, { useState, useEffect } from 'react';
import { X, FileSpreadsheet, Download } from 'lucide-react';
import { getCompanyContacts } from '../services/api';
import { formatDateTime } from '../utils/timezone';

export default function CompanyContactsModal({ isOpen, onClose, companyId, companyName }) {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    if (isOpen && companyId) {
      loadContacts();
    } else {
      // Reset state when modal closes
      setContacts([]);
      setError(null);
      setTotalCount(0);
    }
  }, [isOpen, companyId]);

  const loadContacts = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getCompanyContacts(companyId, { limit: 10000 });
      if (data.success) {
        setContacts(data.contacts || []);
        setTotalCount(data.total_count || 0);
      } else {
        setError(data.error || 'Failed to load contacts');
      }
    } catch (err) {
      console.error('Error loading contacts:', err);
      setError('Failed to load contacts');
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    const headers = ['Contact ID', 'First Name', 'Last Name', 'Company', 'Job Title', 'Email', 'Phone', 'Profile Link', 'Campaign', 'Profile', 'Created At'];
    const rows = contacts.map(contact => [
      contact.unique_contact_id || '',
      contact.first_name || '',
      contact.last_name || '',
      contact.company_name || '',
      contact.job_title || '',
      contact.email || '',
      contact.phone || '',
      contact.profile_link || '',
      contact.campaign_name || '',
      contact.profile_name || '',
      contact.created_at ? formatDateTime(contact.created_at) : ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${companyName.replace(/[^a-z0-9]/gi, '_')}_contacts_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-7xl mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 p-2 rounded-lg">
              <FileSpreadsheet className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Company Contacts</h2>
              <p className="text-sm text-gray-500">{companyName} ({totalCount} total)</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {contacts.length > 0 && (
              <button
                onClick={exportToCSV}
                className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
            )}
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : error ? (
            <div className="text-center text-red-600 py-8">{error}</div>
          ) : contacts.length === 0 ? (
            <div className="text-center text-gray-500 py-8">No contacts found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact ID</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Job Title</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Profile Link</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Campaign</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Profile</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created At</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {contacts.map((contact, index) => (
                    <tr key={`${contact.unique_contact_id}-${index}`} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{contact.unique_contact_id || '-'}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        {contact.first_name || ''} {contact.last_name || ''}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{contact.company_name || '-'}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{contact.job_title || '-'}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{contact.email || '-'}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{contact.phone || '-'}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm">
                        {contact.profile_link ? (
                          <a href={contact.profile_link} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                            View Profile
                          </a>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{contact.campaign_name || '-'}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{contact.profile_name || '-'}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        {contact.created_at ? formatDateTime(contact.created_at) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

