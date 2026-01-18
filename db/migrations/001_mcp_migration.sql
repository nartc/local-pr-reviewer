-- Migration 001: MCP Support
-- Adds columns and tables needed for MCP-based comment delivery

-- Add new columns to comments table
ALTER TABLE comments ADD COLUMN delivered_at TEXT;
ALTER TABLE comments ADD COLUMN resolved_at TEXT;
ALTER TABLE comments ADD COLUMN resolved_by TEXT;

-- Update status constraint to include 'resolved'
-- SQLite doesn't support ALTER CONSTRAINT, so we recreate via trigger workaround
-- The app layer will enforce the new constraint

-- New table: Track MCP client connections
CREATE TABLE IF NOT EXISTS mcp_clients (
  id TEXT PRIMARY KEY,
  client_name TEXT,
  client_version TEXT,
  connected_at TEXT DEFAULT (datetime('now')),
  last_seen_at TEXT DEFAULT (datetime('now')),
  working_dir TEXT
);

-- New table: Track comment deliveries per client
CREATE TABLE IF NOT EXISTS comment_deliveries (
  id TEXT PRIMARY KEY,
  comment_id TEXT NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  client_id TEXT REFERENCES mcp_clients(id) ON DELETE CASCADE,
  delivered_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_deliveries_comment ON comment_deliveries(comment_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_client ON comment_deliveries(client_id);

-- Remove tmux-specific config
DELETE FROM app_config WHERE key LIKE 'tmux_%';
