import React, { useEffect, useState } from 'react';
import { X, Edit3 } from 'lucide-react';

export default function EventEditModal({
  isOpen,
  onClose,
  onSave,
  contactName = '',
  initialInvitedAt = null,
  initialConnectedAt = null,
  initialRepliedAt = null,
}) {
  const [invitedChecked, setInvitedChecked] = useState(!!initialInvitedAt);
  const [connectedChecked, setConnectedChecked] = useState(!!initialConnectedAt);
  const [repliedChecked, setRepliedChecked] = useState(!!initialRepliedAt);

  const [invitedDate, setInvitedDate] = useState('');
  const [invitedTime, setInvitedTime] = useState('');
  const [connectedDate, setConnectedDate] = useState('');
  const [connectedTime, setConnectedTime] = useState('');
  const [repliedDate, setRepliedDate] = useState('');
  const [repliedTime, setRepliedTime] = useState('');

  useEffect(() => {
    const setDT = (iso, setD, setT) => {
      if (!iso) { setD(''); setT(''); return; }
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) { setD(''); setT(''); return; }
      const yyyy = d.getFullYear();
      const mm = `${d.getMonth() + 1}`.padStart(2, '0');
      const dd = `${d.getDate()}`.padStart(2, '0');
      const hh = `${d.getHours()}`.padStart(2, '0');
      const mi = `${d.getMinutes()}`.padStart(2, '0');
      setD(`${yyyy}-${mm}-${dd}`);
      setT(`${hh}:${mi}`);
    };

    setInvitedChecked(!!initialInvitedAt);
    setConnectedChecked(!!initialConnectedAt);
    setRepliedChecked(!!initialRepliedAt);
    setDT(initialInvitedAt, setInvitedDate, setInvitedTime);
    setDT(initialConnectedAt, setConnectedDate, setConnectedTime);
    setDT(initialRepliedAt, setRepliedDate, setRepliedTime);
  }, [initialInvitedAt, initialConnectedAt, initialRepliedAt]);

  if (!isOpen) return null;

  const combine = (date, time) => {
    if (!date || !time) return null;
    try {
      const iso = new Date(`${date}T${time}:00Z`).toISOString();
      return iso;
    } catch {
      return null;
    }
  };

  const handleSave = () => {
    const payload = {
      invited: { checked: invitedChecked },
      connected: { checked: connectedChecked },
      replied: { checked: repliedChecked },
    };
    if (invitedChecked) payload.invited.at = combine(invitedDate, invitedTime);
    if (connectedChecked) payload.connected.at = combine(connectedDate, connectedTime);
    if (repliedChecked) payload.replied.at = combine(repliedDate, repliedTime);

    onSave(payload);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <div className="bg-blue-100 p-2 rounded-lg">
              <Edit3 className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Edit Contact Events</h2>
              {contactName && (
                <p className="text-sm text-gray-500">{contactName}</p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Invited */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                checked={invitedChecked}
                onChange={(e) => setInvitedChecked(e.target.checked)}
              />
              Invited
            </label>
            {invitedChecked && (
              <div className="mt-2 grid grid-cols-2 gap-3">
                <input
                  type="date"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                  value={invitedDate}
                  onChange={(e) => setInvitedDate(e.target.value)}
                />
                <input
                  type="time"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                  value={invitedTime}
                  onChange={(e) => setInvitedTime(e.target.value)}
                />
              </div>
            )}
          </div>

          {/* Connected */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                checked={connectedChecked}
                onChange={(e) => setConnectedChecked(e.target.checked)}
              />
              Connected
            </label>
            {connectedChecked && (
              <div className="mt-2 grid grid-cols-2 gap-3">
                <input
                  type="date"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                  value={connectedDate}
                  onChange={(e) => setConnectedDate(e.target.value)}
                />
                <input
                  type="time"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                  value={connectedTime}
                  onChange={(e) => setConnectedTime(e.target.value)}
                />
              </div>
            )}
          </div>

          {/* Replied */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                checked={repliedChecked}
                onChange={(e) => setRepliedChecked(e.target.checked)}
              />
              Replied
            </label>
            {repliedChecked && (
              <div className="mt-2 grid grid-cols-2 gap-3">
                <input
                  type="date"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                  value={repliedDate}
                  onChange={(e) => setRepliedDate(e.target.value)}
                />
                <input
                  type="time"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                  value={repliedTime}
                  onChange={(e) => setRepliedTime(e.target.value)}
                />
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3 p-5 border-t border-gray-200">
          <button onClick={onClose} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200">Cancel</button>
          <button onClick={handleSave} className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-700">Save</button>
        </div>
      </div>
    </div>
  );
}



