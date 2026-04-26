-- Meta Business Manager monthly spend tracking
-- One row per calendar month, upserted from the UI

CREATE TABLE IF NOT EXISTS meta_spend_monthly (
  id         uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  year_month date        NOT NULL UNIQUE, -- always stored as first-of-month (YYYY-MM-01)
  amount_eur numeric(12, 2) NOT NULL DEFAULT 0,
  notes      text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS meta_spend_monthly_ym_idx ON meta_spend_monthly (year_month DESC);
