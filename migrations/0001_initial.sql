PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS stacks (
  id TEXT PRIMARY KEY CHECK(length(id) = 16),
  combination_key TEXT NOT NULL UNIQUE,
  apps_json TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE TABLE IF NOT EXISTS stack_apps (
  stack_id TEXT NOT NULL REFERENCES stacks(id) ON DELETE CASCADE,
  app_id TEXT NOT NULL,
  PRIMARY KEY (stack_id, app_id)
);
CREATE INDEX IF NOT EXISTS stack_apps_app ON stack_apps(app_id, stack_id);
CREATE TABLE IF NOT EXISTS picks (
  visitor_hash TEXT PRIMARY KEY,
  stack_id TEXT NOT NULL REFERENCES stacks(id),
  source_stack_id TEXT REFERENCES stacks(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS picks_stack ON picks(stack_id);
CREATE INDEX IF NOT EXISTS picks_source ON picks(source_stack_id);
CREATE TABLE IF NOT EXISTS rate_limits (
  bucket TEXT PRIMARY KEY,
  requests INTEGER NOT NULL DEFAULT 1,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS rate_expiry ON rate_limits(expires_at);
