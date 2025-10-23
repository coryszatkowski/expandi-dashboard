/**
 * Error Handler Middleware
 * 
 * Catches any errors that weren't handled in route handlers
 */

function errorHandler(err, req, res, next) {
  console.error('❌ Unhandled error:', err);

  // Default error response
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error';

  res.status(statusCode).json({
    success: false,
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
}

module.exports = errorHandler;
