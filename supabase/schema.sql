-- ═══════════════════════════════════════════════════════════
-- Bouwcheck Command Center — full schema
-- Run once in Supabase SQL Editor (project → SQL Editor → New query)
-- ═══════════════════════════════════════════════════════════

-- ── Contractors ──────────────────────────────────────────────
create table if not exists contractors (
  id                     uuid primary key default gen_random_uuid(),
  name                   text not null,
  niche                  text not null,           -- 'daken' | 'dakkapel' | 'bouw' | 'extras'
  location               text,
  latitude               double precision,
  longitude              double precision,
  target_monthly_leads   int,
  target_monthly_revenue numeric,
  target_commission      numeric,
  active                 boolean default true,
  created_at             timestamptz default now()
);

-- ── Board configuration ───────────────────────────────────────
create table if not exists boards_config (
  id             bigint primary key,              -- Monday board ID
  name           text not null,
  type           text not null,                   -- 'general' | 'company' | 'projects'
  contractor_id  uuid references contractors(id),
  niche          text,
  column_map     jsonb not null default '{}',     -- canonical field → Monday column ID
  active         boolean default true,
  created_at     timestamptz default now()
);

-- ── Cached Monday leads ───────────────────────────────────────
create table if not exists leads (
  id                 uuid primary key default gen_random_uuid(),
  monday_item_id     text unique not null,
  board_id           bigint references boards_config(id),
  contractor_id      uuid references contractors(id),
  contact_name       text,
  phone              text,
  email              text,
  campaign_tag       text,
  urgentie           text,
  dienst             text,
  m2                 text,
  tekening           text,
  postcode           text,
  straat             text,
  current_status     text,                        -- group title
  quote_amount       numeric,
  follow_up_date     date,
  last_contact_at    timestamptz,
  raw_column_values  jsonb,
  monday_created_at  timestamptz,
  monday_updated_at  timestamptz,
  synced_at          timestamptz default now()
);
create index if not exists leads_contractor_id_idx on leads (contractor_id);
create index if not exists leads_current_status_idx on leads (current_status);
create index if not exists leads_campaign_tag_idx on leads (campaign_tag);
create index if not exists leads_follow_up_date_idx on leads (follow_up_date);

-- ── Lead status history ────────────────────────────────────────
create table if not exists lead_status_changes (
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid references leads(id) on delete cascade,
  from_status text,
  to_status   text,
  changed_at  timestamptz not null,
  synced_at   timestamptz default now()
);
create index if not exists lead_status_changes_lead_idx on lead_status_changes (lead_id, changed_at);

-- ── Lead updates / comments ────────────────────────────────────
create table if not exists lead_updates (
  id               uuid primary key default gen_random_uuid(),
  lead_id          uuid references leads(id) on delete cascade,
  monday_update_id text unique,
  body             text,
  creator_name     text,
  created_at       timestamptz,
  synced_at        timestamptz default now()
);
create index if not exists lead_updates_lead_idx on lead_updates (lead_id, created_at desc);

-- ── Client projects (closed deals) ────────────────────────────
create table if not exists projects (
  id                uuid primary key default gen_random_uuid(),
  monday_item_id    text unique not null,
  contractor_id     uuid references contractors(id),
  project_name      text,
  aanneemsom        numeric,
  betaal_status     text,
  commissie         numeric,
  commissie_status  text,
  contract_status   text,
  timeline_start    date,
  timeline_end      date,
  raw_column_values jsonb,
  monday_created_at timestamptz,
  monday_updated_at timestamptz,
  synced_at         timestamptz default now()
);
create index if not exists projects_contractor_id_idx on projects (contractor_id);

-- ── Meta Ads campaigns ────────────────────────────────────────
create table if not exists meta_campaigns (
  id                  uuid primary key default gen_random_uuid(),
  meta_campaign_id    text unique not null,
  name                text,
  monday_campaign_tag text,
  status              text,
  daily_budget        numeric,
  created_at          timestamptz default now()
);

-- ── Meta daily spend ─────────────────────────────────────────
create table if not exists meta_spend_daily (
  id           uuid primary key default gen_random_uuid(),
  campaign_id  uuid references meta_campaigns(id),
  date         date not null,
  spend        numeric,
  impressions  int,
  clicks       int,
  leads        int,
  unique (campaign_id, date)
);
create index if not exists meta_spend_daily_date_idx on meta_spend_daily (date desc);

-- ── Ad packs ─────────────────────────────────────────────────
create table if not exists ad_packs (
  id            uuid primary key default gen_random_uuid(),
  contractor_id uuid references contractors(id),
  pack_number   int,
  start_date    date,
  target_leads  int,
  ad_budget     numeric,
  paid_at       date,
  status        text,     -- 'pending_payment' | 'active' | 'completed' | 'overdue'
  created_at    timestamptz default now()
);

-- ── Contracts ─────────────────────────────────────────────────
create table if not exists contracts (
  id            uuid primary key default gen_random_uuid(),
  contractor_id uuid references contractors(id),
  contract_type text,
  generated_at  timestamptz default now(),
  signed_at     timestamptz,
  file_url      text,
  metadata      jsonb
);

-- ── Intake docs ───────────────────────────────────────────────
create table if not exists intake_docs (
  id            uuid primary key default gen_random_uuid(),
  contractor_id uuid references contractors(id) unique,
  data          jsonb not null,
  completed_at  timestamptz,
  updated_at    timestamptz default now()
);

-- ── Alerts ────────────────────────────────────────────────────
create table if not exists alerts (
  id            uuid primary key default gen_random_uuid(),
  type          text not null,
  severity      text not null,    -- 'critical' | 'warning' | 'info'
  contractor_id uuid references contractors(id),
  lead_id       uuid references leads(id),
  title         text not null,
  description   text,
  action_url    text,
  created_at    timestamptz default now(),
  dismissed_at  timestamptz
);
create index if not exists alerts_contractor_id_idx on alerts (contractor_id);
create index if not exists alerts_created_at_idx on alerts (created_at desc);

-- ── Sync run log ──────────────────────────────────────────────
create table if not exists sync_runs (
  id            uuid primary key default gen_random_uuid(),
  started_at    timestamptz default now(),
  finished_at   timestamptz,
  boards_synced int,
  items_synced  int,
  errors        jsonb,
  status        text    -- 'running' | 'success' | 'partial' | 'failed'
);

-- ── RLS (permissive for now — tighten in Phase 4 with auth) ──
alter table contractors        enable row level security;
alter table boards_config      enable row level security;
alter table leads              enable row level security;
alter table lead_status_changes enable row level security;
alter table lead_updates       enable row level security;
alter table projects           enable row level security;
alter table meta_campaigns     enable row level security;
alter table meta_spend_daily   enable row level security;
alter table ad_packs           enable row level security;
alter table contracts          enable row level security;
alter table intake_docs        enable row level security;
alter table alerts             enable row level security;
alter table sync_runs          enable row level security;

create policy "allow all" on contractors         for all using (true) with check (true);
create policy "allow all" on boards_config       for all using (true) with check (true);
create policy "allow all" on leads               for all using (true) with check (true);
create policy "allow all" on lead_status_changes for all using (true) with check (true);
create policy "allow all" on lead_updates        for all using (true) with check (true);
create policy "allow all" on projects            for all using (true) with check (true);
create policy "allow all" on meta_campaigns      for all using (true) with check (true);
create policy "allow all" on meta_spend_daily    for all using (true) with check (true);
create policy "allow all" on ad_packs            for all using (true) with check (true);
create policy "allow all" on contracts           for all using (true) with check (true);
create policy "allow all" on intake_docs         for all using (true) with check (true);
create policy "allow all" on alerts              for all using (true) with check (true);
create policy "allow all" on sync_runs           for all using (true) with check (true);
