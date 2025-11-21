-- Expandi Dashboard Database Schema
-- PostgreSQL version

-- Admin users table
-- Stores admin login credentials
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Companies table
-- Stores ORION's clients
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,              -- Company name (e.g., "ORION", "RWX")
  share_token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),       -- UUID for shareable dashboard URLs
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),               -- ISO 8601 timestamp
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()                -- ISO 8601 timestamp
);

-- Profiles table  
-- Stores individual profiles running campaigns (internal profiles, not LinkedIn accounts)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID,                        -- Foreign key to companies (NULL if unassigned)
  account_name TEXT NOT NULL,             -- Profile name (e.g., "Tobias Millington")
  account_email TEXT,                     -- Email associated with profile
  li_account_id INTEGER,                  -- Expandi's LinkedIn account ID (for reference only)
  webhook_id UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),       -- Unique webhook identifier for URL generation
  status TEXT NOT NULL DEFAULT 'unassigned', -- 'assigned' or 'unassigned'
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),               -- ISO 8601 timestamp
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),               -- ISO 8601 timestamp
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL
);

-- Campaigns table
-- Stores individual campaigns within each profile
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL,              -- Foreign key to profiles
  campaign_instance TEXT NOT NULL UNIQUE, -- Full string from Expandi webhook
  campaign_name TEXT NOT NULL,            -- Parsed campaign name (codes like "A008+M003")
  started_at TIMESTAMP WITH TIME ZONE NOT NULL,               -- ISO 8601 timestamp (extracted from campaign_instance)
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),               -- ISO 8601 timestamp
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),               -- ISO 8601 timestamp
  FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
);

-- Events table
-- Stores all webhook events (invites, connections, replies)
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL,              -- Foreign key to campaigns
  contact_id INTEGER NOT NULL,            -- Expandi contact ID
  event_type TEXT NOT NULL,               -- 'invite_sent', 'connection_accepted', 'contact_replied'
  event_data TEXT NOT NULL,               -- Raw JSON webhook payload (for audit trail)
  invited_at TIMESTAMP WITH TIME ZONE,                        -- ISO 8601 timestamp (NULL until invite sent)
  connected_at TIMESTAMP WITH TIME ZONE,                      -- ISO 8601 timestamp (NULL until connection accepted)
  replied_at TIMESTAMP WITH TIME ZONE,                        -- ISO 8601 timestamp (NULL until reply received)
  conversation_status TEXT,               -- Latest status from Expandi
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),               -- ISO 8601 timestamp
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
);

-- Contacts table
-- Stores contact information (minimal - just for reference)
-- NOTE: Contact details are NOT displayed to end users, only aggregated for KPIs
CREATE TABLE IF NOT EXISTS contacts (
  contact_id INTEGER NOT NULL,         -- Expandi contact ID (no UUID, use their ID)
  campaign_id UUID NOT NULL,           -- Foreign key to campaigns (REQUIRED for company-scoped deduplication)
  first_name TEXT,                        
  last_name TEXT,
  company_name TEXT,                      
  job_title TEXT,
  profile_link TEXT,
  email TEXT,
  phone TEXT,
  linked_to_contact_id INTEGER,        -- Reference to original contact for deduplication
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),               -- ISO 8601 timestamp
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),               -- ISO 8601 timestamp
  PRIMARY KEY (contact_id, campaign_id),
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
);

-- Failed webhook archive table
-- Stores webhooks that failed processing after retries
CREATE TABLE IF NOT EXISTS failed_webhook_archive (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id TEXT NOT NULL,               -- Webhook ID from URL
  raw_payload TEXT NOT NULL CHECK (length(raw_payload) <= 50000), -- Full webhook payload (50KB limit)
  error_message TEXT NOT NULL,            -- Why it failed
  retry_count INTEGER NOT NULL DEFAULT 0, -- How many times we tried
  failed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),                -- When it finally failed
  contact_id INTEGER,                     -- Contact ID (if we could extract it)
  campaign_instance TEXT,                 -- Campaign instance (if we could extract it)
  correlation_id UUID,                    -- For tracing related operations
  severity TEXT NOT NULL DEFAULT 'error' CHECK (severity IN ('critical', 'error', 'warning')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()                -- ISO 8601 timestamp
);

-- Error notifications table
-- Stores error notifications for admin dashboard
CREATE TABLE IF NOT EXISTS error_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_type TEXT NOT NULL,       -- 'webhook_failed', 'system_error'
  message TEXT NOT NULL,                  -- Human-readable message
  webhook_id TEXT,                        -- Associated webhook (if applicable)
  correlation_id UUID,                    -- For tracing
  severity TEXT NOT NULL DEFAULT 'error' CHECK (severity IN ('critical', 'error', 'warning')),
  resolved BOOLEAN NOT NULL DEFAULT FALSE, -- Whether admin has seen it
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()                -- ISO 8601 timestamp
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

-- Contact indexes for company-level deduplication
CREATE INDEX IF NOT EXISTS idx_contacts_campaign_id ON contacts(campaign_id);
CREATE INDEX IF NOT EXISTS idx_contacts_linked_to_contact_id ON contacts(linked_to_contact_id);
CREATE INDEX IF NOT EXISTS idx_contacts_company_lookup ON contacts(first_name, last_name, email, profile_link);

-- Error handling indexes
CREATE INDEX IF NOT EXISTS idx_failed_webhook_archive_webhook_id ON failed_webhook_archive(webhook_id);
CREATE INDEX IF NOT EXISTS idx_failed_webhook_archive_failed_at ON failed_webhook_archive(failed_at);
CREATE INDEX IF NOT EXISTS idx_failed_webhook_archive_correlation_id ON failed_webhook_archive(correlation_id);
CREATE INDEX IF NOT EXISTS idx_failed_webhook_archive_severity ON failed_webhook_archive(severity);
CREATE INDEX IF NOT EXISTS idx_error_notifications_resolved ON error_notifications(resolved);
CREATE INDEX IF NOT EXISTS idx_error_notifications_created_at ON error_notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_error_notifications_severity ON error_notifications(severity);

-- Tagging System Tables
CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS campaign_tags (
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (campaign_id, tag_id)
);

CREATE TABLE IF NOT EXISTS contact_tags (
  contact_id INTEGER NOT NULL,
  campaign_id UUID NOT NULL,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (contact_id, campaign_id, tag_id),
  FOREIGN KEY (contact_id, campaign_id) REFERENCES contacts(contact_id, campaign_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);
CREATE INDEX IF NOT EXISTS idx_campaign_tags_campaign_id ON campaign_tags(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_tags_tag_id ON campaign_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_contact_tags_contact_id_campaign_id ON contact_tags(contact_id, campaign_id);
CREATE INDEX IF NOT EXISTS idx_contact_tags_tag_id ON contact_tags(tag_id);

-- Insert sample data for testing (optional - remove in production)
-- INSERT INTO companies (id, name, share_token, created_at, updated_at) 
-- VALUES ('test-company-1', 'Test Company', 'test-share-token-123', datetime('now'));
