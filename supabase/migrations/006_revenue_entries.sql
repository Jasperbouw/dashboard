-- ──────────────────────────────────────────────────────────────────────────────
-- 006_revenue_entries.sql
-- Replaces retainer_invoices with a unified revenue_entries table that
-- covers all revenue types: retainer fees, ad budget pass-through,
-- percentage commissions, flat-fee commissions, and other.
--
-- Migration plan:
--   1. Create revenue_entries
--   2. Migrate retainer_invoices → two rows per invoice
--      (a) type='retainer_fee'  — our income
--      (b) type='ad_budget'     — pass-through to Meta (amount = ad_budget_amount)
--   3. Drop retainer_invoices
-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS revenue_entries (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id    uuid        NOT NULL REFERENCES contractors(id) ON DELETE CASCADE,
  entry_date       date        NOT NULL,
  period_start     date,
  period_end       date,
  type             text        NOT NULL CHECK (type IN (
                     'ad_budget', 'retainer_fee',
                     'commission_percentage', 'commission_flat', 'other'
                   )),
  niche            text        CHECK (niche IN (
                     'bouw', 'daken', 'dakkapel', 'extras',
                     'zwembad', 'nieuwbouw', 'pergola'
                   )),
  amount           numeric     NOT NULL,
  ad_budget_amount numeric     NOT NULL DEFAULT 0,
  description      text,
  invoice_number   text,
  payment_status   text        NOT NULL DEFAULT 'paid'
                               CHECK (payment_status IN ('open', 'paid', 'overdue')),
  paid_at          timestamptz,
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_revenue_entries_contractor
  ON revenue_entries(contractor_id, entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_revenue_entries_date
  ON revenue_entries(entry_date DESC);

ALTER TABLE revenue_entries ENABLE ROW LEVEL SECURITY;

-- Migrate retainer fee rows (our income)
INSERT INTO revenue_entries
  (contractor_id, entry_date, period_start, period_end,
   type, amount, ad_budget_amount, payment_status, paid_at, created_at)
SELECT
  contractor_id, invoice_date, period_start, period_end,
  'retainer_fee', fee_amount, 0, 'paid', invoice_date::timestamptz, created_at
FROM retainer_invoices;

-- Migrate ad budget rows (pass-through; amount = ad_budget_amount for both fields)
INSERT INTO revenue_entries
  (contractor_id, entry_date, period_start, period_end,
   type, amount, ad_budget_amount, payment_status, paid_at, created_at)
SELECT
  contractor_id, invoice_date, period_start, period_end,
  'ad_budget', ad_budget_amount, ad_budget_amount, 'paid', invoice_date::timestamptz, created_at
FROM retainer_invoices
WHERE ad_budget_amount > 0;

DROP TABLE retainer_invoices;
