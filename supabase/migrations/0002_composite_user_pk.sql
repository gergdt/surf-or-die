-- Apply via `supabase db push` or the SQL editor.
-- Destructive: recreates per-user tables with composite primary key (user_id, id)
-- so seed ids (e.g. fl_90_90_hip) do not collide across users. Acceptable because
-- the app is single-user today.

drop table if exists public.annotations cascade;
drop table if exists public.clips cascade;
drop table if exists public.sources cascade;
drop table if exists public.maneuvers cascade;
drop table if exists public.sessions cascade;
drop table if exists public.routines cascade;
drop table if exists public.exercises cascade;

create table public.exercises (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table public.routines (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table public.sessions (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table public.maneuvers (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table public.sources (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- Clip metadata only — video bytes live in Storage bucket `clips`.
create table public.clips (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null,
  data jsonb not null,
  storage_path text,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table public.annotations (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists exercises_user_id_updated_at_idx
  on public.exercises (user_id, updated_at);
create index if not exists routines_user_id_updated_at_idx
  on public.routines (user_id, updated_at);
create index if not exists sessions_user_id_updated_at_idx
  on public.sessions (user_id, updated_at);
create index if not exists maneuvers_user_id_updated_at_idx
  on public.maneuvers (user_id, updated_at);
create index if not exists sources_user_id_updated_at_idx
  on public.sources (user_id, updated_at);
create index if not exists clips_user_id_updated_at_idx
  on public.clips (user_id, updated_at);
create index if not exists annotations_user_id_updated_at_idx
  on public.annotations (user_id, updated_at);

alter table public.exercises enable row level security;
alter table public.routines enable row level security;
alter table public.sessions enable row level security;
alter table public.maneuvers enable row level security;
alter table public.sources enable row level security;
alter table public.clips enable row level security;
alter table public.annotations enable row level security;

create policy "Users manage own exercises"
  on public.exercises for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage own routines"
  on public.routines for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage own sessions"
  on public.sessions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage own maneuvers"
  on public.maneuvers for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage own sources"
  on public.sources for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage own clips"
  on public.clips for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage own annotations"
  on public.annotations for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
