-- account_label_mapping: maps Monday "Accounts" label text → contractor_id
-- Used by the projects sync to resolve contractor from the board_relation text value.
create table if not exists account_label_mapping (
  id            uuid primary key default gen_random_uuid(),
  label         text unique not null,
  contractor_id uuid references contractors(id),
  created_at    timestamptz default now()
);

create index if not exists account_label_mapping_label_idx on account_label_mapping (label);

-- Archived contractor for phased-out clients
insert into contractors (name, niche, active)
values ('AM Topdaken (archived)', null, false)
on conflict (name) do nothing;

-- Seed label → contractor mappings
-- contractor UUIDs are resolved at runtime in the seed script
-- This migration just creates the table structure; seeding is done via scripts/seed-label-map.ts
