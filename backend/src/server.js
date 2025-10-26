/**
 * Expandi Dashboard - Backend Server
 * 
 * Main entry point for the Express API server.
 * Handles webhooks, admin operations, and serves dashboard data.
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { initializeDatabase, closeDatabase } = require('./config/database');
const { migrateErrorHandling } = require('./config/migrateErrorHandling');
const errorHandler = require('./middleware/errorHandler');
const { 
  webhookLimiter, 
  adminLimiter, 
  authLimiter, 
  loginLimiter, 
  passwordChangeLimiter 
} = require('./middleware/rateLimiter');

// Import routes
const webhookRoutes = require('./routes/webhooks');
const adminRoutes = require('./routes/admin');
const dashboardRoutes = require('./routes/dashboard');
const authRoutes = require('./routes/auth');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Trust proxy for Railway deployment (fixes rate limiting X-Forwarded-For error)
app.set('trust proxy', 1);

// ============================================================================
// MIDDLEWARE
// ============================================================================

// Parse JSON request bodies
app.use(express.json());

// Security headers
if (process.env.NODE_ENV === 'production') {
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameSrc: ["'none'"],
      },
    },
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    noSniff: true,
    frameguard: { action: 'deny' },
    hidePoweredBy: true,
    xssFilter: true
  }));
} else {
  app.use(helmet({ 
    contentSecurityPolicy: false, 
    hsts: false 
  }));
}

// CORS configuration - allow specific origins only
const getAllowedOrigins = () => {
  const baseOrigins = ['http://localhost:5173']; // Always allow local development
  
  if (process.env.FRONTEND_URL) {
    const frontendUrls = process.env.FRONTEND_URL.split(',').map(url => url.trim());
    return [...baseOrigins, ...frontendUrls];
  }
  
  // Fallback for production
  return [...baseOrigins, 'https://dashboard.theorionstrategy.com'];
};

const allowedOrigins = getAllowedOrigins();

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, or server-to-server)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log(`CORS blocked request from origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting
app.use('/api/webhooks', webhookLimiter);
app.use('/api/admin', adminLimiter);
app.use('/api/auth', authLimiter); // General auth rate limiting
app.use('/api/auth/login', loginLimiter); // Extra protection for login
app.use('/api/auth/change-password', passwordChangeLimiter); // Password change protection

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
async function startServer() {
  try {
    // Initialize database
    console.log('🔧 Initializing database...');
    initializeDatabase();

    // Run error handling migration
    console.log('🔄 Running error handling migration...');
    await migrateErrorHandling();

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
