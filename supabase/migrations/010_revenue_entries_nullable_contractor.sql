-- Allow revenue_entries without a contractor_id.
-- Needed for legacy Stripe payments, one-off commissions (e.g. Hoogezand),
-- and any income that doesn't belong to a specific active contractor.

ALTER TABLE revenue_entries
  ALTER COLUMN contractor_id DROP NOT NULL;
