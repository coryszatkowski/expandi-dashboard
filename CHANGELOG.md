# Changelog

All notable changes to the Expandi Dashboard project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- CHANGELOG.md for tracking all changes
- Comprehensive documentation updates reflecting current state
- Deployment status tracking
- Development clarification for AI agents
- **AI Agent Guidelines** to prevent incorrect assumptions about production systems
- **Troubleshooting protocol** for AI agents
- **Clear rules** about when to investigate vs. when to ask for clarification
- **Comprehensive Security Hardening Implementation** (January 26, 2025)
  - JWT authentication with 7-day token expiry
  - Admin route protection with JWT validation
  - CORS security with domain whitelist
  - Rate limiting on authentication endpoints (5 attempts per 15 min)
  - Security headers using Helmet.js (HSTS, CSP, X-Frame-Options)
  - Input sanitization for XSS protection using xss package
  - Content-based CSV file validation
  - Clean logging without sensitive data exposure
  - Updated frontend dependencies (Vite 7.1.12, esbuild latest)
- **Webhook Processing Fixes** (January 26, 2025)
  - Fixed critical async/await bug in webhook processing
  - Fixed PostgreSQL schema initialization error
  - Fixed duplicate webhook processing issue
  - Added comprehensive debugging logs for webhook troubleshooting
  - Fixed missing campaign_id in contact processing

### Changed
- Updated README.md with current deployment status
- Updated API endpoints documentation
- Updated database status (SQLite → PostgreSQL migration completed)
- **CORRECTED PRODUCTION URLs:**
  - Backend: `https://api.dashboard.theorionstrategy.com`
  - Frontend: `https://dashboard.theorionstrategy.com`
- **CLARIFIED DEPLOYMENT:** All services hosted on Railway (not Vercel)
- **UPDATED DEVELOPMENT WORKFLOW:** Local development is fine, distinguish between local and production issues
- **Security Hardening:** All 10 critical security vulnerabilities addressed
- **Webhook Processing:** Now properly handles async database operations

### Fixed
- Documentation now reflects actual implemented features vs planned features
- Removed incorrect "DO NOT work locally" restrictions
- Clarified that "server issues" refers to production, not localhost
- **PostgreSQL Schema Error:** Server no longer crashes on startup
- **JWT Authentication:** Login now returns tokens, admin routes are protected
- **CORS Security:** Only authorized domains can make API requests
- **Rate Limiting:** Auth endpoints protected from brute force attacks
- **Webhook Processing:** Fixed async/await bugs causing undefined values
- **File Validation:** CSV uploads now validate content, not just extension
- **Dependency Vulnerabilities:** Updated Vite and esbuild to latest versions

## [1.0.0] - 2025-01-XX

### Added
- **Authentication System**
  - Admin login/logout functionality
  - Password management
  - Multiple admin user support
  - Settings modal for admin management

- **CSV Backfill System**
  - Historical data import via CSV upload
  - Duplicate handling (skip/update options)
  - Drag & drop interface
  - Bulk data processing

- **Enhanced Admin Dashboard**
  - Company management (CRUD operations)
  - Profile management (LinkedIn accounts)
  - Real-time webhook monitoring
  - System statistics
  - Edit modes for companies and accounts

- **Production Deployment**
  - Railway backend deployment
  - Vercel frontend deployment
  - PostgreSQL database migration
  - Production environment configuration

### Changed
- **Database Migration**
  - Migrated from SQLite to PostgreSQL
  - Updated all database connections
  - Schema compatibility maintained

- **API Enhancements**
  - Added authentication endpoints
  - Added backfill endpoints
  - Added admin statistics endpoints
  - Added webhook monitoring endpoints

### Technical Details
- **Backend:** Node.js + Express + PostgreSQL
- **Frontend:** React + Vite + Tailwind CSS
- **Deployment:** Railway (backend) + Vercel (frontend)
- **Database:** PostgreSQL (Railway)

## [0.9.0] - 2025-01-XX (Initial MVP)

### Added
- Webhook receiver for Expandi.io
- SQLite database schema
- Admin dashboard (basic)
- Client dashboard (public)
- KPI calculations
- Activity charts
- Shareable links
- CSV export

### Technical Details
- **Backend:** Node.js + Express + SQLite
- **Frontend:** React + Vite + Tailwind CSS
- **Database:** SQLite (local development)

---

## Development Notes

### For New Developers
- **Current Status:** Post-deployment troubleshooting on Railway
- **Active Issues:** PostgreSQL connection stability
- **Do Not:** Work on local development while production issues are being resolved
- **Focus:** Production environment fixes and webhook testing

### Changelog Maintenance
- **IMPORTANT:** Update this changelog for every change made to the project
- **Format:** Use the established format with [Added], [Changed], [Fixed] sections
- **Version:** Update version numbers as appropriate
- **Date:** Use YYYY-MM-DD format for dates

### Legacy Information
- **SQLite:** No longer used, replaced by PostgreSQL
- **Local Development:** Now connects to Railway PostgreSQL
- **Old Documentation:** Some documentation may reference outdated SQLite setup
