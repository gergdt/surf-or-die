-- Body metrics and surf sessions. Apply via `supabase db push` or the SQL editor.
-- Composite PK (user_id, id) matches migration 0002 so seed/user ids do not collide.

create table if not exists public.body_metrics (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.surf_sessions (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists body_metrics_user_id_updated_at_idx
  on public.body_metrics (user_id, updated_at);
create index if not exists surf_sessions_user_id_updated_at_idx
  on public.surf_sessions (user_id, updated_at);

alter table public.body_metrics enable row level security;
alter table public.surf_sessions enable row level security;

create policy "Users manage own body metrics"
  on public.body_metrics for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage own surf sessions"
  on public.surf_sessions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
