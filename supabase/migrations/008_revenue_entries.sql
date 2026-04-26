-- 008_revenue_entries.sql
-- Creates the unified revenue_entries table.
-- If 006_revenue_entries.sql was already applied, this will skip the CREATE
-- but still add the revenue_niches table and migrate retainer data.
-- Run in Supabase SQL editor.

CREATE TABLE IF NOT EXISTS revenue_entries (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id     uuid        NOT NULL REFERENCES contractors(id) ON DELETE CASCADE,
  entry_date        date        NOT NULL,
  period_start      date,
  period_end        date,
  type              text        NOT NULL CHECK (type IN (
                      'ad_budget', 'retainer_fee',
                      'commission_percentage', 'commission_flat', 'other'
                    )),
  niche             text,                        -- free-form, no CHECK constraint
  amount            numeric     NOT NULL CHECK (amount >= 0),
  description       text,
  invoice_number    text,
  payment_status    text        NOT NULL DEFAULT 'paid'
                                CHECK (payment_status IN ('open', 'paid', 'overdue')),
  paid_at           timestamptz,
  linked_project_id uuid        REFERENCES projects(id) ON DELETE SET NULL,
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- Add any columns that 006 may have omitted (safe IF NOT EXISTS pattern)
ALTER TABLE revenue_entries
  ADD COLUMN IF NOT EXISTS linked_project_id uuid REFERENCES projects(id) ON DELETE SET NULL;
ALTER TABLE revenue_entries
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- If 006 added the constrained niche column, drop the constraint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name LIKE '%revenue_entries%niche%'
      AND table_name = 'revenue_entries'
  ) THEN
    ALTER TABLE revenue_entries DROP CONSTRAINT IF EXISTS revenue_entries_niche_check;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_revenue_entries_contractor
  ON revenue_entries(contractor_id, entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_revenue_entries_date
  ON revenue_entries(entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_revenue_entries_type
  ON revenue_entries(type, entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_revenue_entries_niche
  ON revenue_entries(niche, entry_date DESC) WHERE niche IS NOT NULL;

ALTER TABLE revenue_entries ENABLE ROW LEVEL SECURITY;

-- Migrate retainer_invoices if table still exists and not yet migrated
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'retainer_invoices'
  ) THEN
    -- Fee rows
    INSERT INTO revenue_entries (
      contractor_id, entry_date, period_start, period_end,
      type, amount, description, payment_status, paid_at, notes
    )
    SELECT
      contractor_id, invoice_date, period_start, period_end,
      'retainer_fee', fee_amount,
      'Migrated from retainer_invoices',
      'paid', invoice_date::timestamptz, notes
    FROM retainer_invoices
    WHERE fee_amount > 0
      AND NOT EXISTS (
        SELECT 1 FROM revenue_entries r
        WHERE r.contractor_id = retainer_invoices.contractor_id
          AND r.entry_date = retainer_invoices.invoice_date
          AND r.type = 'retainer_fee'
      );

    -- Ad budget rows
    INSERT INTO revenue_entries (
      contractor_id, entry_date, period_start, period_end,
      type, amount, description, payment_status, paid_at, notes
    )
    SELECT
      contractor_id, invoice_date, period_start, period_end,
      'ad_budget', ad_budget_amount,
      'Migrated from retainer_invoices (ad budget)',
      'paid', invoice_date::timestamptz, notes
    FROM retainer_invoices
    WHERE ad_budget_amount > 0
      AND NOT EXISTS (
        SELECT 1 FROM revenue_entries r
        WHERE r.contractor_id = retainer_invoices.contractor_id
          AND r.entry_date = retainer_invoices.invoice_date
          AND r.type = 'ad_budget'
      );
  END IF;
END $$;

-- Niche lookup table
CREATE TABLE IF NOT EXISTS revenue_niches (
  id            uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text  UNIQUE NOT NULL,
  display_order int   DEFAULT 100,
  created_at    timestamptz DEFAULT now()
);

INSERT INTO revenue_niches (name, display_order) VALUES
  ('bouw',     1),
  ('daken',    2),
  ('dakkapel', 3),
  ('extras',   4)
ON CONFLICT (name) DO NOTHING;

ALTER TABLE revenue_niches ENABLE ROW LEVEL SECURITY;
