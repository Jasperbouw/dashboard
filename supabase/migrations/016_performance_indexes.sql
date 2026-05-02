-- Performance indexes — Phase 1
-- Pure additive migration, no data changes.
-- All IF NOT EXISTS so this is safe to re-run.

-- ── leads ─────────────────────────────────────────────────────────────────────

-- Date-range filter used by 8+ queries on Today and Funnel pages on every load.
-- Biggest single win: eliminates full seq-scans of the leads table.
CREATE INDEX IF NOT EXISTS leads_monday_created_at_idx
  ON leads (monday_created_at);

-- Composite for Funnel functions that filter on both contractor_id AND
-- monday_created_at (currentStageDistribution, campaignPerformance,
-- nichePerformance). The leftmost-prefix rule means this index also satisfies
-- queries filtering on contractor_id alone, making leads_contractor_id_idx
-- redundant — see note at the bottom of this file.
CREATE INDEX IF NOT EXISTS leads_contractor_created_idx
  ON leads (contractor_id, monday_created_at);

-- canonical_stage filter used by Today open-pipeline counts
-- (canonical_stage = 'inspection', canonical_stage = 'quote_sent').
-- Low cardinality, but selective enough for these two stages since inspection
-- and quote_sent together represent a small fraction of all leads.
CREATE INDEX IF NOT EXISTS leads_canonical_stage_idx
  ON leads (canonical_stage);

-- ── lead_status_changes ───────────────────────────────────────────────────────

-- Composite for the dominant query pattern: to_status IN (...) AND changed_at
-- BETWEEN ... Used by 9+ queries on Today (6 transition queries) and Funnel
-- (funnelTransitions, avgDaysBetweenTransitionsCore). Eliminates full table
-- scans on what can be a 50,000+ row table.
-- The existing (lead_id, changed_at) index is NOT made redundant — it is still
-- used by queries that join or filter on lead_id (avgDaysBetweenTransitionsCore
-- second query, leads!inner join in funnelTransitions).
CREATE INDEX IF NOT EXISTS lead_status_changes_to_status_changed_at_idx
  ON lead_status_changes (to_status, changed_at);

-- ── closed_deals ──────────────────────────────────────────────────────────────

-- Composite for the Finance YTD query: niche IN (...) AND closed_at BETWEEN
-- Jan-1 AND today. The existing idx_closed_deals_closed_at (closed_at DESC)
-- index is NOT made redundant — it is still used by month-filtered queries that
-- do not include a niche filter.
CREATE INDEX IF NOT EXISTS closed_deals_niche_closed_at_idx
  ON closed_deals (niche, closed_at);

-- ── Redundancy note ───────────────────────────────────────────────────────────
-- leads_contractor_id_idx ON leads (contractor_id) — defined in schema.sql —
-- is now redundant. Postgres can satisfy contractor_id-only predicates using
-- the leftmost prefix of leads_contractor_created_idx (contractor_id,
-- monday_created_at). Consider dropping it in a follow-up migration once
-- this migration has been applied and verified:
--
--   DROP INDEX IF EXISTS leads_contractor_id_idx;
--
-- Not done here to keep this migration purely additive and safe to deploy first.
