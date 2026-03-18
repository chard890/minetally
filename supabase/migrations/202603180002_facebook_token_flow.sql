ALTER TABLE facebook_pages
  ADD COLUMN IF NOT EXISTS user_access_token TEXT,
  ADD COLUMN IF NOT EXISTS page_access_token TEXT,
  ADD COLUMN IF NOT EXISTS page_tasks_json JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS token_type_used_for_sync TEXT DEFAULT 'page_access_token',
  ADD COLUMN IF NOT EXISTS token_last_validated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS token_status TEXT DEFAULT 'valid',
  ADD COLUMN IF NOT EXISTS connection_status TEXT DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS last_sync_error TEXT;

UPDATE facebook_pages
SET
  page_access_token = COALESCE(page_access_token, access_token),
  token_type_used_for_sync = COALESCE(token_type_used_for_sync, 'page_access_token'),
  token_status = COALESCE(token_status, 'valid'),
  connection_status = COALESCE(connection_status, 'active')
WHERE TRUE;
