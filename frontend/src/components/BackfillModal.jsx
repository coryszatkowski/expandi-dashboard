import React, { useState } from 'react';
import { Upload, FileSpreadsheet, AlertCircle, Check, X } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'https://backend-production-b2e1.up.railway.app';

export default function BackfillModal({ isOpen, onClose, profileId, profileName, profiles = [] }) {
  // Handle special case for "all" profiles
  const isAllProfiles = profileId === 'all';
  const [file, setFile] = useState(null);
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [duplicateHandling, setDuplicateHandling] = useState('skip');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');
  const [result, setResult] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile && (selectedFile.type === 'text/csv' || selectedFile.name.endsWith('.csv'))) {
      setFile(selectedFile);
      setMessage('');
    } else {
      setMessage('Please select a CSV file', 'error');
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && (droppedFile.type === 'text/csv' || droppedFile.name.endsWith('.csv'))) {
      setFile(droppedFile);
      setMessage('');
    } else {
      setMessage('Please drop a CSV file', 'error');
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!file) {
      setMessage('Please select a CSV file', 'error');
      return;
    }

    if (isAllProfiles && !selectedProfileId) {
      setMessage('Please select a profile', 'error');
      return;
    }

    setLoading(true);
    setMessage('');
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('profileId', isAllProfiles ? selectedProfileId : profileId);
      formData.append('skipExisting', duplicateHandling === 'skip');
      formData.append('updateExisting', duplicateHandling === 'update');

      const response = await fetch(`${API_URL}/api/admin/backfill`, {
        method: 'POST',
        body: formData
      });

      const data = await response.json();
      
      if (data.success) {
        setResult(data.data);
        setMessage(`Successfully processed ${data.data.summary.totalContacts} contacts!`, 'success');
        
        // Auto-close after 3 seconds
        setTimeout(() => {
          onClose();
          window.location.reload();
        }, 3000);
      } else {
        setMessage(data.error || 'Import failed', 'error');
      }
    } catch (error) {
      setMessage('Network error. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setSelectedProfileId('');
    setDuplicateHandling('skip');
    setMessage('');
    setResult(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 p-2 rounded-lg">
              <FileSpreadsheet className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Backfill Historical Data</h2>
              <p className="text-sm text-gray-500">Import contacts for {profileName}</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Message */}
        {message && (
          <div className={`mx-6 mt-4 p-3 rounded-md flex items-center gap-2 ${
            messageType === 'error' ? 'bg-red-50 text-red-800' : 'bg-green-50 text-green-800'
          }`}>
            {messageType === 'error' ? (
              <AlertCircle className="w-4 h-4" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            {message}
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="mx-6 mt-4 p-4 bg-blue-50 rounded-lg">
            <h3 className="font-medium text-blue-900 mb-2">Import Results</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
              <div>
                <span className="text-blue-700">Total Contacts:</span>
                <span className="ml-2 font-medium">{result.summary.totalContacts}</span>
              </div>
              <div>
                <span className="text-blue-700">Created:</span>
                <span className="ml-2 font-medium text-green-600">{result.contactsCreated}</span>
              </div>
              <div>
                <span className="text-blue-700">Updated:</span>
                <span className="ml-2 font-medium text-yellow-600">{result.contactsUpdated}</span>
              </div>
              <div>
                <span className="text-blue-700">Skipped:</span>
                <span className="ml-2 font-medium text-gray-600">{result.contactsSkipped}</span>
              </div>
            </div>
            
            {result.campaigns && result.campaigns.length > 0 && (
              <div className="mt-3">
                <h4 className="font-medium text-blue-900 mb-2">Campaigns Processed:</h4>
                <div className="space-y-2">
                  {result.campaigns.map((campaign, index) => (
                    <div key={index} className="bg-white p-2 rounded border text-sm">
                      <div className="font-medium">{campaign.campaignName}</div>
                      <div className="text-gray-600">
                        Created: {campaign.contactsCreated} | 
                        Updated: {campaign.contactsUpdated} | 
                        Skipped: {campaign.contactsSkipped}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {result.errors.length > 0 && (
              <div className="mt-3">
                <span className="text-red-700 text-sm">Errors: {result.errors.length}</span>
              </div>
            )}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-6">
            {isAllProfiles && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Profile
                </label>
                <select
                  value={selectedProfileId}
                  onChange={(e) => setSelectedProfileId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                  required
                >
                  <option value="">Choose a profile...</option>
                  {profiles.map(profile => (
                    <option key={profile.id} value={profile.id}>
                      {profile.account_name}
                    </option>
                  ))}
                </select>
                <p className="text-sm text-gray-500 mt-1">
                  Select which profile this historical data belongs to
                </p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Duplicate Contact Handling
              </label>
              <select
                value={duplicateHandling}
                onChange={(e) => setDuplicateHandling(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
              >
                <option value="skip">Skip existing contacts (recommended)</option>
                <option value="update">Update existing contacts with new data</option>
                <option value="create">Create duplicate events for existing contacts</option>
              </select>
              <p className="text-sm text-gray-500 mt-1">
                Choose how to handle contacts that already exist in the system
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                CSV File
              </label>
              <div 
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                  isDragOver 
                    ? 'border-blue-400 bg-blue-100' 
                    : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'
                }`}
                onClick={() => document.getElementById('file-upload').click()}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
              >
                <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="hidden"
                  id="file-upload"
                />
                <p className="text-sm text-gray-500">
                  {file ? file.name : 'Click to upload or drag and drop your CSV file'}
                </p>
                <div className="text-sm text-gray-500 mt-2">
                  <p><strong>Expected columns:</strong></p>
                  <p className="text-xs mt-1">
                    id, first_name, last_name, profile_link, job_title, company_name, email, work_email, phone, contact_status, conversation_status, invited_at, connected_at, external_id, campaign
                  </p>
                </div>
              </div>
            </div>

          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !file || (isAllProfiles && !selectedProfileId)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Importing...' : 'Import Data'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
