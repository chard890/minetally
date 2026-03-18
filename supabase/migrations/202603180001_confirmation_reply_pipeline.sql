ALTER TABLE comments
  ADD COLUMN IF NOT EXISTS parent_comment_id UUID REFERENCES comments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_reply BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_page_author BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS raw_payload_json JSONB DEFAULT '{}'::jsonb;

ALTER TABLE item_winners
  ADD COLUMN IF NOT EXISTS confirmation_reply_id UUID REFERENCES comments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS parent_comment_id UUID REFERENCES comments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS buyer_comment_message TEXT,
  ADD COLUMN IF NOT EXISTS confirmation_message TEXT,
  ADD COLUMN IF NOT EXISTS pricing_source TEXT,
  ADD COLUMN IF NOT EXISTS needs_review BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS review_reason TEXT;

CREATE INDEX IF NOT EXISTS comments_parent_comment_id_idx ON comments(parent_comment_id);
CREATE INDEX IF NOT EXISTS item_winners_confirmation_reply_id_idx ON item_winners(confirmation_reply_id);
CREATE INDEX IF NOT EXISTS item_winners_needs_review_idx ON item_winners(needs_review);
