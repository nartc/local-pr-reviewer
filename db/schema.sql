-- Logical repos (identified by git remote origin)
CREATE TABLE IF NOT EXISTS repos (
  id TEXT PRIMARY KEY,
  remote_url TEXT UNIQUE,
  name TEXT NOT NULL,
  base_branch TEXT DEFAULT 'main',
  created_at TEXT DEFAULT (datetime('now'))
);

-- Registered paths (worktrees/checkouts pointing to a repo)
CREATE TABLE IF NOT EXISTS repo_paths (
  id TEXT PRIMARY KEY,
  repo_id TEXT NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
  path TEXT UNIQUE NOT NULL,
  last_accessed_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Sessions scoped to repo + branch (NOT path)
CREATE TABLE IF NOT EXISTS review_sessions (
  id TEXT PRIMARY KEY,
  repo_id TEXT NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
  branch TEXT NOT NULL,
  base_branch TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(repo_id, branch)
);

-- Comments scoped to session
CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES review_sessions(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  line_start INTEGER,
  line_end INTEGER,
  side TEXT CHECK(side IN ('old', 'new', 'both')),
  content TEXT NOT NULL,
  status TEXT DEFAULT 'queued' CHECK(status IN ('queued', 'staged', 'sent', 'resolved', 'cancelled')),
  created_at TEXT DEFAULT (datetime('now')),
  sent_at TEXT
);

-- Failed sends for retry (after 3 auto-retry attempts)
CREATE TABLE IF NOT EXISTS failed_sends (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES review_sessions(id) ON DELETE CASCADE,
  comments_json TEXT NOT NULL,
  error TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- App-level config (tmux session preference, YOLO mode, AI provider, etc.)
CREATE TABLE IF NOT EXISTS app_config (
  key TEXT PRIMARY KEY,
  value TEXT
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_repo_paths_repo_id ON repo_paths(repo_id);
CREATE INDEX IF NOT EXISTS idx_review_sessions_repo_id ON review_sessions(repo_id);
CREATE INDEX IF NOT EXISTS idx_comments_session_id ON comments(session_id);
CREATE INDEX IF NOT EXISTS idx_comments_status ON comments(status);
CREATE INDEX IF NOT EXISTS idx_failed_sends_session_id ON failed_sends(session_id);
