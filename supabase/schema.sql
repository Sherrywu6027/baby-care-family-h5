create extension if not exists pgcrypto;

create table if not exists families (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  creator_user uuid,
  created_at timestamptz default now()
);

alter table families add column if not exists creator_user uuid;

update families f
set creator_user = m.auth_user
from (
  select distinct on (family_id) family_id, auth_user
  from members
  where auth_user is not null
  order by family_id, created_at asc
) m
where f.id = m.family_id
  and f.creator_user is null;

create table if not exists members (
  id uuid primary key default gen_random_uuid(),
  family_id uuid references families(id) on delete cascade not null,
  auth_user uuid,
  role text default 'parent',
  display_name text,
  created_at timestamptz default now(),
  unique (family_id, auth_user)
);

create table if not exists join_requests (
  id uuid primary key default gen_random_uuid(),
  family_id uuid references families(id) on delete cascade not null,
  family_code text not null,
  requester_user uuid not null,
  requester_email text,
  role text default 'parent',
  display_name text,
  status text default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table join_requests add column if not exists requester_email text;

create unique index if not exists idx_join_requests_family_requester_unique
on join_requests(family_id, requester_user);

create table if not exists babies (
  id uuid primary key default gen_random_uuid(),
  family_id uuid references families(id) on delete cascade not null,
  name text,
  birthday date,
  avatar text,
  sort int default 0,
  client_id text,
  deleted_at timestamptz,
  sync_status text default 'cloud',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  family_id uuid references families(id) on delete cascade not null,
  baby_id uuid references babies(id) on delete cascade,
  type text not null,
  start_time timestamptz not null,
  end_time timestamptz,
  amount_ml int,
  duration_sec int,
  duration_min numeric,
  left_sec int,
  right_sec int,
  left_min numeric,
  right_min numeric,
  stool boolean default false,
  stool_amount int,
  height_cm numeric(5,1),
  weight_kg numeric(5,2),
  note text,
  extra_note text,
  recorded_by_user uuid,
  recorded_by_name text,
  client_id text,
  deleted_at timestamptz,
  sync_status text default 'cloud',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table events add column if not exists recorded_by_user uuid;
alter table events add column if not exists recorded_by_name text;

create index if not exists idx_families_code on families(code);
create index if not exists idx_members_auth_user on members(auth_user);
create index if not exists idx_join_requests_family_status on join_requests(family_id, status, created_at desc);
create index if not exists idx_join_requests_requester on join_requests(requester_user, created_at desc);
create index if not exists idx_babies_family on babies(family_id);
create index if not exists idx_babies_updated on babies(updated_at);
create index if not exists idx_babies_family_updated on babies(family_id, updated_at);
create index if not exists idx_events_family on events(family_id);
create index if not exists idx_events_baby on events(baby_id);
create index if not exists idx_events_start on events(start_time);
create index if not exists idx_events_updated on events(updated_at);
create index if not exists idx_events_family_updated on events(family_id, updated_at);

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_babies_updated_at on babies;
create trigger trg_babies_updated_at
before update on babies
for each row execute function set_updated_at();

drop trigger if exists trg_events_updated_at on events;
create trigger trg_events_updated_at
before update on events
for each row execute function set_updated_at();

drop trigger if exists trg_join_requests_updated_at on join_requests;
create trigger trg_join_requests_updated_at
before update on join_requests
for each row execute function set_updated_at();

create or replace function current_family()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select family_id from public.members where auth_user = auth.uid() limit 1
$$;

create or replace function generate_family_code()
returns text language plpgsql as $$
declare
  candidate text;
begin
  loop
    candidate := lpad((floor(random() * 1000000))::int::text, 6, '0');
    exit when not exists (select 1 from families where code = candidate);
  end loop;
  return candidate;
end;
$$;

create or replace function create_family(p_role text default 'parent', p_display_name text default null)
returns table (family_id uuid, family_code text)
language plpgsql
security definer
as $$
declare
  v_family_id uuid;
  v_code text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  v_code := generate_family_code();

  insert into families(code, creator_user)
  values (v_code, auth.uid())
  returning id into v_family_id;

  insert into members(family_id, auth_user, role, display_name)
  values (v_family_id, auth.uid(), coalesce(nullif(p_role, ''), 'parent'), nullif(p_display_name, ''));

  return query select v_family_id, v_code;
end;
$$;

create or replace function join_family(p_code text, p_role text default 'parent', p_display_name text default null)
returns table (family_id uuid, family_code text)
language plpgsql
security definer
as $$
begin
  raise exception 'approval_required';
end;
$$;

drop function if exists request_join_family(text, text, text);
create function request_join_family(p_code text, p_role text default 'parent', p_display_name text default null)
returns table (
  result_request_id uuid,
  result_family_id uuid,
  result_family_code text,
  result_request_status text
)
language plpgsql
security definer
as $$
declare
  v_family_id uuid;
  v_request_id uuid;
  v_status text;
  v_requester_email text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  v_requester_email := nullif(
    coalesce(
      auth.jwt() ->> 'email',
      current_setting('request.jwt.claim.email', true),
      ''
    ),
    ''
  );

  select f.id into v_family_id
  from families f
  where f.code = p_code
  limit 1;
  if v_family_id is null then
    raise exception 'family_not_found';
  end if;

  if exists (
    select 1 from members
    where members.family_id = v_family_id
      and members.auth_user = auth.uid()
  ) then
    return query
    select null::uuid, v_family_id, p_code, 'already_member'::text;
    return;
  end if;

  insert into join_requests(
    family_id,
    family_code,
    requester_user,
    requester_email,
    role,
    display_name,
    status
  )
  values (
    v_family_id,
    p_code,
    auth.uid(),
    v_requester_email,
    coalesce(nullif(p_role, ''), 'parent'),
    nullif(p_display_name, ''),
    'pending'
  )
  on conflict (family_id, requester_user)
  do update set
    family_code = excluded.family_code,
    requester_email = excluded.requester_email,
    role = excluded.role,
    display_name = excluded.display_name,
    status = 'pending',
    reviewed_by = null,
    reviewed_at = null,
    updated_at = now()
  returning id, status into v_request_id, v_status;

  return query
  select v_request_id, v_family_id, p_code, v_status;
end;
$$;

drop function if exists review_join_request(uuid, text);
create function review_join_request(p_request_id uuid, p_action text)
returns table (
  result_request_id uuid,
  result_family_id uuid,
  result_family_code text,
  result_request_status text,
  result_member_id uuid
)
language plpgsql
security definer
as $$
declare
  v_request join_requests%rowtype;
  v_member_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select * into v_request
  from join_requests jr
  where jr.id = p_request_id
  limit 1;

  if v_request.id is null then
    raise exception 'join_request_not_found';
  end if;

  if not exists (
    select 1 from families
    where families.id = v_request.family_id
      and families.creator_user = auth.uid()
  ) then
    raise exception 'not_family_creator';
  end if;

  if coalesce(v_request.status, '') <> 'pending' then
    return query
    select v_request.id, v_request.family_id, v_request.family_code, v_request.status, null::uuid;
    return;
  end if;

  if p_action = 'approve' then
    insert into members(family_id, auth_user, role, display_name)
    values (
      v_request.family_id,
      v_request.requester_user,
      coalesce(nullif(v_request.role, ''), 'parent'),
      nullif(v_request.display_name, '')
    )
    on conflict (family_id, auth_user)
    do update set
      role = excluded.role,
      display_name = excluded.display_name
    returning id into v_member_id;

    update join_requests
    set status = 'approved',
        reviewed_by = auth.uid(),
        reviewed_at = now()
    where id = v_request.id;

    return query
    select v_request.id, v_request.family_id, v_request.family_code, 'approved'::text, v_member_id;
    return;
  end if;

  if p_action = 'reject' then
    update join_requests
    set status = 'rejected',
        reviewed_by = auth.uid(),
        reviewed_at = now()
    where id = v_request.id;

    return query
    select v_request.id, v_request.family_id, v_request.family_code, 'rejected'::text, null::uuid;
    return;
  end if;

  raise exception 'invalid_review_action';
end;
$$;

drop function if exists list_family_members();
create function list_family_members()
returns table (
  result_member_id uuid,
  result_family_id uuid,
  result_auth_user uuid,
  result_role text,
  result_display_name text,
  result_is_creator boolean,
  result_created_at timestamptz
)
language plpgsql
security definer
as $$
declare
  v_family_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select public.current_family() into v_family_id;
  if v_family_id is null then
    raise exception 'family_not_found';
  end if;

  return query
  select
    m.id,
    m.family_id,
    m.auth_user,
    m.role,
    m.display_name,
    (f.creator_user = m.auth_user) as is_creator,
    m.created_at
  from members m
  join families f on f.id = m.family_id
  where m.family_id = v_family_id
  order by
    (f.creator_user = m.auth_user) desc,
    m.created_at asc;
end;
$$;

drop function if exists remove_family_member(uuid);
create function remove_family_member(p_member_id uuid)
returns table (
  result_member_id uuid,
  result_family_id uuid,
  result_removed boolean
)
language plpgsql
security definer
as $$
declare
  v_member members%rowtype;
  v_creator_user uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select m.* into v_member
  from members m
  where m.id = p_member_id
  limit 1;

  if v_member.id is null then
    raise exception 'member_not_found';
  end if;

  select f.creator_user into v_creator_user
  from families f
  where f.id = v_member.family_id
  limit 1;

  if v_creator_user is null then
    raise exception 'family_not_found';
  end if;

  if v_creator_user <> auth.uid() then
    raise exception 'not_family_creator';
  end if;

  if v_member.auth_user = v_creator_user then
    raise exception 'cannot_remove_family_creator';
  end if;

  delete from members m
  where m.id = v_member.id;

  return query
  select v_member.id, v_member.family_id, true;
end;
$$;

drop function if exists update_family_member(uuid, text, text);
create function update_family_member(
  p_member_id uuid,
  p_role text default null,
  p_display_name text default null
)
returns table (
  result_member_id uuid,
  result_family_id uuid,
  result_role text,
  result_display_name text
)
language plpgsql
security definer
as $$
declare
  v_member members%rowtype;
  v_creator_user uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select m.* into v_member
  from members m
  where m.id = p_member_id
  limit 1;

  if v_member.id is null then
    raise exception 'member_not_found';
  end if;

  select f.creator_user into v_creator_user
  from families f
  where f.id = v_member.family_id
  limit 1;

  if v_creator_user is null then
    raise exception 'family_not_found';
  end if;

  if v_member.auth_user <> auth.uid() and v_creator_user <> auth.uid() then
    raise exception 'not_allowed_to_update_member';
  end if;

  update members m
  set
    role = coalesce(nullif(p_role, ''), m.role),
    display_name = coalesce(nullif(p_display_name, ''), nullif(p_role, ''), m.display_name)
  where m.id = v_member.id
  returning m.id, m.family_id, m.role, m.display_name
  into v_member.id, v_member.family_id, v_member.role, v_member.display_name;

  return query
  select v_member.id, v_member.family_id, v_member.role, v_member.display_name;
end;
$$;

drop function if exists transfer_family_creator(uuid);
create function transfer_family_creator(p_member_id uuid)
returns table (
  result_family_id uuid,
  result_member_id uuid,
  result_creator_user uuid
)
language plpgsql
security definer
as $$
declare
  v_member members%rowtype;
  v_creator_user uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select m.* into v_member
  from members m
  where m.id = p_member_id
  limit 1;

  if v_member.id is null then
    raise exception 'member_not_found';
  end if;

  select f.creator_user into v_creator_user
  from families f
  where f.id = v_member.family_id
  limit 1;

  if v_creator_user is null then
    raise exception 'family_not_found';
  end if;

  if v_creator_user <> auth.uid() then
    raise exception 'not_family_creator';
  end if;

  if v_member.auth_user is null then
    raise exception 'target_member_has_no_user';
  end if;

  update families f
  set creator_user = v_member.auth_user
  where f.id = v_member.family_id;

  return query
  select v_member.family_id, v_member.id, v_member.auth_user;
end;
$$;

drop function if exists leave_family();
create function leave_family()
returns table (
  result_family_id uuid,
  result_left boolean
)
language plpgsql
security definer
as $$
declare
  v_member members%rowtype;
  v_creator_user uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select m.* into v_member
  from members m
  where m.auth_user = auth.uid()
    and m.family_id = public.current_family()
  limit 1;

  if v_member.id is null then
    raise exception 'member_not_found';
  end if;

  select f.creator_user into v_creator_user
  from families f
  where f.id = v_member.family_id
  limit 1;

  if v_creator_user = auth.uid() then
    raise exception 'family_creator_must_transfer_first';
  end if;

  delete from members m
  where m.id = v_member.id;

  return query
  select v_member.family_id, true;
end;
$$;

drop function if exists get_my_membership();
create function get_my_membership()
returns table (
  result_family_id uuid,
  result_family_code text,
  result_member_id uuid,
  result_auth_user uuid,
  result_role text,
  result_display_name text,
  result_is_creator boolean
)
language plpgsql
security definer
as $$
begin
  if auth.uid() is null then
    return;
  end if;

  return query
  select
    f.id,
    f.code,
    m.id,
    m.auth_user,
    m.role,
    m.display_name,
    (f.creator_user = m.auth_user) as is_creator
  from members m
  join families f on f.id = m.family_id
  where m.auth_user = auth.uid()
  order by
    (f.creator_user = m.auth_user) desc,
    m.created_at asc
  limit 1;
end;
$$;

alter table families enable row level security;
alter table members enable row level security;
alter table join_requests enable row level security;
alter table babies enable row level security;
alter table events enable row level security;

drop policy if exists "family read" on families;
drop policy if exists "family insert" on families;
drop policy if exists "member read" on members;
drop policy if exists "member insert" on members;
drop policy if exists "member update" on members;
drop policy if exists "join request requester read" on join_requests;
drop policy if exists "join request creator read" on join_requests;
drop policy if exists "baby read" on babies;
drop policy if exists "baby insert" on babies;
drop policy if exists "baby update" on babies;
drop policy if exists "baby delete" on babies;
drop policy if exists "event read" on events;
drop policy if exists "event insert" on events;
drop policy if exists "event update" on events;
drop policy if exists "event delete" on events;

create policy "family read" on families
for select using (id = current_family());

create policy "family insert" on families
for insert with check (auth.uid() is not null);

create policy "member read" on members
for select using (family_id = current_family());

create policy "member insert" on members
for insert with check (auth.uid() is not null);

create policy "member update" on members
for update using (family_id = current_family());

create policy "join request requester read" on join_requests
for select using (requester_user = auth.uid());

create policy "join request creator read" on join_requests
for select using (
  exists (
    select 1 from families
    where families.id = join_requests.family_id
      and families.creator_user = auth.uid()
  )
);

create policy "baby read" on babies
for select using (family_id = current_family());

create policy "baby insert" on babies
for insert with check (family_id = current_family());

create policy "baby update" on babies
for update using (family_id = current_family()) with check (family_id = current_family());

create policy "baby delete" on babies
for delete using (family_id = current_family());

create policy "event read" on events
for select using (family_id = current_family());

create policy "event insert" on events
for insert with check (family_id = current_family());

create policy "event update" on events
for update using (family_id = current_family()) with check (family_id = current_family());

create policy "event delete" on events
for delete using (family_id = current_family());

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on families to anon, authenticated;
grant select, insert, update, delete on members to anon, authenticated;
grant select on join_requests to anon, authenticated;
grant select, insert, update, delete on babies to anon, authenticated;
grant select, insert, update, delete on events to anon, authenticated;
grant execute on function current_family() to anon, authenticated;
grant execute on function generate_family_code() to anon, authenticated;
grant execute on function create_family(text, text) to anon, authenticated;
grant execute on function join_family(text, text, text) to anon, authenticated;
grant execute on function request_join_family(text, text, text) to anon, authenticated;
grant execute on function review_join_request(uuid, text) to anon, authenticated;
grant execute on function list_family_members() to anon, authenticated;
grant execute on function remove_family_member(uuid) to anon, authenticated;
grant execute on function update_family_member(uuid, text, text) to anon, authenticated;
grant execute on function transfer_family_creator(uuid) to anon, authenticated;
grant execute on function leave_family() to anon, authenticated;
grant execute on function get_my_membership() to anon, authenticated;
