-- Thumbnail generation history.
-- Apply on the Supabase project used for Vidso auth (ymtmgpgcmrazqeklixwf)
-- once a service role or RLS policy is wired. Until then, Vercel persists
-- each generation as an image plus a JSON sidecar in Railway /api/upload
-- (the existing per-user object store). Sidecar names: vidso-img-{id}.meta.json
-- Storage path scheme for the image file:
--   Thumbnail-{prompt-slug}-{id8}.jpg
-- Reference images used in a run are also uploaded there and listed on the record.

create table if not exists public.image_generations (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  prompt text not null,
  model text not null,
  aspect_ratio text not null default '16:9',
  quality text not null default '1K',
  batch_index integer not null default 0,
  storage_url text not null,
  file_id text,
  meta_file_id text,
  width integer,
  height integer,
  favorited boolean not null default false,
  reference_images jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists image_generations_user_created_idx
  on public.image_generations (user_id, created_at desc);

create index if not exists image_generations_user_fav_idx
  on public.image_generations (user_id, favorited)
  where favorited = true;

alter table public.image_generations enable row level security;

drop policy if exists image_generations_own_select on public.image_generations;
create policy image_generations_own_select
  on public.image_generations for select
  using (user_id = coalesce(auth.uid()::text, auth.jwt() ->> 'sub', auth.jwt() ->> 'email'));

drop policy if exists image_generations_own_write on public.image_generations;
create policy image_generations_own_write
  on public.image_generations for all
  using (user_id = coalesce(auth.uid()::text, auth.jwt() ->> 'sub', auth.jwt() ->> 'email'))
  with check (user_id = coalesce(auth.uid()::text, auth.jwt() ->> 'sub', auth.jwt() ->> 'email'));
