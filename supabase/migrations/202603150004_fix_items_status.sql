-- Fix missing status column in items table
-- The type item_status should already exist from initial_schema.sql
ALTER TABLE items ADD COLUMN IF NOT EXISTS status item_status DEFAULT 'unclaimed';
