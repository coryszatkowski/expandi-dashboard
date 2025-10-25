/**
 * Authentication Routes
 * 
 * Handles admin login/logout functionality.
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { getDatabase } = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const router = express.Router();

// ============================================================================
// AUTHENTICATION ROUTES
// ============================================================================

/**
 * POST /api/auth/login
 * 
 * Admin login endpoint
 * Body: { "username": "email", "password": "password" }
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username and password are required'
      });
    }

    const db = getDatabase();
    
    // Find admin user
    let user;
    if (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('postgres')) {
      // PostgreSQL
      const result = await db.query(`
        SELECT id, username, password_hash 
        FROM admin_users 
        WHERE username = $1
      `, [username]);
      user = result.rows[0];
    } else {
      // SQLite
      const stmt = db.prepare(`
        SELECT id, username, password_hash 
        FROM admin_users 
        WHERE username = ?
      `);
      user = stmt.get(username);
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Create JWT token
    const token = jwt.sign(
      { 
        id: user.id, 
        username: user.username,
        iat: Math.floor(Date.now() / 1000) // issued at
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: 'Login successful',
      token: token,
      user: {
        id: user.id,
        username: user.username
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Login failed',
      message: error.message
    });
  }
});

/**
 * POST /api/auth/logout
 * 
 * Admin logout endpoint
 */
router.post('/logout', (req, res) => {
  res.json({
    success: true,
    message: 'Logout successful'
  });
});

/**
 * GET /api/auth/verify
 * 
 * Verify if user is authenticated
 */
router.get('/verify', (req, res) => {
  // In a real app, you'd verify JWT token or session
  // For now, we'll let the frontend handle this
  res.json({
    success: true,
    authenticated: true
  });
});

/**
 * POST /api/auth/change-password
 * 
 * Change password for current admin
 * Body: { "currentPassword": "old", "newPassword": "new" }
 */
router.post('/change-password', verifyToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Current password and new password are required'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'New password must be at least 6 characters long'
      });
    }

    const db = getDatabase();
    
    // For this MVP, we'll assume the first admin is the one changing password
    // In a real app, you'd get the current user from the session/token
    const stmt = db.prepare(`
      SELECT id, password_hash 
      FROM admin_users 
      ORDER BY created_at ASC 
      LIMIT 1
    `);
    const user = stmt.get();

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Admin user not found'
      });
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);
    
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: 'Current password is incorrect'
      });
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    const updateStmt = db.prepare(`
      UPDATE admin_users 
      SET password_hash = ? 
      WHERE id = ?
    `);
    updateStmt.run(hashedNewPassword, user.id);

    res.json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to change password',
      message: error.message
    });
  }
});

/**
 * POST /api/auth/add-admin
 * 
 * Add a new admin user
 * Body: { "username": "email", "password": "password" }
 */
router.post('/add-admin', verifyToken, async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username and password are required'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters long'
      });
    }

    const db = getDatabase();
    
    // Check if admin already exists
    let existingAdmin;
    if (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('postgres')) {
      // PostgreSQL
      const result = await db.query(`
        SELECT id FROM admin_users WHERE username = $1
      `, [username]);
      existingAdmin = result.rows[0];
    } else {
      // SQLite
      const checkStmt = db.prepare(`
        SELECT id FROM admin_users WHERE username = ?
      `);
      existingAdmin = checkStmt.get(username);
    }

    if (existingAdmin) {
      return res.status(400).json({
        success: false,
        error: 'Admin with this username already exists'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    const adminId = uuidv4();

    // Insert new admin
    if (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('postgres')) {
      // PostgreSQL
      await db.query(`
        INSERT INTO admin_users (id, username, password_hash, created_at) 
        VALUES ($1, $2, $3, NOW())
      `, [adminId, username, hashedPassword]);
    } else {
      // SQLite
      const insertStmt = db.prepare(`
        INSERT INTO admin_users (id, username, password_hash, created_at) 
        VALUES (?, ?, ?, datetime('now'))
      `);
      insertStmt.run(adminId, username, hashedPassword);
    }

    res.json({
      success: true,
      message: 'Admin added successfully',
      admin: {
        id: adminId,
        username: username
      }
    });

  } catch (error) {
    console.error('Add admin error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add admin',
      message: error.message
    });
  }
});

/**
 * GET /api/auth/admins
 * 
 * Get list of all admin users
 */
router.get('/admins', verifyToken, async (req, res) => {
  try {
    const db = getDatabase();
    
    let admins;
    if (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('postgres')) {
      // PostgreSQL
      const result = await db.query(`
        SELECT id, username, created_at 
        FROM admin_users 
        ORDER BY created_at ASC
      `);
      admins = result.rows;
    } else {
      // SQLite
      const stmt = db.prepare(`
        SELECT id, username, created_at 
        FROM admin_users 
        ORDER BY created_at ASC
      `);
      admins = stmt.all();
    }

    res.json({
      success: true,
      admins: admins
    });

  } catch (error) {
    console.error('Get admins error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch admins',
      message: error.message
    });
  }
});

module.exports = router;
