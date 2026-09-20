# HOBYD Pilot MVP — Approach A Design Spec (2026-09-21)

Team: Pekalongan Hemker Community / Telkom University — Tristan Edgina Rakhadewa + Farel Satrio Pratama + Khoirul Fikri.
Proposal: CR YOUTH 2026 HACKATHON, beachhead Pokemon TCG Indonesia, DISCOVER-WATCH-BID-WIN-PAY loop.
Status: Approach A APPROVED by user (2026-09-21). Next gate: user reviews this spec file before writing-plans.

## 1. Shared understanding (what was said vs assumed)

Said (locked): pilot-ready MVP; 1 seller ultra-fast listing (photo + title + start_price); custom amount input;
real LiveKit live; real Supabase Auth; sandbox gateway QRIS (Midtrans/Xendit); anti-sniping 10s extension with max cap;
Vercel deploy; responsive ID+EN; setup guide needed. Stack: Next.js on Vercel + Supabase (Postgres + Auth + Realtime + Storage)
+ LiveKit Cloud; video isolated from bid state; server-authoritative engine with server timestamp ordering.
Data model: rooms(id,title,seller_name,status[lobby/live/ended]), items(id,room_id,title,img_url,start_price,current_price,ends_at,winner),
bids(id,item_id,bidder,amount,created_at), profiles(id,name,reputation), orders(id,item_id,winner,status[paid/expired/cancelled]).

Assumed: single concurrent live room for pilot; IDR only; sandbox = no real charge; manual seller payout offline;
no multi-seller, no auto-shipping, no seller verification / reputation-dispute system in MVP (roadmap per proposal trust layers).
Max extension cap: 5 extensions (i.e. max +50s per item) — tunable env `MAX_SNIPING_EXTENSIONS=5`. Payment window: 5 min countdown
(per image18 `05:00`), then expired → cancelled + relist. Decisions: gateway = Midtrans sandbox primary (Xendit dropped for pilot);
custom amount = any integer IDR strictly greater than current_price, no fixed increment; bid rate limit = 1/sec per user per item.

## 2. Architecture (Approach A, chosen over B/C)

Next.js App Router monolith on Vercel + Supabase + LiveKit Cloud.
- Web + API: Vercel (App Router pages + Route Handlers as bid authority).
- DB/Auth/Realtime/Storage: Supabase Postgres (RLS), Auth, Realtime publications on items + bids tables (API writes DB only, clients subscribe; no separate outbox table), Storage bucket `item-images`.
- Live video: LiveKit Cloud room per `rooms.id`; token via GET /api/livekit-token?roomId= requiring Auth JWT — `publisher` grant only to allowlisted seller, `subscriber` to others; video carries ZERO bid state.
- Rejected B (LiveKit Data Channel for bids): splits authority, anti-sniping harder to prove, more egress.
- Rejected C (Supabase-only mock video): violates "real LiveKit" lock, weak hackathon demo.

Graph evidence: `Split Media Transaction Architecture` community (image11 DUA SISTEM TERPISAH: seller camera→live video→viewers
vs bid request→auction engine→database→broadcast) confirms isolation is already the proposal's intent. God nodes
`Core Auction Engine` (7 edges) and `Bid validation flowchart` (7 edges) anchor the design.

## 3. Components

- `rooms`: lobby list (DISCOVER) → live view (WATCH). Statuses lobby/live/ended. One pilot room, one seller.
- `items`: seller creates via POST /api/items (allowlist check, Storage upload, server sets ends_at = now() + AUCTION_DURATION_SEC default 120, tunable env) with photo (Storage upload) + title + start_price only (ultra-fast). Fields current_price, ends_at, winner.
- `bids`: POST /api/bids only. Validates: room live, item open, auth user, amount integer IDR strictly greater than current_price (no fixed increment), DB-backed rate limit (MAX(created_at) per bidder+item in the same transaction, max 1/sec). Server sets created_at=now() and ignores any client-supplied created_at.
- `orders`: created on winner lock; checkout shows QRIS sandbox QR + 5:00 countdown; confirm → paid → ORDER CONFIRMED; timeout → expired → cancelled + relist.
- `profiles`: Supabase Auth user → name, reputation (read-only in pilot).
- i18n: next-intl ID+EN, mobile-first responsive (desktop + mobile layouts per image5).

## 4. Data flow (DISCOVER-WATCH-BID-WIN-PAY)

DISCOVER: GET /api/rooms (status lobby/live) → WATCH: LiveKit join (token) + subscribe Realtime items/bids →
BID: custom amount submit → POST /api/bids transaction (lock item row; checks; insert; maybe extend ends_at; broadcast) →
WIN: closer is POST /api/items/[id]/close (never GET — GET must not mutate) plus every bid POST attempts close first; single transactional closer: SELECT item FOR UPDATE, IF already closed → no-op return, ELSE set winner + insert order ON CONFLICT (item_id) DO NOTHING; when ends_at passes with no extension left → close item, set winner, create order (status pending), broadcast WINNER LOCK + ITEM WON modal →
PAY: QRIS sandbox checkout → pending→paid on confirm, pending→expired on 5-min timeout, expired→cancelled on relist. Confirm path for pilot: POST /api/orders/webhook (Midtrans notification, signature verify) + POST /api/orders/[id]/mock-confirm (sandbox demo button, winner-only). Failure paths explicit (image15): expired→cancelled→relist.

Anti-sniping rule: if validated bid arrives with 0 <= (ends_at - now()) < 10s and extensions_used < MAX (5), ends_at += 10s,
extensions_used += 1; bids arriving after ends_at are rejected 4xx and never extend (late bids cannot reopen a closed auction). `10 DETIK TERAKHIR? → EXTEND TIMER → WINNER LOCK` else `TUTUP LELANG → WINNER LOCK`. The single AMBIGUOUS
graph edge (`10 DETIK TERAKHIR? → WINNER LOCK` direct) is REJECTED: no direct transition; all closes go through extend-check then lock.

## 5. Data model (Supabase Postgres sketch)

rooms(id uuid pk, title text, seller_name text, status text check lobby/live/ended, created_at timestamptz default now());
items(id uuid pk, room_id fk, title text, img_url text, start_price int, current_price int, ends_at timestamptz, winner uuid nullable,
extensions_used int default 0, status text check (status in ('lobby','live','ending','extended','closed')) default 'lobby', created_at timestamptz);
-- rooms.status stays locked to lobby/live/ended; items.status tracks the image14 lifecycle with transitions
-- lobby→live→ending→(extended↔ending)→closed, written only by bid/close transactions; orders carry pending→paid | pending→expired→cancelled.
bids(id uuid pk, item_id fk, bidder uuid fk profiles, amount int check >0, created_at timestamptz default now());
profiles(id uuid pk fk auth.users, name text, reputation int default 0);
orders(id uuid pk, item_id fk unique, winner uuid, status text check (status in ('pending','paid','expired','cancelled')) default 'pending', created_at timestamptz, paid_at nullable).
-- relist = seller-only action creating a NEW item row (copy title/img/start_price, reset extensions_used=0, fresh ends_at); old order stays expired/cancelled.
RLS (explicit): SELECT on rooms/items/bids/orders to anon+authenticated; DENY all INSERT/UPDATE/DELETE for anon/authenticated roles (no client direct writes); only service_role in Route Handlers after verifying the Supabase JWT server-side.
seller-only item create (pilot: single seller allowlist email). Indexes on (item_id, created_at desc), items(room_id, status).

## 6. Error handling

Bid rejected: item closed / amount too low / unauthenticated / rate-limited → 4xx with ID+EN message, no state change.
Concurrent bids: row lock + server timestamp order; loser gets current_price refresh via Realtime.
LiveKit drop: bidding stays available (isolated); reconnect token refresh.
Payment timeout: order expired → item relist, winner notified. All failures broadcast consistently; audit trail = bids table (open history).

## 7. Testing

Pilot acceptance: 1 seller lists in <60s (photo+title+price); 3 bidders place custom bids; last-10s bid extends once (+10s, cap respected);
winner lock creates order (pending); sandbox QR shows 5:00 countdown; mock-confirm → paid → confirmed; timeout → expired → cancelled + relist-as-new-item.
Cap/race checks: 6th bid inside window does NOT extend (extensions_used stays 5); 2 bids <1s apart from same user → 2nd 429; 2 concurrent top bids → single winner by server timestamp; double-close (POST + poller) → one order row, second no-op.
Load: single room, 3–10 bidders for pilot; no perf harness for pilot. Manual ID+EN toggle check on lobby/live/checkout.

## 8. Scope: MVP vs roadmap (from proposal trust layers)

MVP: seller profile (no verification), server validation + open bid history + audit trail, payment status + transaction record.
Roadmap (NOT MVP): seller verification, reputation + dispute handling, category expansion (diecast/sneakers), premium seller services.

## 9. Setup guide (secrets pending from user; env names locked below)

Supabase: create project → run §5 SQL → create `item-images` bucket (public read) → enable Auth (email) → copy URL + anon + service_role.
LiveKit Cloud: create project → copy URL + API key/secret → token route env.
Midtrans sandbox only: server key + client key sandbox → QRIS mock; no real charge.
Vercel: env NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY (server-only), NEXT_PUBLIC_LIVEKIT_URL (client join) + LIVEKIT_API_KEY/SECRET (server-only),
MIDTRANS_SERVER_KEY/CLIENT_KEY (sandbox), MAX_SNIPING_EXTENSIONS=5, AUCTION_DURATION_SEC=120, PAYMENT_WINDOW_SEC=300. Deploy monorepo root.
Full step-by-step with screenshots/CLI comes with implementation plan (writing-plans) after spec approval.

## 10. File-by-file outline (detailed plan via writing-plans after approval)

app/[locale]/page (DISCOVER lobby), app/[locale]/live/[roomId] (WATCH+BID), app/[locale]/win/[itemId], app/[locale]/pay/[orderId],
app/api/rooms/route.ts (GET lobby/live list), app/api/items/route.ts (POST seller create + GET), app/api/items/[id]/close/route.ts (POST idempotent closer),
app/api/bids/route.ts (authority+anti-sniping), app/api/livekit-token/route.ts (JWT-gated grants), app/api/orders/route.ts + app/api/orders/webhook/route.ts + app/api/orders/[id]/mock-confirm/route.ts,
lib/supabase/*, lib/livekit/*, lib/i18n/*, supabase/schema.sql. No code written until implementation plan approved.
