-- Drop hooks table and its dependencies
DROP TABLE IF EXISTS hooks CASCADE;

-- Remove hook_id from creatives, add source_winner_id
ALTER TABLE creatives DROP COLUMN IF EXISTS hook_id;
ALTER TABLE creatives ADD COLUMN IF NOT EXISTS source_winner_id UUID;

-- Winners table: uploaded winning ads with Meta performance stats
CREATE TABLE winners (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  niche         TEXT NOT NULL CHECK (niche IN ('bouw', 'daken', 'dakkapel')),
  image_url     TEXT NOT NULL,
  thumbnail_url TEXT,
  overlay_text  TEXT,
  notes         TEXT,
  spend         NUMERIC(10,2),
  impressions   INTEGER,
  ctr           NUMERIC(5,2),
  cpl           NUMERIC(10,2),
  leads         INTEGER,
  is_winner     BOOLEAN GENERATED ALWAYS AS (cpl IS NOT NULL AND cpl <= 12) STORED,
  uploaded_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX winners_niche_idx     ON winners (niche);
CREATE INDEX winners_is_winner_idx ON winners (is_winner) WHERE is_winner = TRUE;

-- FK from creatives to winners
ALTER TABLE creatives
  ADD CONSTRAINT creatives_source_winner_id_fkey
  FOREIGN KEY (source_winner_id) REFERENCES winners(id) ON DELETE SET NULL;
