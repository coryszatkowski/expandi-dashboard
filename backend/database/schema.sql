-- Expandi Dashboard Database Schema
-- SQLite version (easily portable to PostgreSQL)

-- Admin users table
-- Stores admin login credentials
CREATE TABLE IF NOT EXISTS admin_users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Companies table
-- Stores ORION's clients
CREATE TABLE IF NOT EXISTS companies (
  id TEXT PRIMARY KEY,                    -- UUID
  name TEXT NOT NULL UNIQUE,              -- Company name (e.g., "ORION", "RWX")
  share_token TEXT NOT NULL UNIQUE,       -- UUID for shareable dashboard URLs
  created_at TEXT NOT NULL,               -- ISO 8601 timestamp
  updated_at TEXT NOT NULL                -- ISO 8601 timestamp
);

-- Profiles table  
-- Stores individual profiles running campaigns (internal profiles, not LinkedIn accounts)
CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,                    -- UUID
  company_id TEXT,                        -- Foreign key to companies (NULL if unassigned)
  account_name TEXT NOT NULL,             -- Profile name (e.g., "Tobias Millington")
  account_email TEXT,                     -- Email associated with profile
  li_account_id INTEGER,                  -- Expandi's LinkedIn account ID (for reference only)
  webhook_id TEXT NOT NULL UNIQUE,       -- Unique webhook identifier for URL generation
  status TEXT NOT NULL DEFAULT 'unassigned', -- 'assigned' or 'unassigned'
  created_at TEXT NOT NULL,               -- ISO 8601 timestamp
  updated_at TEXT NOT NULL,               -- ISO 8601 timestamp
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL
);

-- Campaigns table
-- Stores individual campaigns within each profile
CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY,                    -- UUID
  profile_id TEXT NOT NULL,              -- Foreign key to profiles
  campaign_instance TEXT NOT NULL UNIQUE, -- Full string from Expandi webhook
  campaign_name TEXT NOT NULL,            -- Parsed campaign name (codes like "A008+M003")
  started_at TEXT NOT NULL,               -- ISO 8601 timestamp (extracted from campaign_instance)
  created_at TEXT NOT NULL,               -- ISO 8601 timestamp
  updated_at TEXT NOT NULL,               -- ISO 8601 timestamp
  FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
);

-- Events table
-- Stores all webhook events (invites, connections, replies)
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,                    -- UUID
  campaign_id TEXT NOT NULL,              -- Foreign key to campaigns
  contact_id INTEGER NOT NULL,            -- Expandi contact ID
  event_type TEXT NOT NULL,               -- 'invite_sent', 'connection_accepted', 'contact_replied'
  event_data TEXT NOT NULL,               -- Raw JSON webhook payload (for audit trail)
  invited_at TEXT,                        -- ISO 8601 timestamp (NULL until invite sent)
  connected_at TEXT,                      -- ISO 8601 timestamp (NULL until connection accepted)
  replied_at TEXT,                        -- ISO 8601 timestamp (NULL until reply received)
  conversation_status TEXT,               -- Latest status from Expandi
  created_at TEXT NOT NULL,               -- ISO 8601 timestamp
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
);

-- Contacts table
-- Stores contact information (minimal - just for reference)
-- NOTE: Contact details are NOT displayed to end users, only aggregated for KPIs
CREATE TABLE IF NOT EXISTS contacts (
  contact_id INTEGER PRIMARY KEY,         -- Expandi contact ID (no UUID, use their ID)
  first_name TEXT,                        
  last_name TEXT,
  company_name TEXT,                      
  job_title TEXT,
  profile_link TEXT,
  email TEXT,
  phone TEXT,
  created_at TEXT NOT NULL,               -- ISO 8601 timestamp
  updated_at TEXT NOT NULL                -- ISO 8601 timestamp
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_company_id ON profiles(company_id);
CREATE INDEX IF NOT EXISTS idx_profiles_status ON profiles(status);
CREATE INDEX IF NOT EXISTS idx_profiles_webhook_id ON profiles(webhook_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_profile_id ON campaigns(profile_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_campaign_instance ON campaigns(campaign_instance);
CREATE INDEX IF NOT EXISTS idx_events_campaign_id ON events(campaign_id);
CREATE INDEX IF NOT EXISTS idx_events_contact_id ON events(contact_id);
CREATE INDEX IF NOT EXISTS idx_events_event_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_invited_at ON events(invited_at);
CREATE INDEX IF NOT EXISTS idx_events_connected_at ON events(connected_at);
CREATE INDEX IF NOT EXISTS idx_events_replied_at ON events(replied_at);

-- Insert sample data for testing (optional - remove in production)
-- INSERT INTO companies (id, name, share_token, created_at, updated_at) 
-- VALUES ('test-company-1', 'Test Company', 'test-share-token-123', datetime('now'), datetime('now'));
