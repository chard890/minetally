-- MineTally Initial Schema Migration

-- Enable pgcrypto for UUID generation if needed
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enums
CREATE TYPE collection_status AS ENUM ('draft', 'open', 'finalized', 'locked');
CREATE TYPE batch_sync_status AS ENUM ('not_synced', 'synced', 'syncing', 'error');
CREATE TYPE item_status AS ENUM ('unclaimed', 'claimed', 'needs_review', 'manual_override', 'locked');
CREATE TYPE winner_status AS ENUM ('auto', 'manual', 'review_required');

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL DEFAULT 'admin',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Facebook Pages Table
CREATE TABLE IF NOT EXISTS facebook_pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meta_page_id TEXT UNIQUE NOT NULL,
    page_name TEXT NOT NULL,
    access_token TEXT,
    token_expires_at TIMESTAMPTZ,
    connected_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Collections Table
CREATE TABLE IF NOT EXISTS collections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    page_id UUID REFERENCES facebook_pages(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ NOT NULL,
    finalize_date TIMESTAMPTZ,
    status collection_status DEFAULT 'open',
    total_batch_posts INTEGER DEFAULT 0,
    total_items INTEGER DEFAULT 0,
    total_claimed_items INTEGER DEFAULT 0,
    total_needs_review INTEGER DEFAULT 0,
    total_value DECIMAL(12, 2) DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Batch Posts Table
CREATE TABLE IF NOT EXISTS batch_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    meta_post_id TEXT UNIQUE,
    title TEXT NOT NULL,
    caption TEXT,
    posted_at TIMESTAMPTZ,
    sync_status batch_sync_status DEFAULT 'not_synced',
    total_items INTEGER DEFAULT 0,
    total_claimed_items INTEGER DEFAULT 0,
    total_needs_review INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Items Table
CREATE TABLE IF NOT EXISTS items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_post_id UUID NOT NULL REFERENCES batch_posts(id) ON DELETE CASCADE,
    item_number INTEGER NOT NULL,
    meta_media_id TEXT UNIQUE,
    image_url TEXT NOT NULL,
    thumbnail_url TEXT NOT NULL,
    size_label TEXT,
    raw_price_text TEXT,
    price_map_json JSONB DEFAULT '{}'::jsonb,
    winner_claim_word TEXT,
    resolved_price DECIMAL(10, 2),
    needs_price_review BOOLEAN DEFAULT FALSE,
    status item_status DEFAULT 'unclaimed',
    is_locked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Comments Table
CREATE TABLE IF NOT EXISTS comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    meta_comment_id TEXT UNIQUE,
    commenter_id TEXT,
    commenter_name TEXT NOT NULL,
    comment_text TEXT NOT NULL,
    normalized_text TEXT,
    claim_type TEXT,
    is_valid_claim BOOLEAN DEFAULT FALSE,
    is_cancel_comment BOOLEAN DEFAULT FALSE,
    is_late_claim BOOLEAN DEFAULT FALSE,
    is_first_claimant BOOLEAN DEFAULT FALSE,
    commented_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Item Winners Table
CREATE TABLE IF NOT EXISTS item_winners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    winner_comment_id UUID REFERENCES comments(id) ON DELETE SET NULL,
    buyer_id TEXT,
    buyer_name TEXT,
    winning_claim_word TEXT,
    resolved_price DECIMAL(10, 2),
    status winner_status DEFAULT 'auto',
    is_manual_override BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Buyer Totals Table
CREATE TABLE IF NOT EXISTS buyer_totals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    buyer_id TEXT,
    buyer_name TEXT NOT NULL,
    total_items INTEGER DEFAULT 0,
    total_amount DECIMAL(12, 2) DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Settings Table
CREATE TABLE IF NOT EXISTS settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    valid_claim_keywords_json JSONB DEFAULT '["mine", "grab", "steal"]'::jsonb,
    cancel_keywords_json JSONB DEFAULT '["cancel", "pass", "mine off"]'::jsonb,
    claim_code_mapping_json JSONB DEFAULT '{"M": "mine", "S": "steal", "G": "grab"}'::jsonb,
    sync_preferences_json JSONB DEFAULT '{"syncPhotosFirst": true, "syncCommentsAfterImport": true, "requireThumbnailVerification": false}'::jsonb,
    finalization_behavior_json JSONB DEFAULT '{"autoReassignOnCancel": true, "lockCollectionOnFinalize": true, "requireReviewBeforeFinalize": true}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    collection_id UUID REFERENCES collections(id) ON DELETE SET NULL,
    batch_post_id UUID REFERENCES batch_posts(id) ON DELETE SET NULL,
    item_id UUID REFERENCES items(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    actor TEXT,
    details_json JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Updated At Trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to all tables with updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_facebook_pages_updated_at BEFORE UPDATE ON facebook_pages FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_collections_updated_at BEFORE UPDATE ON collections FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_batch_posts_updated_at BEFORE UPDATE ON batch_posts FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_items_updated_at BEFORE UPDATE ON items FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_comments_updated_at BEFORE UPDATE ON comments FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_item_winners_updated_at BEFORE UPDATE ON item_winners FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_buyer_totals_updated_at BEFORE UPDATE ON buyer_totals FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON settings FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
