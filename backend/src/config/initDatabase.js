/**
 * Database Initialization Script
 * 
 * Run this script to initialize/reset the database:
 * node src/config/initDatabase.js
 */

require('dotenv').config();
const { initializeDatabase, closeDatabase } = require('./database');

console.log('Initializing database...');

try {
  initializeDatabase();
  console.log('✅ Database initialization complete!');
  closeDatabase();
} catch (error) {
  console.error('❌ Database initialization failed:', error.message);
  process.exit(1);
}
