/**
 * Authentication Middleware
 * 
 * Protects admin routes by checking for valid authentication.
 */

const jwt = require('jsonwebtoken');
const { getDatabase } = require('../config/database');

/**
 * Middleware to verify JWT token
 */
function verifyToken(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ 
      success: false,
      error: 'No token provided' 
    });
  }
  
  jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, decoded) => {
    if (err) {
      return res.status(401).json({ 
        success: false,
        error: 'Invalid token' 
      });
    }
    req.user = decoded;
    next();
  });
}

/**
 * Middleware to check if user is authenticated as admin
 */
function requireAuth(req, res, next) {
  return verifyToken(req, res, next);
}

/**
 * Middleware to check if user is admin
 * This would verify the user has admin privileges
 */
function requireAdmin(req, res, next) {
  // For now, all authenticated users are considered admins
  // In the future, you could add role-based access control
  next();
}

module.exports = {
  requireAuth,
  requireAdmin
};
