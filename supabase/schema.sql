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

-- Task 4: per-item bid serialization. PostgREST cannot call pg_catalog
-- functions directly, so expose a public wrapper around
-- pg_advisory_xact_lock keyed by item id. Called best-effort from
-- POST /api/bids (a missing function degrades to discrete queries).
create or replace function lock_item(p_key text) returns void
language sql as $$ select pg_advisory_xact_lock(hashtext(p_key)) $$;
