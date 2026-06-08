-- Surf or Die — per-user document store (JSONB) with RLS.
-- Run in the Supabase SQL editor or via `supabase db push`.

-- ---------------------------------------------------------------------------
-- Exercises, routines, sessions, maneuvers, sources (full JSON documents)
-- ---------------------------------------------------------------------------

create table if not exists public.exercises (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.routines (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.sessions (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.maneuvers (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.sources (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

-- Clip metadata only — video bytes live in Storage bucket `clips`.
create table if not exists public.clips (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  data jsonb not null,
  storage_path text,
  updated_at timestamptz not null default now()
);

create table if not exists public.annotations (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create index if not exists exercises_user_id_idx on public.exercises (user_id);
create index if not exists routines_user_id_idx on public.routines (user_id);
create index if not exists sessions_user_id_idx on public.sessions (user_id);
create index if not exists maneuvers_user_id_idx on public.maneuvers (user_id);
create index if not exists sources_user_id_idx on public.sources (user_id);
create index if not exists clips_user_id_idx on public.clips (user_id);
create index if not exists annotations_user_id_idx on public.annotations (user_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.exercises enable row level security;
alter table public.routines enable row level security;
alter table public.sessions enable row level security;
alter table public.maneuvers enable row level security;
alter table public.sources enable row level security;
alter table public.clips enable row level security;
alter table public.annotations enable row level security;
alter table public.user_settings enable row level security;

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

create policy "Users manage own settings"
  on public.user_settings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Storage bucket for clip videos (private per-user paths)
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('clips', 'clips', false)
on conflict (id) do nothing;

create policy "Users upload own clips"
  on storage.objects for insert
  with check (
    bucket_id = 'clips'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users read own clips"
  on storage.objects for select
  using (
    bucket_id = 'clips'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users update own clips"
  on storage.objects for update
  using (
    bucket_id = 'clips'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users delete own clips"
  on storage.objects for delete
  using (
    bucket_id = 'clips'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
