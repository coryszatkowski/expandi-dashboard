/**
 * Input Sanitization Utility
 * 
 * Provides basic sanitization for user input to prevent XSS attacks
 */

const xss = require('xss');

/**
 * Sanitize text input for safe display
 * @param {string} input - Text to sanitize
 * @returns {string} Sanitized text
 */
function sanitizeText(input) {
  if (!input || typeof input !== 'string') {
    return '';
  }
  
  // Remove HTML tags and encode special characters
  return xss(input, {
    whiteList: {}, // Remove all HTML tags
    stripIgnoreTag: true, // Remove all tags
    stripIgnoreTagBody: ['script', 'style'] // Remove script and style content
  });
}

/**
 * Sanitize company name
 * @param {string} name - Company name
 * @returns {string} Sanitized company name
 */
function sanitizeCompanyName(name) {
  if (!name) return '';
  
  // Basic sanitization - remove HTML tags and limit length
  const sanitized = sanitizeText(name);
  return sanitized.substring(0, 100); // Limit to 100 characters
}

/**
 * Sanitize profile name
 * @param {string} name - Profile name
 * @returns {string} Sanitized profile name
 */
function sanitizeProfileName(name) {
  if (!name) return '';
  
  const sanitized = sanitizeText(name);
  return sanitized.substring(0, 50); // Limit to 50 characters
}

/**
 * Sanitize campaign name
 * @param {string} name - Campaign name
 * @returns {string} Sanitized campaign name
 */
function sanitizeCampaignName(name) {
  if (!name) return '';
  
  const sanitized = sanitizeText(name);
  return sanitized.substring(0, 100); // Limit to 100 characters
}

/**
 * Sanitize CSV data
 * @param {Object} contactData - Contact data from CSV
 * @returns {Object} Sanitized contact data
 */
function sanitizeContactData(contactData) {
  return {
    first_name: sanitizeText(contactData.first_name || ''),
    last_name: sanitizeText(contactData.last_name || ''),
    company_name: sanitizeText(contactData.company_name || ''),
    job_title: sanitizeText(contactData.job_title || ''),
    email: sanitizeText(contactData.email || ''),
    phone: sanitizeText(contactData.phone || ''),
    profile_link: sanitizeText(contactData.profile_link || '')
  };
}

module.exports = {
  sanitizeText,
  sanitizeCompanyName,
  sanitizeProfileName,
  sanitizeCampaignName,
  sanitizeContactData
};
