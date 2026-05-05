-- Add angle_description to creatives (Claude's reasoning on why this angle works)
ALTER TABLE creatives ADD COLUMN IF NOT EXISTS angle_description TEXT;
