/**
 * Timezone Utility Functions
 * 
 * Provides timezone-aware date formatting for the frontend.
 * All functions automatically detect and use the user's local timezone.
 */

/**
 * Format a date string to display date and time in user's local timezone
 * @param {string} dateString - ISO 8601 date string from backend
 * @param {Object} options - Intl.DateTimeFormat options
 * @returns {string|null} Formatted date string or null if invalid
 */
export const formatDateTime = (dateString, options = {}) => {
  if (!dateString) return null;
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return null;
    
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    
    return new Intl.DateTimeFormat('en-US', {
      timeZone: userTimezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      ...options
    }).format(date);
  } catch (error) {
    console.error('Error formatting date:', error);
    return null;
  }
};

/**
 * Format a date string to display date only in user's local timezone
 * @param {string} dateString - ISO 8601 date string from backend
 * @param {Object} options - Intl.DateTimeFormat options
 * @returns {string|null} Formatted date string or null if invalid
 */
export const formatDate = (dateString, options = {}) => {
  if (!dateString) return null;
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return null;
    
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    
    return new Intl.DateTimeFormat('en-US', {
      timeZone: userTimezone,
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      ...options
    }).format(date);
  } catch (error) {
    console.error('Error formatting date:', error);
    return null;
  }
};

/**
 * Format a date string for chart display in user's local timezone
 * @param {string} dateString - ISO 8601 date string from backend
 * @param {Object} options - Intl.DateTimeFormat options
 * @returns {string|null} Formatted date string or null if invalid
 */
export const formatChartDate = (dateString, options = {}) => {
  if (!dateString) return null;
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return null;
    
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    
    return new Intl.DateTimeFormat('en-US', {
      timeZone: userTimezone,
      month: 'short',
      day: 'numeric',
      ...options
    }).format(date);
  } catch (error) {
    console.error('Error formatting chart date:', error);
    return null;
  }
};

/**
 * Format a date string for time display only in user's local timezone
 * @param {string} dateString - ISO 8601 date string from backend
 * @param {Object} options - Intl.DateTimeFormat options
 * @returns {string|null} Formatted time string or null if invalid
 */
export const formatTime = (dateString, options = {}) => {
  if (!dateString) return null;
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return null;
    
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    
    return new Intl.DateTimeFormat('en-US', {
      timeZone: userTimezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      ...options
    }).format(date);
  } catch (error) {
    console.error('Error formatting time:', error);
    return null;
  }
};

/**
 * Get the user's timezone
 * @returns {string} User's timezone (e.g., 'America/New_York')
 */
export const getUserTimezone = () => {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
};

/**
 * Convert a local date to UTC for backend storage
 * @param {Date} localDate - Local date object
 * @returns {string} ISO 8601 UTC string
 */
export const toUTC = (localDate) => {
  return localDate.toISOString();
};

/**
 * Convert a UTC date string to local date
 * @param {string} utcDateString - ISO 8601 UTC string
 * @returns {Date} Local date object
 */
export const fromUTC = (utcDateString) => {
  return new Date(utcDateString);
};

/**
 * Format a local date for backend API calls
 * Ensures date is treated as local midnight, returns yyyy-MM-dd format
 * @param {Date} localDate - Local date object
 * @returns {string} Date string in yyyy-MM-dd format
 */
export const formatDateForBackend = (localDate) => {
  // Ensure date is treated as local midnight, return yyyy-MM-dd
  const year = localDate.getFullYear();
  const month = String(localDate.getMonth() + 1).padStart(2, '0');
  const day = String(localDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
