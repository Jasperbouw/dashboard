-- Run this in the Supabase SQL Editor (supabase.com → project → SQL Editor)

create table if not exists kv_store (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

-- Enable realtime so changes sync instantly between Jasper and Philip
alter publication supabase_realtime add table kv_store;

-- Allow public read/write (dashboard has no login — rely on anon key)
alter table kv_store enable row level security;

create policy "allow all" on kv_store
  for all using (true) with check (true);
