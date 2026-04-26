ALTER TABLE contractors
  ADD COLUMN IF NOT EXISTS street_address    text,
  ADD COLUMN IF NOT EXISTS postal_code       text,
  ADD COLUMN IF NOT EXISTS city              text,
  ADD COLUMN IF NOT EXISTS country           text DEFAULT 'NL',
  ADD COLUMN IF NOT EXISTS latitude          numeric,
  ADD COLUMN IF NOT EXISTS longitude         numeric,
  ADD COLUMN IF NOT EXISTS service_radius_km numeric DEFAULT 50,
  ADD COLUMN IF NOT EXISTS service_provinces text[];

CREATE INDEX IF NOT EXISTS idx_contractors_coords
  ON contractors(latitude, longitude)
  WHERE latitude IS NOT NULL;
