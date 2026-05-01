-- Drop old revenue tracking (replaced by closed_deals + ad_budget_revenue)
DROP TABLE IF EXISTS revenue_entries CASCADE;
DROP TABLE IF EXISTS revenue_niches CASCADE;

-- Closed deals — contractually committed revenue (forward-looking)
CREATE TABLE closed_deals (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name       text        NOT NULL,
  contractor_id     uuid        REFERENCES contractors(id) ON DELETE RESTRICT,
  niche             text,
  deal_value        numeric     NOT NULL,
  commission_amount numeric     NOT NULL,
  closed_at         date        NOT NULL,
  description       text,
  related_lead_id   uuid        REFERENCES leads(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_closed_deals_closed_at   ON closed_deals(closed_at DESC);
CREATE INDEX idx_closed_deals_contractor  ON closed_deals(contractor_id);
ALTER TABLE closed_deals ENABLE ROW LEVEL SECURITY;

-- Ad budget revenue — cash received from clients for ad spend
CREATE TABLE ad_budget_revenue (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id uuid        REFERENCES contractors(id) ON DELETE RESTRICT,
  amount        numeric     NOT NULL,
  received_at   date        NOT NULL,
  description   text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ad_budget_received    ON ad_budget_revenue(received_at DESC);
CREATE INDEX idx_ad_budget_contractor  ON ad_budget_revenue(contractor_id);
ALTER TABLE ad_budget_revenue ENABLE ROW LEVEL SECURITY;

-- Monthly targets
CREATE TABLE monthly_targets (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  month               text        NOT NULL UNIQUE,  -- 'YYYY-MM'
  deal_value_target   numeric,
  commission_target   numeric,
  ad_budget_target    numeric,
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE monthly_targets ENABLE ROW LEVEL SECURITY;
