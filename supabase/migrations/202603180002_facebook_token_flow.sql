ALTER TABLE facebook_pages
  ADD COLUMN IF NOT EXISTS facebook_user_id TEXT,
  ADD COLUMN IF NOT EXISTS user_access_token TEXT,
  ADD COLUMN IF NOT EXISTS page_access_token TEXT,
  ADD COLUMN IF NOT EXISTS page_tasks_json JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS token_type_used_for_sync TEXT DEFAULT 'page_access_token',
  ADD COLUMN IF NOT EXISTS token_last_validated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS token_status TEXT DEFAULT 'valid',
  ADD COLUMN IF NOT EXISTS connection_status TEXT DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS last_sync_error TEXT,
  ADD COLUMN IF NOT EXISTS reconnect_required BOOLEAN DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS facebook_connection_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facebook_user_id TEXT,
  user_access_token TEXT NOT NULL,
  pages_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  granted_scopes_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  required_scopes_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '15 minutes'
);

CREATE INDEX IF NOT EXISTS idx_facebook_connection_sessions_expires_at
  ON facebook_connection_sessions (expires_at);

UPDATE facebook_pages
SET
  page_access_token = COALESCE(page_access_token, access_token),
  token_type_used_for_sync = COALESCE(token_type_used_for_sync, 'page_access_token'),
  token_status = COALESCE(token_status, 'valid'),
  connection_status = COALESCE(connection_status, 'active'),
  reconnect_required = COALESCE(reconnect_required, FALSE)
WHERE TRUE;
