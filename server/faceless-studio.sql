-- Faceless Studio: projects, assets, jobs.
-- Apply on the Supabase project used for Vidso auth once a service role
-- or RLS policy is wired. Until then, Vercel persists each project as a
-- JSON sidecar in Railway /api/upload (the existing per-user object store).
-- Sidecar names: vidso-fs-proj-{id}.json
-- Binary assets: vidso-fs-file-{id8}-{type}.{ext}

create table if not exists public.faceless_projects (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  title text not null default 'Untitled project',
  topic text not null default '',
  status text not null default 'draft',
  aspect text not null default '16:9',
  length text not null default 'long_180',
  duration_seconds integer not null default 180,
  voice_id text,
  model text not null default 'vidso-faceless',
  favorited boolean not null default false,
  pipeline jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists faceless_projects_user_updated_idx
  on public.faceless_projects (user_id, updated_at desc);

create table if not exists public.faceless_assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.faceless_projects(id) on delete cascade,
  user_id text not null,
  type text not null,
  storage_url text not null default '',
  file_id text,
  mime text,
  label text,
  created_at timestamptz not null default now()
);

create index if not exists faceless_assets_project_idx
  on public.faceless_assets (project_id, created_at desc);

create table if not exists public.faceless_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.faceless_projects(id) on delete cascade,
  user_id text not null,
  type text not null,
  status text not null default 'queued',
  progress integer not null default 0,
  error text not null default '',
  remote_id text,
  favorited boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists faceless_jobs_user_updated_idx
  on public.faceless_jobs (user_id, updated_at desc);

alter table public.faceless_projects enable row level security;
alter table public.faceless_assets enable row level security;
alter table public.faceless_jobs enable row level security;

drop policy if exists faceless_projects_own on public.faceless_projects;
create policy faceless_projects_own on public.faceless_projects for all
  using (user_id = coalesce(auth.uid()::text, auth.jwt() ->> 'sub', auth.jwt() ->> 'email'))
  with check (user_id = coalesce(auth.uid()::text, auth.jwt() ->> 'sub', auth.jwt() ->> 'email'));

drop policy if exists faceless_assets_own on public.faceless_assets;
create policy faceless_assets_own on public.faceless_assets for all
  using (user_id = coalesce(auth.uid()::text, auth.jwt() ->> 'sub', auth.jwt() ->> 'email'))
  with check (user_id = coalesce(auth.uid()::text, auth.jwt() ->> 'sub', auth.jwt() ->> 'email'));

drop policy if exists faceless_jobs_own on public.faceless_jobs;
create policy faceless_jobs_own on public.faceless_jobs for all
  using (user_id = coalesce(auth.uid()::text, auth.jwt() ->> 'sub', auth.jwt() ->> 'email'))
  with check (user_id = coalesce(auth.uid()::text, auth.jwt() ->> 'sub', auth.jwt() ->> 'email'));
