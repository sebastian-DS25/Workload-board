-- Run once in Supabase: SQL Editor → New query → paste → Run

create table if not exists public.boards (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.boards enable row level security;

drop policy if exists "boards_select" on public.boards;
drop policy if exists "boards_insert" on public.boards;
drop policy if exists "boards_update" on public.boards;

create policy "boards_select" on public.boards
  for select using (true);

create policy "boards_insert" on public.boards
  for insert with check (true);

create policy "boards_update" on public.boards
  for update using (true);

insert into public.boards (id, data)
values ('aalborg', '{"title":"Inside Sales · Aalborg","assignments":{},"comments":{}}'::jsonb)
on conflict (id) do nothing;

-- Optional: enable Realtime for table "boards" in
-- Database → Replication → supabase_realtime → boards
