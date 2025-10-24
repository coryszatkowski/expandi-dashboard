/**
 * Create Admin User Script
 * 
 * This script creates an admin user for the dashboard.
 * Run this once to set up your first admin account.
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { getDatabase } = require('./src/config/database');

async function createAdmin() {
  try {
    console.log('🔧 Creating admin user...');
    
    const db = getDatabase();
    const username = 'admin';
    const password = 'admin123';
    
    // Check if admin already exists
    let checkQuery;
    if (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('postgres')) {
      // PostgreSQL
      checkQuery = 'SELECT id FROM admin_users WHERE username = $1';
    } else {
      // SQLite
      checkQuery = 'SELECT id FROM admin_users WHERE username = ?';
    }
    
    let existingAdmin;
    if (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('postgres')) {
      const result = await db.query(checkQuery, [username]);
      existingAdmin = result.rows[0];
    } else {
      const stmt = db.prepare(checkQuery);
      existingAdmin = stmt.get(username);
    }
    
    if (existingAdmin) {
      console.log('✅ Admin user already exists');
      return;
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    const adminId = uuidv4();
    
    // Insert admin user
    let insertQuery;
    if (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('postgres')) {
      // PostgreSQL
      insertQuery = `
        INSERT INTO admin_users (id, username, password_hash, created_at) 
        VALUES ($1, $2, $3, NOW())
      `;
      await db.query(insertQuery, [adminId, username, hashedPassword]);
    } else {
      // SQLite
      insertQuery = `
        INSERT INTO admin_users (id, username, password_hash, created_at) 
        VALUES (?, ?, ?, datetime('now'))
      `;
      const stmt = db.prepare(insertQuery);
      stmt.run(adminId, username, hashedPassword);
    }
    
    console.log('✅ Admin user created successfully!');
    console.log(`   Username: ${username}`);
    console.log(`   Password: ${password}`);
    console.log('');
    console.log('⚠️  IMPORTANT: Change the password after first login!');
    
  } catch (error) {
    console.error('❌ Error creating admin user:', error);
    process.exit(1);
  }
}

// Run the script
createAdmin().then(() => {
  console.log('🎉 Admin setup complete!');
  process.exit(0);
}).catch(error => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
