/**
 * CSV Parser Utility
 * 
 * Handles parsing of ORION Lead Sheet CSV files for historical data backfill.
 */

const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const { sanitizeContactData } = require('./sanitizer');

class CSVParser {
  /**
   * Parse ORION Lead Sheet CSV format
   * @param {string} filePath - Path to CSV file
   * @returns {Promise<Array>} Array of parsed contact data
   */
  static parseORIONLeadSheet(filePath) {
    return new Promise((resolve, reject) => {
      const results = [];
      
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => {
          // Map ORION CSV columns to our expected format
          const contactData = {
            id: parseInt(data.id),
            first_name: this.findFirstNonEmpty(data, ['first_name', 'First Name', 'FIRST_NAME']),
            last_name: this.findFirstNonEmpty(data, ['last_name', 'Last Name', 'LAST_NAME']),
            profile_link: this.findFirstNonEmpty(data, ['profile_link', 'Profile Link', 'PROFILE_LINK']),
            job_title: this.findFirstNonEmpty(data, ['job_title', 'Job Title', 'JOB_TITLE']),
            company_name: this.findFirstNonEmpty(data, ['company_name', 'Company Name', 'COMPANY_NAME']),
            email: this.findFirstNonEmpty(data, ['email', 'Email', 'EMAIL']),
            work_email: this.findFirstNonEmpty(data, ['work_email', 'Work Email', 'WORK_EMAIL']),
            phone: this.findFirstNonEmpty(data, ['phone', 'Phone', 'PHONE']),
            contact_status: this.findFirstNonEmpty(data, ['contact_status', 'Contact Status', 'CONTACT_STATUS']),
            conversation_status: this.findFirstNonEmpty(data, ['conversation_status', 'Conversation Status', 'CONVERSATION_STATUS']),
            invited_at: this.findFirstNonEmpty(data, ['invited_at', 'Invited At', 'INVITED_AT']),
            connected_at: this.findFirstNonEmpty(data, ['connected_at', 'Connected At', 'CONNECTED_AT']),
            external_id: this.findFirstNonEmpty(data, ['external_id', 'External ID', 'EXTERNAL_ID']),
            campaign: this.findFirstNonEmpty(data, ['campaign', 'Campaign', 'CAMPAIGN'])
          };
          
          // Only add if we have a valid ID
          if (contactData.id && !isNaN(contactData.id)) {
            // Sanitize contact data before adding
            const sanitizedData = sanitizeContactData(contactData);
            results.push({ ...contactData, ...sanitizedData });
          }
        })
        .on('end', () => {
          console.log(`Parsed ${results.length} contacts from CSV`);
          resolve(results);
        })
        .on('error', (error) => {
          console.error('CSV parsing error:', error);
          reject(error);
        });
    });
  }

  /**
   * Validate CSV structure
   * @param {string} filePath - Path to CSV file
   * @returns {Promise<Object>} Validation result
   */
  static async validateCSVStructure(filePath) {
    return new Promise((resolve, reject) => {
      const requiredColumns = [
        'id', 'first_name', 'last_name', 'profile_link', 'job_title', 
        'company_name', 'email', 'work_email', 'phone', 'contact_status', 
        'conversation_status', 'invited_at', 'connected_at', 'external_id', 'campaign'
      ];
      
      let headerRow = null;
      let isValid = true;
      let missingColumns = [];
      
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => {
          if (!headerRow) {
            headerRow = Object.keys(data);
            missingColumns = requiredColumns.filter(col => !headerRow.includes(col));
            isValid = missingColumns.length === 0;
          }
        })
        .on('end', () => {
          resolve({
            isValid,
            headerRow,
            missingColumns,
            requiredColumns
          });
        })
        .on('error', (error) => {
          reject(error);
        });
    });
  }

  /**
   * Get CSV file info
   * @param {string} filePath - Path to CSV file
   * @returns {Promise<Object>} File information
   */
  static async getFileInfo(filePath) {
    try {
      const stats = fs.statSync(filePath);
      const validation = await this.validateCSVStructure(filePath);
      
      return {
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        isValid: validation.isValid,
        missingColumns: validation.missingColumns
      };
    } catch (error) {
      throw new Error(`Failed to get file info: ${error.message}`);
    }
  }

  /**
   * Find the first non-empty value from multiple possible column names
   * @param {Object} data - CSV row data
   * @param {Array} possibleColumns - Array of possible column names to check
   * @returns {string|null} First non-empty value or null
   */
  static findFirstNonEmpty(data, possibleColumns) {
    for (const column of possibleColumns) {
      const value = data[column]?.trim();
      if (value && value !== '') {
        return value;
      }
    }
    return null; // Return null instead of empty string
  }
}

module.exports = CSVParser;
