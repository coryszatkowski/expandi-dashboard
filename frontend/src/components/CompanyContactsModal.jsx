import React, { useState, useEffect } from 'react';
import { X, FileSpreadsheet, Download, Edit2, Save, XCircle } from 'lucide-react';
import { getCompanyContacts, updateCompanyContact, updateContactEvents } from '../services/api';
import { formatDateTime } from '../utils/timezone';

export default function CompanyContactsModal({ isOpen, onClose, companyId, companyName }) {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [totalCount, setTotalCount] = useState(0);
  const [editingContact, setEditingContact] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [savingContact, setSavingContact] = useState(null);

  useEffect(() => {
    if (isOpen && companyId) {
      loadContacts();
    } else {
      // Reset state when modal closes
      setContacts([]);
      setError(null);
      setTotalCount(0);
      setEditingContact(null);
      setEditForm({});
      setSavingContact(null);
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
    const headers = ['Contact ID', 'First Name', 'Last Name', 'Company', 'Job Title', 'Email', 'Phone', 'Profile Link', 'Campaign', 'Profile', 'Invited', 'Invited At', 'Connected', 'Connected At', 'Replied', 'Replied At', 'Created At'];
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
      contact.invited_at ? 'Yes' : 'No',
      contact.invited_at ? formatDateTime(contact.invited_at) : '',
      contact.connected_at ? 'Yes' : 'No',
      contact.connected_at ? formatDateTime(contact.connected_at) : '',
      contact.replied_at ? 'Yes' : 'No',
      contact.replied_at ? formatDateTime(contact.replied_at) : '',
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

  const startEditing = (contact) => {
    setEditingContact(`${contact.contact_id}-${contact.campaign_id}`);
    setEditForm({
      first_name: contact.first_name || '',
      last_name: contact.last_name || '',
      company_name: contact.company_name || '',
      job_title: contact.job_title || '',
      email: contact.email || '',
      phone: contact.phone || '',
      profile_link: contact.profile_link || '',
      campaign_name: contact.campaign_name || '',
      profile_name: contact.profile_name || '',
      invited_at: contact.invited_at || null,
      connected_at: contact.connected_at || null,
      replied_at: contact.replied_at || null
    });
  };

  const cancelEditing = () => {
    setEditingContact(null);
    setEditForm({});
  };

  const handleSave = async (contact) => {
    try {
      setSavingContact(`${contact.contact_id}-${contact.campaign_id}`);
      
      // Update contact fields
      const contactData = await updateCompanyContact(companyId, contact.contact_id, {
        campaign_id: contact.campaign_id,
        first_name: editForm.first_name,
        last_name: editForm.last_name,
        company_name: editForm.company_name,
        job_title: editForm.job_title,
        email: editForm.email,
        phone: editForm.phone,
        profile_link: editForm.profile_link,
        campaign_name: editForm.campaign_name,
        profile_name: editForm.profile_name
      });

      if (!contactData.success) {
        throw new Error(contactData.error || 'Failed to update contact');
      }

      // Update event timestamps if changed
      const eventUpdates = {};
      if (editForm.invited_at !== contact.invited_at) {
        eventUpdates.invited = {
          checked: !!editForm.invited_at,
          at: editForm.invited_at || undefined
        };
      }
      if (editForm.connected_at !== contact.connected_at) {
        eventUpdates.connected = {
          checked: !!editForm.connected_at,
          at: editForm.connected_at || undefined
        };
      }
      if (editForm.replied_at !== contact.replied_at) {
        eventUpdates.replied = {
          checked: !!editForm.replied_at,
          at: editForm.replied_at || undefined
        };
      }

      if (Object.keys(eventUpdates).length > 0) {
        await updateContactEvents(contact.campaign_id, contact.contact_id, eventUpdates);
      }

      // Update the contact in the local state
      setContacts(prevContacts =>
        prevContacts.map(c =>
          c.contact_id === contact.contact_id && c.campaign_id === contact.campaign_id
            ? { ...c, ...editForm }
            : c
        )
      );
      setEditingContact(null);
      setEditForm({});
    } catch (err) {
      console.error('Error saving contact:', err);
      alert('Failed to save contact: ' + (err.message || 'Please try again.'));
    } finally {
      setSavingContact(null);
    }
  };

  const updateEditForm = (field, value) => {
    setEditForm(prev => ({ ...prev, [field]: value }));
  };

  const isEditing = (contact) => editingContact === `${contact.contact_id}-${contact.campaign_id}`;
  const isSaving = (contact) => savingContact === `${contact.contact_id}-${contact.campaign_id}`;

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
        <div className="flex-1 overflow-x-auto overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : error ? (
            <div className="text-center text-red-600 py-8">{error}</div>
          ) : contacts.length === 0 ? (
            <div className="text-center text-gray-500 py-8">No contacts found</div>
          ) : (
            <div>
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
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Invited</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Connected</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Replied</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created At</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {contacts.map((contact, index) => {
                    const editing = isEditing(contact);
                    const saving = isSaving(contact);
                    
                    return (
                    <tr key={`${contact.unique_contact_id}-${index}`} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{contact.unique_contact_id || '-'}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        {editing ? (
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={editForm.first_name || ''}
                              onChange={(e) => updateEditForm('first_name', e.target.value)}
                              className="w-24 px-2 py-1 border border-gray-300 rounded text-sm"
                              placeholder="First"
                            />
                            <input
                              type="text"
                              value={editForm.last_name || ''}
                              onChange={(e) => updateEditForm('last_name', e.target.value)}
                              className="w-24 px-2 py-1 border border-gray-300 rounded text-sm"
                              placeholder="Last"
                            />
                          </div>
                        ) : (
                          `${contact.first_name || ''} ${contact.last_name || ''}`
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        {editing ? (
                          <input
                            type="text"
                            value={editForm.company_name || ''}
                            onChange={(e) => updateEditForm('company_name', e.target.value)}
                            className="w-32 px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                        ) : (
                          contact.company_name || '-'
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        {editing ? (
                          <input
                            type="text"
                            value={editForm.job_title || ''}
                            onChange={(e) => updateEditForm('job_title', e.target.value)}
                            className="w-32 px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                        ) : (
                          contact.job_title || '-'
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        {editing ? (
                          <input
                            type="email"
                            value={editForm.email || ''}
                            onChange={(e) => updateEditForm('email', e.target.value)}
                            className="w-40 px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                        ) : (
                          contact.email || '-'
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        {editing ? (
                          <input
                            type="tel"
                            value={editForm.phone || ''}
                            onChange={(e) => updateEditForm('phone', e.target.value)}
                            className="w-32 px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                        ) : (
                          contact.phone || '-'
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm">
                        {editing ? (
                          <input
                            type="url"
                            value={editForm.profile_link || ''}
                            onChange={(e) => updateEditForm('profile_link', e.target.value)}
                            className="w-48 px-2 py-1 border border-gray-300 rounded text-sm"
                            placeholder="https://..."
                          />
                        ) : contact.profile_link ? (
                          <a href={contact.profile_link} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                            View Profile
                          </a>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        {editing ? (
                          <input
                            type="text"
                            value={editForm.campaign_name || ''}
                            onChange={(e) => updateEditForm('campaign_name', e.target.value)}
                            className="w-32 px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                        ) : (
                          contact.campaign_name || '-'
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        {editing ? (
                          <input
                            type="text"
                            value={editForm.profile_name || ''}
                            onChange={(e) => updateEditForm('profile_name', e.target.value)}
                            className="w-32 px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                        ) : (
                          contact.profile_name || '-'
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        {editing ? (
                          <input
                            type="datetime-local"
                            value={editForm.invited_at ? new Date(editForm.invited_at).toISOString().slice(0, 16) : ''}
                            onChange={(e) => updateEditForm('invited_at', e.target.value ? new Date(e.target.value).toISOString() : null)}
                            className="w-40 px-2 py-1 border border-gray-300 rounded text-xs"
                          />
                        ) : (
                          <div className="flex flex-col items-center">
                            {contact.invited_at ? (
                              <>
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 mb-1">
                                  ✓
                                </span>
                                <div className="text-xs text-gray-500">
                                  {formatDateTime(contact.invited_at)}
                                </div>
                              </>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                ✗
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        {editing ? (
                          <input
                            type="datetime-local"
                            value={editForm.connected_at ? new Date(editForm.connected_at).toISOString().slice(0, 16) : ''}
                            onChange={(e) => updateEditForm('connected_at', e.target.value ? new Date(e.target.value).toISOString() : null)}
                            className="w-40 px-2 py-1 border border-gray-300 rounded text-xs"
                          />
                        ) : (
                          <div className="flex flex-col items-center">
                            {contact.connected_at ? (
                              <>
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 mb-1">
                                  ✓
                                </span>
                                <div className="text-xs text-gray-500">
                                  {formatDateTime(contact.connected_at)}
                                </div>
                              </>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                ✗
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        {editing ? (
                          <input
                            type="datetime-local"
                            value={editForm.replied_at ? new Date(editForm.replied_at).toISOString().slice(0, 16) : ''}
                            onChange={(e) => updateEditForm('replied_at', e.target.value ? new Date(e.target.value).toISOString() : null)}
                            className="w-40 px-2 py-1 border border-gray-300 rounded text-xs"
                          />
                        ) : (
                          <div className="flex flex-col items-center">
                            {contact.replied_at ? (
                              <>
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 mb-1">
                                  ✓
                                </span>
                                <div className="text-xs text-gray-500">
                                  {formatDateTime(contact.replied_at)}
                                </div>
                              </>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                ✗
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        {contact.created_at ? formatDateTime(contact.created_at) : '-'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        {editing ? (
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleSave(contact)}
                              disabled={saving}
                              className="p-1 text-green-600 hover:bg-green-100 rounded transition-colors disabled:opacity-50"
                              title="Save"
                            >
                              {saving ? (
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"></div>
                              ) : (
                                <Save className="w-4 h-4" />
                              )}
                            </button>
                            <button
                              onClick={cancelEditing}
                              disabled={saving}
                              className="p-1 text-red-600 hover:bg-red-100 rounded transition-colors disabled:opacity-50"
                              title="Cancel"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => startEditing(contact)}
                            className="p-1 text-blue-600 hover:bg-blue-100 rounded transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  )})}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

