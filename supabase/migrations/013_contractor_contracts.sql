CREATE TABLE IF NOT EXISTS contractor_contracts (
  id                       uuid primary key default gen_random_uuid(),
  contractor_id            uuid references contractors(id) on delete cascade not null,
  title                    text not null,
  file_path                text not null,
  -- Snapshot of the data used at generation time
  kvk_nummer               text,
  vestigingsadres          text,
  vertegenwoordiger_naam   text,
  vertegenwoordiger_functie text,
  commissie_percentage     numeric,
  datum                    date,
  -- Metadata
  generated_at             timestamptz default now(),
  generated_by             text default 'jasper',
  status                   text default 'active' check (status in ('active', 'archived'))
);

CREATE INDEX idx_contractor_contracts_contractor
  ON contractor_contracts(contractor_id, generated_at DESC);

ALTER TABLE contractor_contracts ENABLE ROW LEVEL SECURITY;
