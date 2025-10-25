/**
 * File Content Validator
 * 
 * Validates uploaded files for content safety and format compliance
 */

const fs = require('fs');
const csv = require('csv-parser');

/**
 * Validate CSV file content
 * @param {string} filePath - Path to uploaded file
 * @returns {Promise<{valid: boolean, errors: string[]}>}
 */
async function validateCSVContent(filePath) {
  const errors = [];
  
  try {
    // Check file size (already limited by multer, but double-check)
    const stats = fs.statSync(filePath);
    if (stats.size > 10 * 1024 * 1024) { // 10MB limit
      errors.push('File too large (max 10MB)');
      return { valid: false, errors };
    }

    // Check if file is actually readable as text
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Basic CSV structure validation
    const lines = content.split('\n');
    if (lines.length < 2) {
      errors.push('CSV must have at least a header row and one data row');
      return { valid: false, errors };
    }

    // Check for dangerous patterns (scripts, executables)
    const dangerousPatterns = [
      /<script/i,           // Script tags
      /javascript:/i,       // JavaScript URLs
      /vbscript:/i,         // VBScript URLs
      /\.exe/i,             // Executable files
      /\.bat/i,             // Batch files
      /\.sh/i,              // Shell scripts
      /cmd\.exe/i,          // Command execution
      /powershell/i,        // PowerShell
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(content)) {
        errors.push(`File contains potentially dangerous content: ${pattern.source}`);
      }
    }

    // Validate CSV structure with csv-parser
    const rows = [];
    const validationErrors = [];
    
    return new Promise((resolve) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => {
          rows.push(row);
          
          // Reasonable row limit (not too restrictive)
          if (rows.length > 50000) { // 50k rows max
            validationErrors.push('Too many rows (max 50,000)');
            resolve({ valid: false, errors: validationErrors });
            return;
          }
        })
        .on('end', () => {
          if (rows.length === 0) {
            validationErrors.push('No valid CSV data found');
          }
          
          resolve({ 
            valid: validationErrors.length === 0 && errors.length === 0, 
            errors: [...errors, ...validationErrors] 
          });
        })
        .on('error', (err) => {
          validationErrors.push(`CSV parsing error: ${err.message}`);
          resolve({ 
            valid: false, 
            errors: [...errors, ...validationErrors] 
          });
        });
    });

  } catch (error) {
    errors.push(`File validation error: ${error.message}`);
    return { valid: false, errors };
  }
}

/**
 * Check if file is actually a CSV by content
 * @param {string} filePath - Path to uploaded file
 * @returns {Promise<boolean>}
 */
async function isActualCSV(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Basic CSV indicators (not too strict)
    const hasCommas = content.includes(',');
    const hasNewlines = content.includes('\n');
    
    // Must have at least commas and newlines to be CSV
    if (!hasCommas || !hasNewlines) {
      return false;
    }
    
    // Check for reasonable CSV structure
    const lines = content.split('\n');
    const firstLine = lines[0];
    
    // First line should have reasonable number of columns (not too many)
    const columnCount = (firstLine.match(/,/g) || []).length + 1;
    if (columnCount > 50) {
      return false; // Too many columns, probably not a real CSV
    }
    
    return true;
  } catch (error) {
    return false;
  }
}

module.exports = {
  validateCSVContent,
  isActualCSV
};
