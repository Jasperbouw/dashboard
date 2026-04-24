-- ──────────────────────────────────────────────────────────────────────────────
-- 004_enable_rls.sql
-- Enable Row Level Security on all tables.
--
-- Architecture:
--   Server-side API routes use SUPABASE_SERVICE_ROLE_KEY → bypasses RLS.
--   No anon-key calls reach sensitive tables. Enabling RLS with no policies
--   means the anon key gets zero access — which is what we want.
--
--   Exception: kv_store is accessed client-side (Creatives / Docs tabs)
--   via the anon key. It holds UI state only, not sensitive business data.
--   We enable RLS + add an explicit anon read/write policy for it.
-- ──────────────────────────────────────────────────────────────────────────────

-- Core business tables — no anon access
ALTER TABLE contractors          ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads                ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects             ENABLE ROW LEVEL SECURITY;
ALTER TABLE boards_config        ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_status_changes  ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_runs            ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts               ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_label_mapping ENABLE ROW LEVEL SECURITY;

-- These tables may not exist yet — safe to run when they do
-- ALTER TABLE lead_updates       ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE meta_campaigns     ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE meta_spend_daily   ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE ad_packs           ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE contracts          ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE intake_docs        ENABLE ROW LEVEL SECURITY;

-- kv_store — client-side reads/writes via anon key (UI state only)
ALTER TABLE kv_store ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_rw_kv_store" ON kv_store;
CREATE POLICY "anon_rw_kv_store"
  ON kv_store
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);
