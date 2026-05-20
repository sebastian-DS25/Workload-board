-- Run once in Supabase: SQL Editor → New query → paste → Run

-- Cell assignments (one row per person + category)
create table if not exists public.assignments (
  id text primary key,
  person text not null,
  category text not null,
  active boolean not null default false,
  updated_at timestamptz not null default now()
);

-- Board title and per-person comments (UI unchanged)
create table if not exists public.board_meta (
  id text primary key default 'default',
  title text not null default 'Inside Sales · Aalborg',
  comments jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.board_meta (id, title, comments)
values ('default', 'Inside Sales · Aalborg', '{}'::jsonb)
on conflict (id) do nothing;

alter table public.assignments enable row level security;
alter table public.board_meta enable row level security;

drop policy if exists "assignments_select" on public.assignments;
drop policy if exists "assignments_insert" on public.assignments;
drop policy if exists "assignments_update" on public.assignments;

create policy "assignments_select" on public.assignments for select using (true);
create policy "assignments_insert" on public.assignments for insert with check (true);
create policy "assignments_update" on public.assignments for update using (true);

drop policy if exists "board_meta_select" on public.board_meta;
drop policy if exists "board_meta_insert" on public.board_meta;
drop policy if exists "board_meta_update" on public.board_meta;

create policy "board_meta_select" on public.board_meta for select using (true);
create policy "board_meta_insert" on public.board_meta for insert with check (true);
create policy "board_meta_update" on public.board_meta for update using (true);

-- REQUIRED for instant sync: Database → Replication → supabase_realtime
-- Enable replication for tables: assignments, board_meta
