-- Marketing Agent: hook library, creative batches, and generated creatives

CREATE TABLE hooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  niche TEXT NOT NULL CHECK (niche IN ('bouw', 'daken', 'dakkapel', 'extras')),
  description TEXT NOT NULL,
  visual_concept TEXT,
  status TEXT NOT NULL DEFAULT 'testing' CHECK (status IN ('testing', 'winner', 'dead')),
  times_used INTEGER NOT NULL DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE creative_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_date DATE NOT NULL,
  niches TEXT[] NOT NULL,
  total_creatives INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'complete', 'failed')),
  error_log TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE creatives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hook_id UUID REFERENCES hooks(id) ON DELETE SET NULL,
  niche TEXT NOT NULL CHECK (niche IN ('bouw', 'daken', 'dakkapel', 'extras')),
  batch_id UUID REFERENCES creative_batches(id) ON DELETE SET NULL,
  batch_date DATE NOT NULL,
  prompt_used TEXT NOT NULL,
  copy_headline TEXT,
  copy_body TEXT,
  copy_cta TEXT,
  image_url TEXT,
  thumbnail_url TEXT,
  drive_file_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'published', 'rejected')),
  rejection_reason TEXT,
  weekly_performance JSONB DEFAULT '[]'::jsonb,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX hooks_niche_status_idx ON hooks (niche, status);
CREATE INDEX creatives_batch_date_idx ON creatives (batch_date DESC);
CREATE INDEX creatives_hook_id_idx ON creatives (hook_id);
CREATE INDEX creatives_status_idx ON creatives (status);
