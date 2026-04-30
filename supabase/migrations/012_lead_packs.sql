CREATE TABLE IF NOT EXISTS lead_packs (
  id uuid primary key default gen_random_uuid(),
  contractor_id uuid references contractors(id) on delete cascade not null,
  niche text not null,

  pack_type text not null check (pack_type in ('budget_based', 'lead_based')),

  units_promised numeric not null check (units_promised > 0),
  units_used numeric not null default 0,

  amount_paid numeric,
  paid_at timestamptz,

  started_at timestamptz not null,
  completed_at timestamptz,
  status text not null default 'active' check (status in ('active', 'completed', 'paused')),

  related_revenue_entry_id uuid references revenue_entries(id) on delete set null,
  notes text,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

CREATE INDEX idx_lead_packs_contractor_status
  ON lead_packs(contractor_id, status, started_at DESC);
CREATE INDEX idx_lead_packs_active
  ON lead_packs(contractor_id, niche, status) WHERE status = 'active';

ALTER TABLE lead_packs ENABLE ROW LEVEL SECURITY;
