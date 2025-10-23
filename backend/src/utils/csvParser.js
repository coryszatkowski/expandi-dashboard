/**
 * CSV Parser Utility
 * 
 * Handles parsing of ORION Lead Sheet CSV files for historical data backfill.
 */

const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');

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
            first_name: data.first_name?.trim(),
            last_name: data.last_name?.trim(),
            profile_link: data.profile_link?.trim(),
            job_title: data.job_title?.trim(),
            company_name: data.company_name?.trim(),
            email: data.email?.trim(),
            work_email: data.work_email?.trim(),
            phone: data.phone?.trim(),
            contact_status: data.contact_status?.trim(),
            conversation_status: data.conversation_status?.trim(),
            invited_at: data.invited_at?.trim(),
            connected_at: data.connected_at?.trim(),
            external_id: data.external_id?.trim(),
            campaign: data.campaign?.trim()
          };
          
          // Only add if we have a valid ID
          if (contactData.id && !isNaN(contactData.id)) {
            results.push(contactData);
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
}

module.exports = CSVParser;
