const rateLimit = require('express-rate-limit');

// Webhook rate limiter - 100 requests per minute per IP
const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: 'Too many webhook requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

// Admin rate limiter - 50 requests per minute per IP
const adminLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 50,
  message: 'Too many requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { webhookLimiter, adminLimiter };
