ALTER TABLE item_winners
  ADD COLUMN IF NOT EXISTS batch_post_id UUID REFERENCES batch_posts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS commenter_id TEXT;

UPDATE item_winners AS winners
SET
  batch_post_id = items.batch_post_id,
  commenter_id = COALESCE(
    NULLIF(winners.commenter_id, ''),
    NULLIF(winners.buyer_id, ''),
    NULLIF((SELECT commenter_id FROM comments WHERE comments.id = winners.winner_comment_id), '')
  )
FROM items
WHERE winners.item_id = items.id
  AND (
    winners.batch_post_id IS NULL
    OR winners.commenter_id IS NULL
    OR winners.commenter_id = ''
  );

CREATE UNIQUE INDEX IF NOT EXISTS item_winners_item_id_key ON item_winners (item_id);
