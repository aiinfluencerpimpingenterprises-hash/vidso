-- TubeOps server storage in Supabase: credits used, Whop grants and
-- revocations, checkout intents and server video runs.
--
-- Run once in Supabase → SQL Editor → New query → paste all → Run.
-- Safe to run again: it only creates what is missing and replaces the function.
--
-- lib/kv.js calls public.tubeops_kv(cmd, args) through the REST API with the
-- service role key. The function speaks the small set of Redis commands the
-- app uses (GET, SET, DEL, EXPIRE, HGETALL, HINCRBY, HSETNX, SADD, SMEMBERS),
-- and each call runs as one transaction, so two servers adding credits at the
-- same moment both count.

create table if not exists public.tubeops_kv (
  key        text primary key,
  kind       text not null default 'string' check (kind in ('string', 'hash', 'set')),
  str        text,
  hash       jsonb,
  members    jsonb,
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists tubeops_kv_expires_at on public.tubeops_kv (expires_at)
  where expires_at is not null;

-- Server-only: no browser key can read or write it. The service role bypasses RLS.
alter table public.tubeops_kv enable row level security;
revoke all on public.tubeops_kv from anon, authenticated;

create or replace function public.tubeops_kv(cmd text, args jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  k        text := args->>0;
  op       text := upper(cmd);
  r        public.tubeops_kv%rowtype;
  v        text;
  f        text;
  prior    text;
  n        bigint;
  cnt      int := 0;
  i        int;
  nx       boolean := false;
  want_get boolean := false;
  ttl      int;
  added    jsonb;
begin
  if k is null then
    raise exception 'tubeops_kv: missing key';
  end if;

  -- Expired keys behave as missing; sweep a few now and then.
  delete from public.tubeops_kv where key = k and expires_at is not null and expires_at <= now();
  if random() < 0.02 then
    delete from public.tubeops_kv
    where key in (
      select key from public.tubeops_kv
      where expires_at is not null and expires_at <= now()
      limit 200
    );
  end if;

  if op = 'GET' then
    select * into r from public.tubeops_kv where key = k;
    if not found or r.kind <> 'string' then
      return 'null'::jsonb;
    end if;
    return to_jsonb(r.str);

  elsif op = 'SET' then
    v := args->>1;
    i := 2;
    while i < jsonb_array_length(args) loop
      f := upper(args->>i);
      if f = 'NX' then nx := true;
      elsif f = 'GET' then want_get := true;
      elsif f = 'EX' then
        i := i + 1;
        ttl := (args->>i)::int;
      end if;
      i := i + 1;
    end loop;

    if nx then
      insert into public.tubeops_kv (key, kind, str, expires_at, updated_at)
      values (k, 'string', v, case when ttl is not null then now() + make_interval(secs => ttl) end, now())
      on conflict (key) do nothing;
      get diagnostics cnt = row_count;
      if cnt = 1 then
        return case when want_get then 'null'::jsonb else to_jsonb('OK'::text) end;
      end if;
      select str into prior from public.tubeops_kv where key = k;
      return case when want_get then to_jsonb(prior) else 'null'::jsonb end;
    end if;

    select str into prior from public.tubeops_kv where key = k for update;
    insert into public.tubeops_kv (key, kind, str, hash, members, expires_at, updated_at)
    values (k, 'string', v, null, null, case when ttl is not null then now() + make_interval(secs => ttl) end, now())
    on conflict (key) do update
      set kind = 'string', str = excluded.str, hash = null, members = null,
          expires_at = excluded.expires_at, updated_at = now();
    return case when want_get then coalesce(to_jsonb(prior), 'null'::jsonb) else to_jsonb('OK'::text) end;

  elsif op = 'DEL' then
    delete from public.tubeops_kv where key = k;
    get diagnostics cnt = row_count;
    return to_jsonb(cnt);

  elsif op = 'EXPIRE' then
    update public.tubeops_kv
      set expires_at = now() + make_interval(secs => (args->>1)::int), updated_at = now()
      where key = k;
    get diagnostics cnt = row_count;
    return to_jsonb(cnt);

  elsif op = 'HGETALL' then
    select * into r from public.tubeops_kv where key = k;
    if not found or r.kind <> 'hash' or r.hash is null then
      return '[]'::jsonb;
    end if;
    -- Flat [field, value, field, value, ...] like Redis.
    return coalesce(
      (select jsonb_agg(p.x order by e.key, p.o)
         from jsonb_each_text(r.hash) e,
              lateral (values (e.key, 1), (e.value, 2)) as p(x, o)),
      '[]'::jsonb
    );

  elsif op = 'HINCRBY' then
    f := args->>1;
    n := (args->>2)::bigint;
    insert into public.tubeops_kv (key, kind, hash, updated_at)
    values (k, 'hash', jsonb_build_object(f, n::text), now())
    on conflict (key) do update
      set hash = coalesce(public.tubeops_kv.hash, '{}'::jsonb)
                 || jsonb_build_object(f, (coalesce((public.tubeops_kv.hash->>f)::bigint, 0) + n)::text),
          kind = 'hash',
          updated_at = now()
    returning (hash->>f)::bigint into n;
    return to_jsonb(n);

  elsif op = 'HSETNX' then
    f := args->>1;
    v := args->>2;
    select * into r from public.tubeops_kv where key = k for update;
    if found and r.hash ? f then
      return to_jsonb(0);
    end if;
    insert into public.tubeops_kv (key, kind, hash, updated_at)
    values (k, 'hash', jsonb_build_object(f, v), now())
    on conflict (key) do update
      set hash = case
                   when public.tubeops_kv.hash ? f then public.tubeops_kv.hash
                   else coalesce(public.tubeops_kv.hash, '{}'::jsonb) || jsonb_build_object(f, v)
                 end,
          kind = 'hash',
          updated_at = now();
    return to_jsonb(1);

  elsif op = 'SADD' then
    added := coalesce((select jsonb_agg(distinct x) from jsonb_array_elements_text(args - 0) x), '[]'::jsonb);
    select * into r from public.tubeops_kv where key = k for update;
    cnt := (
      select count(*) from jsonb_array_elements_text(added) x
      where not coalesce(r.members, '[]'::jsonb) ? x
    );
    insert into public.tubeops_kv (key, kind, members, updated_at)
    values (k, 'set', added, now())
    on conflict (key) do update
      set members = (
            select coalesce(jsonb_agg(distinct x), '[]'::jsonb) from (
              select jsonb_array_elements_text(coalesce(public.tubeops_kv.members, '[]'::jsonb)) x
              union
              select jsonb_array_elements_text(excluded.members)
            ) u
          ),
          kind = 'set',
          updated_at = now();
    return to_jsonb(cnt);

  elsif op = 'SMEMBERS' then
    select * into r from public.tubeops_kv where key = k;
    if not found or r.kind <> 'set' then
      return '[]'::jsonb;
    end if;
    return coalesce(r.members, '[]'::jsonb);
  end if;

  raise exception 'tubeops_kv: unsupported command %', cmd;
end;
$$;

revoke all on function public.tubeops_kv(text, jsonb) from public, anon, authenticated;
grant execute on function public.tubeops_kv(text, jsonb) to service_role;
grant select, insert, update, delete on public.tubeops_kv to service_role;
