create extension if not exists "pgcrypto";

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  reputation int not null default 0
);

create table rooms (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  seller_name text not null,
  status text not null check (status in ('lobby','live','ended')) default 'lobby',
  created_at timestamptz not null default now()
);

create table items (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  title text not null,
  img_url text not null,
  start_price int not null check (start_price > 0),
  current_price int not null check (current_price > 0),
  ends_at timestamptz not null,
  winner uuid references profiles(id),
  extensions_used int not null default 0 check (extensions_used >= 0),
  status text not null default 'lobby'
    check (status in ('lobby','live','ending','extended','closed')),
  created_at timestamptz not null default now()
);

create table bids (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references items(id) on delete cascade,
  bidder uuid not null references profiles(id) on delete cascade,
  amount int not null check (amount > 0),
  created_at timestamptz not null default now()
);
create index bids_item_time_idx on bids (item_id, created_at desc);
create index items_room_status_idx on items (room_id, status);

create table orders (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null unique references items(id) on delete cascade,
  winner uuid not null references profiles(id),
  status text not null default 'pending'
    check (status in ('pending','paid','expired','cancelled')),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

alter table rooms enable row level security;
alter table items enable row level security;
alter table bids enable row level security;
alter table orders enable row level security;
alter table profiles enable row level security;

create policy "public read rooms" on rooms for select to anon, authenticated using (true);
create policy "public read items" on items for select to anon, authenticated using (true);
create policy "public read bids" on bids for select to anon, authenticated using (true);
create policy "own profile read" on profiles for select to authenticated using (auth.uid() = id);
create policy "winner order read" on orders for select to authenticated using (auth.uid() = winner);
-- No insert/update/delete policies for anon/authenticated: all writes go through service_role in Route Handlers.

-- Task 4 (fix): atomic bid/close transactions. The best-effort lock_item()
-- advisory-lock RPC is removed: its lock released at the end of its own RPC
-- call, so it never serialized the subsequent queries. place_bid()/close_item()
-- each run lock → validate → write inside ONE transaction.
-- Applied by postgres (Supabase migrations), so SECURITY DEFINER ownership is
-- safe; EXECUTE is revoked from client roles to preserve api-only writes.
drop function if exists lock_item(text);

-- M2 note: hashtext() is 32-bit; a collision across distinct item ids is
-- possible but harmless (worst case: unrelated items briefly serialize
-- against each other). SELECT ... FOR UPDATE below is the real serializer.
create or replace function place_bid(p_item_id uuid, p_bidder uuid, p_amount int, p_max_extensions int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  -- M1: clock read once inside the txn — single source of truth for
  -- late-bid, rate-limit, and extension-window checks.
  v_now timestamptz := now();
  v_item items%rowtype;
  v_bid bids%rowtype;
  v_extended boolean := false;
begin
  if p_item_id is null or p_bidder is null or p_amount is null or p_amount <= 0 then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;
  if p_max_extensions is null or p_max_extensions < 0 then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;

  perform pg_advisory_xact_lock(hashtext(p_item_id::text));

  select * into v_item from items where id = p_item_id for update;
  if not found then
    -- Preserve route contract: unknown item bids as 400 "closed".
    return jsonb_build_object('ok', false, 'error', 'closed');
  end if;
  if v_item.status = 'closed' or v_now > v_item.ends_at then
    return jsonb_build_object('ok', false, 'error', 'closed');
  end if;
  if p_amount <= v_item.current_price then
    return jsonb_build_object('ok', false, 'error', 'too_low');
  end if;
  -- C2: 1/sec per bidder+item enforced inside the txn.
  if exists (select 1 from bids
             where item_id = p_item_id and bidder = p_bidder
               and created_at > v_now - interval '1 second') then
    return jsonb_build_object('ok', false, 'error', 'rate_limited');
  end if;

  -- created_at defaults to now() server-side: client timestamps never accepted.
  insert into bids (item_id, bidder, amount)
  values (p_item_id, p_bidder, p_amount)
  returning * into v_bid;

  -- Anti-sniping: SQL mirror of decideExtension() in app/api/bids/route.ts
  -- (delta in [0,10s), cap not reached). The row is locked, so the
  -- extensions_used increment cannot be lost to a stale read (I1).
  if v_item.ends_at - v_now >= interval '0 seconds'
     and v_item.ends_at - v_now < interval '10 seconds'
     and v_item.extensions_used < p_max_extensions then
    v_extended := true;
    update items set
      current_price = p_amount,
      ends_at = v_item.ends_at + interval '10 seconds',
      extensions_used = v_item.extensions_used + 1,
      status = 'extended'
    where id = p_item_id;
  else
    update items set current_price = p_amount where id = p_item_id;
  end if;

  return jsonb_build_object('ok', true, 'bid', row_to_json(v_bid), 'extended', v_extended);
end;
$$;

revoke all on function place_bid(uuid, uuid, int, int) from public, anon, authenticated;
grant all on function place_bid(uuid, uuid, int, int) to service_role;

create or replace function close_item(p_item_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_item items%rowtype;
  v_winner uuid;
  v_price int;
begin
  if p_item_id is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  perform pg_advisory_xact_lock(hashtext(p_item_id::text));

  -- C3: row lock + re-check inside the txn; closed/live items are a no-op.
  select * into v_item from items where id = p_item_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if v_item.status = 'closed' or v_now <= v_item.ends_at then
    return jsonb_build_object('ok', true, 'noop', true);
  end if;

  -- Winner: highest amount, earliest bid, lowest id (I2 deterministic tiebreak).
  select bidder, amount into v_winner, v_price from bids
  where item_id = p_item_id
  order by amount desc, created_at asc, id asc
  limit 1;

  if not found then
    update items set status = 'closed' where id = p_item_id;
    return jsonb_build_object('ok', true, 'closed', true, 'winner', null);
  end if;

  update items set status = 'closed', winner = v_winner, current_price = v_price
  where id = p_item_id;
  insert into orders (item_id, winner, status)
  values (p_item_id, v_winner, 'pending')
  on conflict (item_id) do nothing;

  return jsonb_build_object('ok', true, 'closed', true, 'winner', v_winner);
end;
$$;

revoke all on function close_item(uuid) from public, anon, authenticated;
grant all on function close_item(uuid) to service_role;

-- 2026-09-22 livestream subsystem: open go-live, chat, leaderboard names.
alter table rooms drop constraint if exists rooms_status_check;
alter table rooms add constraint rooms_status_check
  check (status in ('lobby','preview','live','ended'));
alter table rooms add column if not exists owner_id uuid references auth.users(id) on delete cascade;
alter table rooms add column if not exists thumbnail_url text;

create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  sender_key text not null,
  nickname text not null check (char_length(nickname) between 1 and 24),
  body text not null check (char_length(body) between 1 and 200),
  created_at timestamptz not null default now()
);
create index if not exists chat_room_time_idx on chat_messages (room_id, created_at desc);
create index if not exists chat_sender_time_idx on chat_messages (room_id, sender_key, created_at desc);

alter table chat_messages enable row level security;
drop policy if exists "public read chat" on chat_messages;
create policy "public read chat" on chat_messages for select to anon, authenticated using (true);
-- No write policies: inserts go through POST /api/chat with service_role.

drop policy if exists "public read names" on profiles;
create policy "public read names" on profiles for select to anon, authenticated using (true);
-- Pilot note: exposes reputation alongside names; accepted for the leaderboard.

do $$ begin
  alter publication supabase_realtime add table chat_messages;
exception when duplicate_object then null;
end $$;
