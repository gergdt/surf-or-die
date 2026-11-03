-- Apply via `supabase db push` or the SQL editor.
-- Switches per-user tables to a composite primary key (user_id, id) so seed ids
-- (e.g. fl_90_90_hip) do not collide across users. Alters keys in place so
-- existing cloud data is preserved.

alter table public.exercises drop constraint exercises_pkey, add primary key (user_id, id);
alter table public.routines drop constraint routines_pkey, add primary key (user_id, id);
alter table public.sessions drop constraint sessions_pkey, add primary key (user_id, id);
alter table public.maneuvers drop constraint maneuvers_pkey, add primary key (user_id, id);
alter table public.sources drop constraint sources_pkey, add primary key (user_id, id);
alter table public.clips drop constraint clips_pkey, add primary key (user_id, id);
alter table public.annotations drop constraint annotations_pkey, add primary key (user_id, id);

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
