-- Add sync metadata fields for better transparency and error handling

-- Collections table
ALTER TABLE collections 
ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS sync_error TEXT;

-- Batch Posts table
ALTER TABLE batch_posts 
ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS sync_error TEXT;

-- Items table
ALTER TABLE items 
ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS sync_error TEXT;

-- Add comment_count cache to items if not exists (helpful for diagnostics)
ALTER TABLE items 
ADD COLUMN IF NOT EXISTS comment_count INTEGER DEFAULT 0;

-- Ensure audit_logs has the necessary context
ALTER TABLE audit_logs
ADD COLUMN IF NOT EXISTS reason TEXT;
