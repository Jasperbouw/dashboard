-- ──────────────────────────────────────────────────────────────────────────────
-- 005_retainer_invoices.sql
-- Tracks actual retainer invoices sent to contractors.
-- YTD/MTD/QTD retainer revenue must come from this table, not from
-- months-elapsed × rate (which overstates revenue for invoices not yet sent).
-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS retainer_invoices (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id    uuid        NOT NULL REFERENCES contractors(id) ON DELETE CASCADE,
  invoice_date     date        NOT NULL,
  period_start     date        NOT NULL,
  period_end       date        NOT NULL,
  fee_amount       numeric     NOT NULL,
  ad_budget_amount numeric     NOT NULL DEFAULT 0,
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_retainer_invoices_contractor
  ON retainer_invoices(contractor_id, invoice_date DESC);

-- No anon access — service role only (RLS enabled globally)
ALTER TABLE retainer_invoices ENABLE ROW LEVEL SECURITY;

-- Seed: March 2026 invoices only (the only ones sent so far)
INSERT INTO retainer_invoices
  (contractor_id, invoice_date, period_start, period_end, fee_amount, ad_budget_amount)
SELECT id, '2026-03-15', '2026-03-01', '2026-03-31', 1000, 2000
FROM contractors WHERE name = 'Energie Collectief Oranje';

INSERT INTO retainer_invoices
  (contractor_id, invoice_date, period_start, period_end, fee_amount, ad_budget_amount)
SELECT id, '2026-03-15', '2026-03-01', '2026-03-31', 500, 500
FROM contractors WHERE name = 'Bouwkostencalculatie';
