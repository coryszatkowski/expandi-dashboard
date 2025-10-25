const rateLimit = require('express-rate-limit');

// Webhook rate limiter - 100 requests per minute per IP
const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: {
    success: false,
    error: 'Too many webhook requests, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Admin rate limiter - 50 requests per minute per IP
const adminLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 50,
  message: {
    success: false,
    error: 'Too many admin requests, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Auth rate limiter - 5 attempts per 15 minutes per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per 15 minutes
  message: {
    success: false,
    error: 'Too many login attempts, please try again in 15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip successful requests (don't count successful logins)
  skipSuccessfulRequests: true,
  // Skip failed requests after max attempts (don't keep counting)
  skipFailedRequests: false
});

// Login-specific rate limiter - 3 attempts per minute per IP
const loginLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 3, // 3 attempts per minute
  message: {
    success: false,
    error: 'Too many login attempts, please try again in 1 minute'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Don't skip successful requests (count all attempts)
  skipSuccessfulRequests: false,
  skipFailedRequests: false
});

// Password change rate limiter - 3 attempts per hour per IP
const passwordChangeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 password changes per hour
  message: {
    success: false,
    error: 'Too many password change attempts, please try again in 1 hour'
  },
  standardHeaders: true,
  legacyHeaders: false
});

module.exports = { 
  webhookLimiter, 
  adminLimiter, 
  authLimiter, 
  loginLimiter, 
  passwordChangeLimiter 
};
