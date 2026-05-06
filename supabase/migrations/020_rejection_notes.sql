-- Add rejection_notes column to creatives table
-- rejection_reason already exists from migration 017
ALTER TABLE creatives ADD COLUMN IF NOT EXISTS rejection_notes TEXT;
