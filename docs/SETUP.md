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
   without error. Also apply the later trailing sections the same way
   (`2026-09-23 auction modes + category gate`, `add winner_contact to
   orders` — see §10 and §11.4); all are idempotent.
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
   ON (magic-link/password sign-in for pilot users). If **Confirm email**
   is ON (recommended), new users land on a verification notice after
   signup and can resend the confirmation from the login page — the app
   maps Supabase's "Email not confirmed" error to that notice
   (`isEmailNotConfirmed` in `app/[locale]/login/page.tsx`). No extra
   config needed.
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
   `GET /api/livekit-token?roomId=<room-uuid>` — the room **owner** gets
   publish grants, everyone else subscribes (`grantFor` in
   `app/api/livekit-token/route.ts` compares the caller to the room's
   `owner_id`).

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
cp .env.example .env.local   # then fill every value (see the env table in §6)
npm install
npm run dev                  # http://localhost:3000/id  (default locale /id, /en available)
```

## 5. Vercel deploy

1. Push this branch (`hobyd-mvp`) to GitHub.
2. Go to [vercel.com/new](https://vercel.com/new) → **Import** the repo →
   keep framework preset **Next.js** → **Deploy** only after step 3.
3. **Before deploying**, open **Settings → Environment Variables** (or the
   deploy-time env form) and add **all variables from `.env.example`**
   (names + where to get each value — see §6). Set them for **Production**
   (and Preview if you want preview deploys to work).
4. **Deploy** → wait for the build → open the production URL.
5. Re-run the §3.4 notification-URL step with the real production URL.

## 6. All env vars (11 required + 2 optional — matches `.env.example`)

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
| `SELLER_ALLOWLIST` | You decide: comma-separated emails, e.g. `seller1@mail.com,seller2@mail.com` (matched case-insensitively by `isSeller()` in `lib/auth.ts`). Since open go-live, this NO LONGER gates listing or publishing — any signed-in user can stream. It still lets allowlisted sellers view any order (winner-only otherwise) in `app/api/orders/route.ts`. |
| `MAX_SNIPING_EXTENSIONS` | You decide: anti-sniping cap, e.g. `5` (after this many extensions, late bids stop extending; hard-close items never extend regardless) |
| `EXTENSION_WINDOW_SEC` | Optional, default `10`: soft-close trigger window — bids in the last N seconds extend the clock |
| `EXTENSION_ADD_SEC` | Optional, default `10`: seconds added per soft-close extension |
| `PAYMENT_WINDOW_SEC` | You decide: keep `300` (5:00 QR countdown; the pay page hardcodes the same 300s — keep them in sync) |

Coverage check (must print `ALL ENV DOCUMENTED`):

```bash
node -e "const fs=require('fs');const e=fs.readFileSync('.env.example','utf8').split('\n').filter(l=>l.includes('=')).map(l=>l.split('=')[0]);const s=fs.readFileSync('docs/SETUP.md','utf8');const m=e.filter(k=>!s.includes(k));console.log(m.length?('MISSING:'+m):'ALL ENV DOCUMENTED')"
```

## 7. Post-deploy seed (seller + room)

Do these against the **production** Supabase project (Dashboard → Table
Editor / SQL Editor). Signup auto-creates a `profiles` row via the
`on_auth_user_created` trigger — no manual profile step. You need one
signed-in user first: open the deployed app, sign up / sign in.

Seller flow (all UI, no SQL needed):

1. Tap **Go Live** (header / bottom nav, signed in) — a dialog asks for a
   **stream title** (1–80 chars) and **category** upfront, then opens your
   `preview` room. (Listing via **Sell** instead creates the room from the
   item title; rename it later from the sell page or the settings route.)
2. On the live page, set a **thumbnail** (file or camera — auto-cropped to
   16:9, like all uploaded photos) and publish your **camera** (preview
   first, then Start camera; on phones the preview is tall portrait).
3. Tap **Start Stream**. If the room still has no category, pick one
   (Sneakers / TCG / Vintage Clothing / Electronics) — bidding stays
   closed until then.
4. **+ Add item**: photo (file or in-app camera), title, start price,
   mode (Soft close / Sudden death), duration (15/30/60s chips or
   10–300s custom). Repeat for every item in the session.
5. **Start bid** per item when ready; **Close bid** (two-tap) to settle
   early, or let the timer close it. Winner pays via `/pay/<orderId>`.
6. After the stream, open **Sales** (header / sell page) — every sold item
   with the winner's WhatsApp number and tap-to-chat. Winners leave their
   number on the win page.

Direct links: lobby (`/id`), live page `/id/live/<room-id>`.

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
12. **Modes** — list one Soft + one Hard item (30s): bid at 3s left on
    Soft → clock extends; same on Hard → clock unmoved, bid accepted.
    Hostile `POST /api/items` (`mode=turbo`, `duration_sec=5`) → 400.
13. **Category gate** — new room shows the category picker instead of bid
    controls; Start-bid buttons are absent (not disabled) until a category
    is picked; the lobby tab matches the pick.
14. **Realtime proof** — bid/chat/category-pick in window A reflects in
    window B within ~2s with no refresh. If anything sits stale, check
    §11 (publication membership) before touching code.
15. **Mobile 360px** — lobby/live/sell/login render with no horizontal
    scroll; bottom nav (Discover / Go Live / Sell / Account) fully
    tappable at 48px targets; EN↔ID toggle, no missing-key fallback text.
16. **Naming dialog** — Go Live opens title + category dialog; empty title
    blocks with an inline error; room opens with the given name/category.
17. **Theater rail** — desktop theater shows video left, bid card + chat
    rail right; toggling never drops the stream (same video node).
18. **Mobile viewer stack** — phone viewer sees full-bleed video, top
    identity bar (avatar, LIVE, duration, viewers, X), expiring chat,
    thumbnail bid card; no right rail.
19. **Handover + sales** — winner saves WhatsApp on the win page (invalid
    numbers → 400); seller sees number + wa.me link on the win page and
    the Sales page; non-winner save → 403.
20. **Sweep** — create a preview room, wait 10+ min, reload the lobby: it
    is gone (deleted); a stale live room with no viewers flips to `ended`.
21. **16:9 crop** — upload a portrait photo as item image / room cover:
    stored file is a centered 16:9 JPEG crop.
22. **Fit preview + Other + dialog** — pre-post preview frame matches the
    lobby/item card exactly; pick "Other" category end-to-end (dialog,
    gate, lobby tab); open Go Live from a phone — dialog is fully visible
    and scrollable, never clipped by the bottom nav.
23. **Mobile portrait + landscape fullscreen** — phone seller streams with
    a tall portrait preview; phone viewer on a landscape stream taps
    maximize → true fullscreen with bid card top-right and chat
    bottom-right, rotate prompt in portrait; open/close never drops the
    underlying stream.
24. **Mobile video fix** — publish capped at 720p (phones decode any
    stream); viewer video is full-bleed cover on phones; `?debug=1` on a
    live URL shows the track-event readout for black-video repros.

## 9. Troubleshooting

- `Missing env <NAME>` at runtime → that env var is absent in Vercel
  (Settings → Environment Variables) — add it and redeploy.
- Bids return `closed` immediately → item `ends_at` already passed or status
  is `closed`; create a fresh item (§7).
- Live video connects but stays black → the viewer joined with a
  subscriber grant: only the room **owner** (`rooms.owner_id`) gets the
  publisher grant. Sign in as the owner (or assign one per the
  pre-migration note below), rejoin.
- Webhook 403 `bad_sig` → `MIDTRANS_SERVER_KEY` mismatch or wrong environment
  (sandbox key vs production notification); re-copy from §3.2.
- **Orders `expired` is terminal: "stays expired" satisfies the pilot — an
  unpaid order remains `expired` and the seller relists as a new item;
  `cancelled` is reserved for an explicit manual seller cancel, not the
  payment timeout.** (Task 8 review ruling, codified so plan and
  implementation read consistently.)
- Pay page shows "Result unavailable" → only the winner (or a seller via
  `?item_id=`) can view an order (Ruling R2); sign in as the winner.
- **My preview room vanished from the lobby** → expected: the auto-sweep
  (§12) erases `preview` rooms older than 10 min that never went live, and
  ends participant-less `live` rooms past the same TTL. If you were
  mid-setup, just Go Live again.
- Maximize does nothing on an older iPhone → pre-16.4 iOS Safari has no
  element Fullscreen API: the app still opens the full-viewport overlay
  (same layout, minus OS-level fullscreen). Rotate prompt included.
- **Mobile viewer sees chat but black video** → open the same live URL with
  `?debug=1`: the readout shows publisher capture (`WxH@fps`) and subscriber
  events (`subscribed`, `first-frame`). No `first-frame` after `subscribed`
  = decoder/codec issue (report the capture line); `remote video muted` =
  publisher-side mute.
- **Pre-migration rooms have no owner.** Rooms created before the livestream
  migration have `owner_id = null` (subscriber-only, unmanageable — no Go
  Live / End controls). Assign an owner by id as an admin:
  ```sql
  update rooms set owner_id = '<auth-user-uuid>' where id = '<room-uuid>';
  ```

## 10. Auction modes + category gate migration (2026-09-23)

Apply the trailing `2026-09-23 auction modes + category gate` section of
`supabase/schema.sql` in the SQL editor (it is `if not exists`-safe, like
the livestream section in §1.2). Backfill behavior: existing items get
`auction_mode = 'soft'` / `duration_sec = 30` via the column defaults (no
manual step); existing rooms get `category = null` — the seller picks a
category on the live page before bidding opens. No RLS/Realtime changes
needed.

## 11. Realtime publication + profiles + thumbnails (2026-09-23)

Three things that silently break the app when missing — verify after any
fresh schema apply:

1. **Realtime publication.** The UI subscribes to `bids`, `items`,
   `rooms`, and `chat_messages`. If a table is missing from the
   `supabase_realtime` publication, its screen region silently never
   updates (no error anywhere). Verify:
   ```sql
   select tablename from pg_publication_tables
   where pubname = 'supabase_realtime' order by tablename;
   ```
   Expected: `bids`, `chat_messages`, `items`, `rooms`. The trailing
   `broadcast bids, items, rooms over realtime` section of
   `supabase/schema.sql` adds any missing one (idempotent — safe to
   re-run).
2. **Profile auto-create.** Signup fires `on_auth_user_created`, which
   inserts the `profiles` row bidding requires (`bids.bidder →`
   `profiles(id)`). Without it every bid fails with `bid_failed`.
   Verify: `select count(*) from profiles;` grows after a fresh signup.
3. **Thumbnails.** `rooms.thumbnail_url` (nullable) set from the live
   page's Set-thumbnail control; lobby cards render it when present.
   `item-images` bucket must stay public-read (§1.4).
4. **`winner_contact`.** Handover needs `orders.winner_contact` (nullable
   text) — apply the trailing `add winner_contact to orders` section of
   `supabase/schema.sql` (idempotent). Verify:
   ```sql
   select column_name from information_schema.columns
   where table_schema = 'public' and table_name = 'orders'
     and column_name = 'winner_contact';
   ```
   Expected: one row.

## 12. Post-modes features (2026-09-23/24, no manual setup)

Shipped after the auction-modes migration; all covered by the specs in
`docs/superpowers/specs/`. No new env vars, no new RLS, no cron:

- **Stream naming** — `GoLiveDialog` (title + category upfront, both Go Live
  buttons); owner `POST /api/rooms/[id]/settings` renames/recategorizes
  (replaces the old `…/category` route); sell page renames its preview room.
- **Theater + portrait** — orientation-aware video box (portrait streams in
  9:16, never cropped); theater overlay replaces native fullscreen, v2 adds
  the YouTube-maximize bid+chat rail. Same video node throughout — no
  reconnects, no duplicate topic subscriptions.
- **Mobile viewer stack** — full-bleed video, identity top bar (initials,
  LIVE, duration, LiveKit viewer count, X), expiring chat, winner pill,
  thumbnail bid card. Sellers on phones keep the stacked scroll layout.
- **Handover + sales inbox** — winner-only `POST /api/orders/[id]/contact`
  saves WhatsApp (`winner_contact`); win page shows it to the seller with a
  wa.me link; `GET /api/orders/sales` + `/sales` page list everything the
  signed-in user sold.
- **Auto-sweep** — `GET /api/rooms` lazily erases `preview` rooms older than
  10 min and ends participant-less `live` rooms past the same TTL
  (`lib/sweep.ts`, fail-open). No scheduler needed.
- **16:9 uploads** — item photos and room covers are center-cropped to 16:9
  JPEGs client-side at accept time (`lib/image.ts`); previews are WYSIWYG.
  Every display surface (lobby, item card, rail, mobile card, sales) renders
  `aspect-video object-cover`, and the room cover is staged with a fit
  preview + Upload/Cancel confirm before anything posts.
- **"Other" category** — fifth value in the check + lobby tab (complement
  filter: titles no hint covers).
- **Dialog portal** — `GoLiveDialog` portals to `document.body`, immune to
  the BottomNav backdrop-blur containing block that cropped it on mobile.
