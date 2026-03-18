-- Add collection_id and raw_media_json to items table
ALTER TABLE items ADD COLUMN IF NOT EXISTS collection_id UUID REFERENCES collections(id) ON DELETE CASCADE;
ALTER TABLE items ADD COLUMN IF NOT EXISTS raw_media_json JSONB DEFAULT '{}';

-- Create an index on collection_id for performance
CREATE INDEX IF NOT EXISTS idx_items_collection_id ON items(collection_id);
