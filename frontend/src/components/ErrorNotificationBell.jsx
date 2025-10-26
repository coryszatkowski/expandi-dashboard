/**
 * ErrorNotificationBell Component
 * 
 * Displays error notifications with a bell icon and dropdown.
 * Shows unresolved error count and allows resolving notifications.
 */

import React, { useState, useEffect } from 'react';
import { Bell, AlertTriangle, X, CheckCircle } from 'lucide-react';

const ErrorNotificationBell = () => {
  const [notifications, setNotifications] = useState([]);
  const [unresolvedCount, setUnresolvedCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Fetch notifications
  const fetchNotifications = async () => {
    try {
      const response = await fetch('/api/admin/notifications');
      const data = await response.json();
      
      if (data.success) {
        setNotifications(data.notifications);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  // Fetch unresolved count
  const fetchUnresolvedCount = async () => {
    try {
      const response = await fetch('/api/admin/notifications/count');
      const data = await response.json();
      
      if (data.success) {
        setUnresolvedCount(data.count);
      }
    } catch (error) {
      console.error('Error fetching notification count:', error);
    }
  };

  // Resolve notification
  const resolveNotification = async (id) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/notifications/${id}/resolve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Remove resolved notification from state
        setNotifications(prev => prev.filter(n => n.id !== id));
        setUnresolvedCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error resolving notification:', error);
    } finally {
      setLoading(false);
    }
  };

  // Resolve all notifications
  const resolveAllNotifications = async () => {
    if (notifications.length === 0) return;
    
    setLoading(true);
    try {
      const ids = notifications.map(n => n.id);
      const response = await fetch('/api/admin/notifications/resolve-multiple', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ids }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setNotifications([]);
        setUnresolvedCount(0);
      }
    } catch (error) {
      console.error('Error resolving all notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  // Get severity icon and color
  const getSeverityInfo = (severity) => {
    switch (severity) {
      case 'critical':
        return { icon: '🔴', color: 'text-red-600', bgColor: 'bg-red-50' };
      case 'error':
        return { icon: '🟠', color: 'text-orange-600', bgColor: 'bg-orange-50' };
      case 'warning':
        return { icon: '🟡', color: 'text-yellow-600', bgColor: 'bg-yellow-50' };
      default:
        return { icon: '⚪', color: 'text-gray-600', bgColor: 'bg-gray-50' };
    }
  };

  // Format timestamp
  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
  };

  // Auto-refresh every 60 seconds
  useEffect(() => {
    fetchNotifications();
    fetchUnresolvedCount();

    const interval = setInterval(() => {
      fetchNotifications();
      fetchUnresolvedCount();
    }, 60000); // 60 seconds

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative">
      {/* Bell Icon */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
        title="Error Notifications"
      >
        <Bell className="w-5 h-5" />
        {unresolvedCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-medium">
            {unresolvedCount > 99 ? '99+' : unresolvedCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-96 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                Error Notifications
              </h3>
              {notifications.length > 0 && (
                <button
                  onClick={resolveAllNotifications}
                  disabled={loading}
                  className="text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50"
                >
                  Resolve All
                </button>
              )}
            </div>
            {unresolvedCount > 0 && (
              <p className="text-sm text-gray-600 mt-1">
                {unresolvedCount} unresolved notification{unresolvedCount !== 1 ? 's' : ''}
              </p>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500" />
                <p>No unresolved notifications</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {notifications.map((notification) => {
                  const severityInfo = getSeverityInfo(notification.severity);
                  
                  return (
                    <div
                      key={notification.id}
                      className={`p-4 ${severityInfo.bgColor} hover:bg-opacity-75 transition-colors`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-lg">{severityInfo.icon}</span>
                            <span className={`text-sm font-medium ${severityInfo.color}`}>
                              {notification.severity.toUpperCase()}
                            </span>
                            <span className="text-xs text-gray-500">
                              {formatTimestamp(notification.created_at)}
                            </span>
                          </div>
                          
                          <p className="text-sm text-gray-900 mb-2">
                            {notification.message}
                          </p>
                          
                          {notification.webhook_id && (
                            <p className="text-xs text-gray-600">
                              Webhook ID: {notification.webhook_id}
                            </p>
                          )}
                          
                          {notification.correlation_id && (
                            <p className="text-xs text-gray-500">
                              Correlation ID: {notification.correlation_id}
                            </p>
                          )}
                        </div>
                        
                        <button
                          onClick={() => resolveNotification(notification.id)}
                          disabled={loading}
                          className="ml-2 p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                          title="Resolve notification"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {notifications.length > 0 && (
            <div className="p-4 border-t border-gray-200 bg-gray-50">
              <p className="text-xs text-gray-600 text-center">
                Notifications auto-refresh every 60 seconds
              </p>
            </div>
          )}
        </div>
      )}

      {/* Click outside to close */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
};

export default ErrorNotificationBell;
