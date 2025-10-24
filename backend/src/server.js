/**
 * Expandi Dashboard - Backend Server
 * 
 * Main entry point for the Express API server.
 * Handles webhooks, admin operations, and serves dashboard data.
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initializeDatabase, closeDatabase } = require('./config/database');
const errorHandler = require('./middleware/errorHandler');
const { webhookLimiter, adminLimiter } = require('./middleware/rateLimiter');

// Import routes
const webhookRoutes = require('./routes/webhooks');
const adminRoutes = require('./routes/admin');
const dashboardRoutes = require('./routes/dashboard');
const authRoutes = require('./routes/auth');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// ============================================================================
// MIDDLEWARE
// ============================================================================

// Parse JSON request bodies
app.use(express.json());

// CORS configuration - allow multiple origins
const allowedOrigins = process.env.FRONTEND_URL 
  ? process.env.FRONTEND_URL.split(',')
  : ['http://localhost:5173', 'https://frontend-production-4133.up.railway.app'];

app.use(cors({
  origin: true, // Allow all origins for now
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting
app.use('/api/webhooks', webhookLimiter);
app.use('/api/admin', adminLimiter);

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

// ============================================================================
// ROUTES
// ============================================================================

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Expandi Dashboard API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API routes
app.use('/api/webhooks', webhookRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/auth', authRoutes);

// 404 handler for unknown routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    path: req.path
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// ============================================================================
// SERVER INITIALIZATION
// ============================================================================

/**
 * Initialize database and start server
 */
function startServer() {
  try {
    // Initialize database
    console.log('🔧 Initializing database...');
    initializeDatabase();

    // Start Express server
    app.listen(PORT, '0.0.0.0', () => {
      console.log('');
      console.log('🚀 ====================================');
      console.log('   Expandi Dashboard API Server');
      console.log('   ====================================');
      console.log('');
      console.log(`   ✅ Server running on port: ${PORT}`);
      console.log(`   ✅ Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`   ✅ Frontend URL: ${FRONTEND_URL}`);
      console.log('');
      console.log('   Available endpoints:');
      console.log('   - GET  /health                         Health check');
      console.log('   - POST /api/webhooks/expandi           Receive webhooks');
      console.log('   - GET  /api/admin/companies            List companies');
      console.log('   - GET  /api/admin/linkedin-accounts    List accounts');
      console.log('   - GET  /api/dashboard/:token           Client dashboard');
      console.log('');
      console.log('   📚 Full API docs: See backend/README.md');
      console.log('');
      console.log('   Press Ctrl+C to stop the server');
      console.log('');
      console.log('=====================================');
      console.log('');
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

/**
 * Graceful shutdown handler
 */
function shutdown() {
  console.log('');
  console.log('⏹️  Shutting down server...');
  
  closeDatabase();
  
  console.log('✅ Server shut down successfully');
  process.exit(0);
}

// Handle shutdown signals
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start the server
startServer();

module.exports = app;
