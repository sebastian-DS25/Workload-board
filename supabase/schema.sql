-- ============================================================
-- Workload Board — database schema
-- Inside Sales · Aalborg
--
-- Kør i Supabase: SQL Editor → New query → paste → Run.
-- Hele filen kan køres igen uden at ødelægge eksisterende data
-- (alt er "if not exists" / "or replace").
--
-- MARKERING TIL AZURE-FLYTNINGEN:
--   [PORTABEL]  = ren PostgreSQL, flytter med uden ændringer
--   [SUPABASE]  = Supabase-specifikt, skal skrives om i Azure
-- ============================================================


-- ------------------------------------------------------------
-- 1. TABELLER                                      [PORTABEL]
-- ------------------------------------------------------------

-- Cell-assignments (én række pr. person + kategori)
create table if not exists public.assignments (
  id         text        primary key,
  person     text        not null,
  category   text        not null,
  active     boolean     not null default false,
  updated_at timestamptz not null default now()
);


-- Boardets tilstand: titel, kommentarer, email-counts, OOO, coordinator
create table if not exists public.board_meta (
  id         text        primary key default 'default',
  title      text        not null default 'Inside Sales · Aalborg',
  comments   jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Kolonner tilføjet efter første version.
-- Koden i boardStorage.js læser og skriver alle disse.
alter table public.board_meta
  add column if not exists email_counts     jsonb    not null default '{}'::jsonb,
  add column if not exists ooo_status       jsonb    not null default '{}'::jsonb,
  add column if not exists workload_color   text     not null default '#ef4444',
  add column if not exists workload_level   smallint not null default 3,
  add column if not exists coordinator      text,
  add column if not exists coordinator_date text;

-- OBS: workload_color (hex) er den kolonne appen bruger i dag.
-- workload_level (1/2/3) er forberedt, men IKKE i brug endnu —
-- oversættelsen fra farve til niveau sker i JavaScript
-- (LEVEL_FROM_COLOR i boardStorage.js) ved skrivning til loggen.

insert into public.board_meta (id, title, comments)
values ('default', 'Inside Sales · Aalborg', '{}'::jsonb)
on conflict (id) do nothing;


-- ------------------------------------------------------------
-- 2. WORKLOAD-LOG                                  [PORTABEL]
-- ------------------------------------------------------------
-- Én række pr. arbejdsdag. Skrives af logWorkloadForDate() i
-- boardStorage.js i samme øjeblik boardet nulstilles om
-- morgenen — altså med GÅRSDAGENS værdier, før de ryddes.
--
--   level 1 = grøn, 2 = gul, 3 = rød
--   email_total  = summen af alle kategoriers email-counts
--   email_counts = de enkelte kategorier, gemt som JSON
--
-- Weekender logges aldrig (spærret både i loadBoard og i
-- logWorkloadForDate).

create table if not exists public.workload_log (
  id               bigint      generated always as identity primary key,
  log_date         date        not null default current_date,
  changed_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  level            smallint    not null check (level between 1 and 3),
  previous_level   smallint,
  duration_seconds integer,
  email_total      integer     not null default 0,
  email_counts     jsonb       not null default '{}'::jsonb,
  change_count     integer     not null default 1,
  changed_by       text
);

-- Én række pr. dag. Upserten i logWorkloadForDate bygger på
-- denne constraint (onConflict: "log_date").
create unique index if not exists workload_log_date_key
  on public.workload_log (log_date);

create index if not exists workload_log_changed_at_idx
  on public.workload_log (changed_at desc);

-- Ubrugte kolonner fra tidligere designforsøg, bevaret så
-- eksisterende rækker ikke skal migreres:
--   changed_at, previous_level, duration_seconds,
--   change_count, changed_by
-- Kan fjernes ved Azure-flytningen.


-- ------------------------------------------------------------
-- 3. RAPPORT-VIEW                                  [PORTABEL]
-- ------------------------------------------------------------
-- Månedsoversigt til ledelsen.
--   select * from public.workload_monthly;
--
-- Læs ALTID loggede_dage først: er den væsentligt lavere end
-- antallet af arbejdsdage i måneden, er grundlaget for tyndt
-- til at konkludere på.
--
-- snit_backlog_kl9 måler restbunken på det tidspunkt nogen
-- tæller — IKKE antal modtagne mails. Arbejdes der fra kl. 6,
-- er mails allerede ryddet og tælles ikke med. Brug den ikke
-- som volumen-tal uden Exchange-statistik ved siden af.

create or replace view public.workload_monthly as
select
  to_char(log_date, 'YYYY-MM')                                  as maaned,
  count(*)                                                      as loggede_dage,
  round(avg(level)::numeric, 2)                                 as snit_niveau,
  count(*) filter (where level = 1)                             as groenne_dage,
  count(*) filter (where level = 2)                             as gule_dage,
  count(*) filter (where level = 3)                             as roede_dage,
  round(100.0 * count(*) filter (where level = 3) / count(*), 0) as pct_roede,
  round(avg(email_total)::numeric, 0)                           as snit_backlog_kl9
from public.workload_log
group by 1
order by 1 desc;


-- ============================================================
-- 4. ROW LEVEL SECURITY                            [SUPABASE]
-- ============================================================
-- ALT HERUNDER SKAL SKRIVES OM VED FLYTNING TIL AZURE.
--
-- RLS findes i ren PostgreSQL, men auth.role() gør ikke — det
-- er Supabase Auth. I Azure håndteres adgang i stedet via
-- Entra ID og et API-lag foran databasen.
--
-- ADVARSEL om de nuværende policies på assignments og
-- board_meta: de bruger "using (true)", altså helt åben læse-
-- og skriveadgang for alle med anon-nøglen — også udenom
-- login-skærmen i AuthGate.jsx. Det bør strammes op, og skal
-- under alle omstændigheder løses ved Azure-flytningen.
-- ------------------------------------------------------------

alter table public.assignments  enable row level security;
alter table public.board_meta   enable row level security;
alter table public.workload_log enable row level security;

-- --- assignments (åbne — se advarsel ovenfor) ---------------
drop policy if exists "assignments_select" on public.assignments;
drop policy if exists "assignments_insert" on public.assignments;
drop policy if exists "assignments_update" on public.assignments;

create policy "assignments_select" on public.assignments for select using (true);
create policy "assignments_insert" on public.assignments for insert with check (true);
create policy "assignments_update" on public.assignments for update using (true);

-- --- board_meta (åbne — se advarsel ovenfor) ----------------
drop policy if exists "board_meta_select" on public.board_meta;
drop policy if exists "board_meta_insert" on public.board_meta;
drop policy if exists "board_meta_update" on public.board_meta;

create policy "board_meta_select" on public.board_meta for select using (true);
create policy "board_meta_insert" on public.board_meta for insert with check (true);
create policy "board_meta_update" on public.board_meta for update using (true);

-- --- workload_log (kræver login) ----------------------------
-- Strammere end de to ovenfor: kun indloggede brugere.
-- update er nødvendig, fordi logningen er en upsert på log_date.
-- Der er bevidst INGEN delete-policy — historik må ikke slettes
-- fra appen.
drop policy if exists "workload_log_select" on public.workload_log;
drop policy if exists "workload_log_insert" on public.workload_log;
drop policy if exists "workload_log_update" on public.workload_log;

create policy "workload_log_select" on public.workload_log
  for select using (auth.role() = 'authenticated');
create policy "workload_log_insert" on public.workload_log
  for insert with check (auth.role() = 'authenticated');
create policy "workload_log_update" on public.workload_log
  for update using (auth.role() = 'authenticated');


-- ============================================================
-- 5. BACKUP                                         [SUPABASE]
-- ============================================================
-- Gratis Supabase-plan har ingen automatiske backups.
-- workload_log er historik der IKKE kan genskabes.
--
-- Månedlig rutine — Table Editor → workload_log → Export to CSV,
-- eller kopiér output af:
--
--   select json_agg(t) from public.workload_log t;
--   select json_agg(t) from public.board_meta t;
--
-- Eksportér ALTID workload_log før Azure-migreringen.
-- ============================================================
