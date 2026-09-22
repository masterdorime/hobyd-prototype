# HOBYD Pilot — Setup Guide + Vercel Deploy

End-to-end setup for a human with fresh accounts. No step here has been run
live by the author (this environment has no backend secrets); every step is
written so a first-timer succeeds by following it literally.

Prerequisites: a Supabase account, a LiveKit Cloud account, a Midtrans
sandbox account, a Vercel account, Node 20+ and `npm` locally.

---

## 1. Supabase

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) → **New project**.
   Pick a name (e.g. `hobyd-pilot`), a DB password (save it), a region close to
   your users → **Create new project**. Wait for provisioning (~2 min).
2. **Apply the schema.** Open **SQL Editor** → **New query** → paste the entire
   contents of `supabase/schema.sql` from this repo → **Run**. This creates
   tables `profiles`, `rooms`, `items`, `bids`, `orders`, both indexes,
   read-only RLS policies (all writes go through the `service_role` key in
   Route Handlers — there are deliberately no insert/update/delete policies
   for `anon`/`authenticated`), and the atomic `place_bid()` / `close_item()`
    functions (granted to `service_role` only).
   Re-run the new `2026-09-22 livestream subsystem` section at the end of
   `supabase/schema.sql` in the SQL editor (it is `if not exists`-safe),
   then verify with `select * from chat_messages limit 1;` returning zero rows
   without error.
3. **Verify the apply** (live-DB check — queued verification from Tasks 1/4,
   do this now while you are here):
   - **Table Editor**: confirm tables `profiles`, `rooms`, `items`, `bids`,
     `orders` exist.
   - **SQL Editor**, run:
     ```sql
     select routine_name from information_schema.routines
     where routine_schema = 'public'
       and routine_name in ('place_bid', 'close_item');
     ```
     Expected: both rows returned.
   - **RLS no-client-writes probe**: run as `anon`:
     ```sql
     set role anon;
     insert into items (room_id, title, img_url, start_price, current_price, ends_at)
     values (gen_random_uuid(), 'probe', 'https://example.com/x.png', 1, 1, now());
     reset role;
     ```
     Expected: `permission denied` / policy violation (proves api-only writes).
4. **Storage.** Open **Storage** → **New bucket** → name exactly
   `item-images` → toggle **Public bucket ON** → **Create**. Then select the
   bucket → **Policies** → **New policy** → **For full customization** (or the
   "public read" template) so `SELECT` is allowed for `public`:
   reads are public, uploads happen with the service key only. Item images are
   stored here; the app's `POST /api/items` takes an `img_url` string, so use
   the file's **Get public URL** (or any public image URL) as `img_url`.
5. **Auth.** Open **Authentication** → **Providers** → confirm **Email** is
   ON (magic-link/password sign-in for pilot users). No extra config needed.
6. **Copy the three values.** Open **Project Settings** (gear icon) →
   **API**:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (secret — server only,
     never expose to the browser, never commit)

## 2. LiveKit Cloud

1. Go to [cloud.livekit.io](https://cloud.livekit.io) → **New project**
   (e.g. `hobyd-pilot`) → **Create**.
2. On the project overview copy:
   - `WebSocket URL` (`wss://…`) → `NEXT_PUBLIC_LIVEKIT_URL`
   - **API key** → `LIVEKIT_API_KEY`
   - **API secret** → `LIVEKIT_API_SECRET` (secret — server only)
   (Keys are under **Settings → Keys** if rotated later.)
3. No webhook or room pre-creation needed: the app mints per-room tokens via
   `GET /api/livekit-token?roomId=<room-uuid>` — sellers get publish grants,
   everyone else subscribes (`grantFor` in `app/api/livekit-token/route.ts`).

## 3. Midtrans (sandbox)

1. Go to [dashboard.midtrans.com](https://dashboard.midtrans.com) → sign up /
   log in → ensure **Sandbox** mode (top-right environment toggle).
2. Open **Settings → Access Keys** and copy:
   - **Server Key (Sandbox)** → `MIDTRANS_SERVER_KEY` (secret — the
     `/api/orders/webhook` signature check hashes
     `order_id+status_code+gross_amount+MIDTRANS_SERVER_KEY` with SHA-512)
   - **Client Key (Sandbox)** → `MIDTRANS_CLIENT_KEY` (reserved for a future
     live Snap integration; the pilot checkout uses the static
     `public/qris-sandbox.png` fixture + winner mock-confirm, so this key is
     currently unused by code but still required in env)
3. **QRIS.** Sandbox QR payments are simulated in-pilot: the pay page
   (`/{locale}/pay/{orderId}`) shows the sandbox QR with a 5:00 countdown
   (`PAYMENT_WINDOW_SEC`) and the winner taps mock-confirm. No QRIS
   onboarding needed for the pilot.
4. **Notification URL.** Open **Settings → Configuration → Payment
   Notification URL** and set it to your deployed URL shape:
   `https://<your-app>.vercel.app/api/orders/webhook`
   (POST, Midtrans HTTP notification). For live notify, Midtrans sends
   `order_id` equal to our `orders.id` (UUID); `settlement`/`capture` flips
   the order to `paid`. Verify later under **Settings → Configuration →
   Notification history** after a test payment.

## 4. Local run

```bash
cp .env.example .env.local   # then fill every value (see §6 table)
npm install
npm run dev                  # http://localhost:3000/id  (default locale /id, /en available)
```

## 5. Vercel deploy

1. Push this branch (`hobyd-mvp`) to GitHub.
2. Go to [vercel.com/new](https://vercel.com/new) → **Import** the repo →
   keep framework preset **Next.js** → **Deploy** only after step 3.
3. **Before deploying**, open **Settings → Environment Variables** (or the
   deploy-time env form) and add **all 12 variables from `.env.example`**
   (names + where to get each value — see §6). Set them for **Production**
   (and Preview if you want preview deploys to work).
4. **Deploy** → wait for the build → open the production URL.
5. Re-run the §3.4 notification-URL step with the real production URL.

## 6. All env vars (12 — matches `.env.example`)

| Name | Where to get it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL (§1.6) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → anon public (§1.6) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → service_role (§1.6, secret) |
| `NEXT_PUBLIC_LIVEKIT_URL` | LiveKit Cloud → project overview → WebSocket URL (§2.2) |
| `LIVEKIT_API_KEY` | LiveKit Cloud → Settings → Keys (§2.2) |
| `LIVEKIT_API_SECRET` | LiveKit Cloud → Settings → Keys (§2.2, secret) |
| `MIDTRANS_SERVER_KEY` | Midtrans → Settings → Access Keys → Server Key, Sandbox (§3.2, secret) |
| `MIDTRANS_CLIENT_KEY` | Midtrans → Settings → Access Keys → Client Key, Sandbox (§3.2) |
| `SELLER_ALLOWLIST` | You decide: comma-separated seller emails, e.g. `seller1@mail.com,seller2@mail.com` (matched case-insensitively by `isSeller()` in `lib/auth.ts`; only these can `POST /api/items` and publish video) |
| `MAX_SNIPING_EXTENSIONS` | You decide: anti-sniping cap, e.g. `5` (after this many +10s extensions, late bids stop extending) |
| `AUCTION_DURATION_SEC` | You decide: item lifetime, e.g. `120` (server sets `ends_at` on create) |
| `PAYMENT_WINDOW_SEC` | You decide: keep `300` (5:00 QR countdown; the pay page hardcodes the same 300s — keep them in sync) |

Coverage check (must print `ALL ENV DOCUMENTED`):

```bash
node -e "const fs=require('fs');const e=fs.readFileSync('.env.example','utf8').split('\n').filter(l=>l.includes('=')).map(l=>l.split('=')[0]);const s=fs.readFileSync('docs/SETUP.md','utf8');const m=e.filter(k=>!s.includes(k));console.log(m.length?('MISSING:'+m):'ALL ENV DOCUMENTED')"
```

## 7. Post-deploy seed (seller + room)

Do these against the **production** Supabase project (Dashboard → Table
Editor / SQL Editor). You need one seller auth user first: open the deployed
app, sign in with the seller email (must match `SELLER_ALLOWLIST`), then find
its `id` under Supabase → **Authentication → Users**.

```sql
-- 1. Seller profile row (id MUST equal the auth.users id of the seller email)
insert into profiles (id, name) values ('<seller-auth-uuid>', 'Pilot Seller');

-- 2. Lobby room row
insert into rooms (title, seller_name, status)
values ('Pilot Live #1', 'Pilot Seller', 'lobby')
returning id;  -- save this uuid as <room-id>
```

Then create the first item (<60s listing check): as the seller, call

```bash
curl -X POST https://<your-app>.vercel.app/api/items \
  -H 'Content-Type: application/json' \
  -H "Cookie: <seller-session-cookie>" \
  --data '{"room_id":"<room-id>","title":"Kaos limited","img_url":"https://<your-project>.supabase.co/storage/v1/object/public/item-images/kaos.png","start_price":50000}'
```

(or insert into `items` via SQL with `ends_at = now() + make_interval(secs => 120)`).
Flip the room live when ready:

```sql
update rooms set status = 'live' where id = '<room-id>';
```

The lobby (`/id`) lists `lobby`+`live` rooms; the live page is
`/id/live/<room-id>`.

## 8. Acceptance run (Task 8 checklist, against the prod URL)

1. **Seller <60s listing** — §7 curl above returns the item; it appears on
   the live page.
2. **3 test bids** — three signed-in users `POST /api/bids`
   `{item_id, amount}` increasing; feed updates via realtime.
3. **Last-10s extend** — bid with `0 <= ends_at - now < 10s` → `ends_at`
   pushes +10s, `extensions_used` increments, item status `extended`.
4. **Cap-exhaustion no-extend** — repeat (3) until
   `extensions_used = MAX_SNIPING_EXTENSIONS`; the next last-10s bid updates
   price but does NOT extend.
5. **429** — fire two bids from the same user within 1s (double-click the
   Tawar button) → second returns `429 rate_limited`.
6. **Double-close single order** — `POST /api/items/<id>/close` twice →
   one `orders` row (`item_id` unique); second call is a no-op.
7. **QR 5:00** — winner opens `/id/pay/<orderId>`: QR + live mm:ss countdown
   from 5:00.
8. **Mock-confirm paid** — winner taps confirm → `paid`; non-winner gets 403.
9. **Timeout** — let the 5:00 lapse without paying → `POST
   /api/orders/<id>/expire` flips `pending → expired`; relist manually as a
   new item via `POST /api/items` (see troubleshooting).
10. **ID+EN toggle** — header toggle switches `/id/…` ↔ `/en/…`, same content.
11. **Two-client race smoke** — open the same live room in two browsers /
    devices, place near-simultaneous bids in the last 10s: exactly one price
    wins each round, `extensions_used` increments by exactly 1 per extended
    bid, and the eventual winner matches the highest bid
    (`amount desc, created_at asc, id asc` tiebreak in `close_item()`).

## 9. Troubleshooting

- `Missing env <NAME>` at runtime → that env var is absent in Vercel
  (Settings → Environment Variables) — add it and redeploy.
- Bids return `closed` immediately → item `ends_at` already passed or status
  is `closed`; create a fresh item (§7).
- Live video connects but stays black → seller email not in
  `SELLER_ALLOWLIST` (subscriber grant can't publish); fix the var, redeploy,
  rejoin.
- Webhook 403 `bad_sig` → `MIDTRANS_SERVER_KEY` mismatch or wrong environment
  (sandbox key vs production notification); re-copy from §3.2.
- **Orders `expired` is terminal: "stays expired" satisfies the pilot — an
  unpaid order remains `expired` and the seller relists as a new item;
  `cancelled` is reserved for an explicit manual seller cancel, not the
  payment timeout.** (Task 8 review ruling, codified so plan and
  implementation read consistently.)
- Pay page shows "Result unavailable" → only the winner (or a seller via
  `?item_id=`) can view an order (Ruling R2); sign in as the winner.
- **Pre-migration rooms have no owner.** Rooms created before the livestream
  migration have `owner_id = null` (subscriber-only, unmanageable — no Go
  Live / End controls). Assign an owner by id as an admin:
  ```sql
  update rooms set owner_id = '<auth-user-uuid>' where id = '<room-uuid>';
  ```
