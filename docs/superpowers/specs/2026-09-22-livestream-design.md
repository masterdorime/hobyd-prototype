# HOBYD Livestream Subsystem — Design Spec (2026-09-22)

Open go-live to any signed-in user, add streamer start/end controls,
guest-capable live chat, and a realtime top-bids leaderboard on the
watch page. Supabase-native throughout; LiveKit stays video-only.

## 1. Locked decisions

1. **Go-live permission: any signed-in user.** The `SELLER_ALLOWLIST`
   gate is dropped for room creation (`POST /api/rooms`) and item
   listing. Winner-only rules (orders read, mock-confirm) and all
   RLS-deny-client-writes invariants stay.
2. **End Stream asks the seller each time.** Dialog with two explicit
   choices: (a) Close + settle — force-settle the active item
   (winner lock → pay flow), then room → `ended`; (b) End video only —
   room → `ended`, chat/video stop, the active item keeps running to
   its `ends_at`.
3. **Chat: signed-in + guests.** Guests pick a nickname stored in
   `localStorage`; signed-in users default to profile name. Pilot
   moderation = message length cap + per-sender rate limit. No
   profanity filter.
4. **Leaderboard: top-5 live bids on the current item**, bidder display
   name + amount, updating in realtime. Derived from the existing bids
   Realtime channel — no new table, no new backend.
5. **Transport: Supabase-native** (chat table + Realtime). LiveKit Data
   Channel rejected (no history, harder moderation, splits authority —
   same reasoning the MVP spec applied to bids). Third-party chat
   rejected (cost + new vendor, overkill for pilot).

## 2. Architecture

```
Streamer                    Supabase (source of truth)              Viewers
───────                    ──────────────────────────              ───────
Start/End ──► Route Handlers (service_role only) ──► rooms.status ──► Realtime ──► lobby + watch page
Camera ────► LiveKit Cloud (video only, zero bid/chat state) ──► LiveVideo (unchanged)
Chat box ──► POST /api/chat ──► chat_messages ──► Realtime ──► ChatPanel
BidForm ───► POST /api/bids (unchanged) ──► bids ──► Realtime ──► Leaderboard + BidFeed
```

Unchanged: `place_bid()` / `close_item()` RPCs, anti-sniping, orders +
mock-confirm, token minting shape. LiveKit rooms are created implicitly
by Cloud on first join — no server-side room provisioning needed.

## 3. Data model (migration on `supabase/schema.sql`)

- `rooms.status` check grows to `('lobby','preview','live','ended')`,
  default stays `'lobby'`. `GET /api/rooms` lists
  `lobby, preview, live` (preview renders a "starting soon" badge).
- `rooms.owner_id uuid references auth.users(id) on delete cascade`,
  nullable for existing rows, required on insert going forward.
  `seller_name` stays as the display string.
- New `chat_messages`: `id uuid pk`, `room_id uuid → rooms(id) cascade`,
  `user_id uuid → auth.users(id) nullable` (null = guest),
  `sender_key text not null` (auth user id or guest IP — backs the
  rate-limit check), `nickname text not null check (char_length 1..24)`,
  `body text not null check (char_length 1..200)`,
  `created_at timestamptz default now()`. Index
  `(room_id, created_at desc)` + `(room_id, sender_key, created_at desc)`.
- RLS: `chat_messages` — public read to anon + authenticated; **no**
  write policies (writes via `POST /api/chat` with service_role, same
  as bids/items). `profiles` — add public-name read policy
  (`select` to anon + authenticated, `using (true)`) so the
  leaderboard can resolve bidder names; this also exposes `reputation`,
  accepted for pilot (documented in §8).
- Enable Realtime: `alter publication supabase_realtime add table
  chat_messages` (idempotent `DO` block — skips if already a member).

## 4. Pure logic (`lib/`, vitest-covered)

- `lib/stream.ts` — `ROOM_TRANSITIONS: Record<Status, Status[]>` =
  `{ lobby: ["preview"], preview: ["live","ended"], live: ["ended"],
  ended: [] }` + `canTransition(from, to)`. Illegal transitions
  rejected in routes with 409 `illegal_transition`.
- `lib/stream.ts` — `buildRoomRow` changes status `"live"` → `"preview"`
  and takes `owner_id`.
- `lib/chat.ts` — `validateChat({nickname, body})` → `ok | invalid |
  too_long`; `isRateLimited(lastSentAtMs, nowMs)` with
  `CHAT_RATE_MS = 2000`.
- `lib/leaderboard.ts` — `topBids(bids, n=5)`: sort amount desc,
  tiebreak created_at asc, id asc (mirrors `close_item` winner order so
  rank #1 is always the would-be winner).
- `grantFor` (`app/api/livekit-token/route.ts`) changes from
  allowlist-check to owner-check: `grantFor(userId, roomOwnerId)` →
  publisher iff equal. The GET handler looks up the room's `owner_id`
  via service_role first (unknown room → 404 `not_found`); the minted
  JWT shape is unchanged, only the grant *decision* changes.
  Allowlist import removed from this route. Existing
  `tests/tokengrants.test.ts` updated to the new signature.

## 5. Route handlers

- `POST /api/rooms` — `requireUser()` only (allowlist check deleted).
  Inserts `{ title, seller_name: email, owner_id: user.id,
  status: "preview" }` via `buildRoomRow`.
- `GET /api/rooms/[id]` (new) — public; returns one room incl.
  `owner_id` + `status` so the watch page can show owner controls.
- `POST /api/rooms/[id]/go-live` (new) — owner-only (401/403/404
  otherwise); `preview → live` via `canTransition`. Idempotent: a repeat
  call when already `live` returns 200 with the current room (never 409),
  so owner double-clicks are harmless; other illegal transitions → 409
  `illegal_transition`.
- `POST /api/rooms/[id]/end` (new) — owner-only; body
  `{ mode: "settle" | "video_only", item_id?: uuid }`. For `settle` the
  route verifies `item_id` belongs to room `id` (else 404 `not_found`).
  - `video_only`: room → `ended`. Item untouched.
  - `settle`: if `item_id` given and not closed, clamp its `ends_at` to
    `now()` (owner-only update via service_role), then call
    `close_item()` — the existing RPC performs winner lock + order
    upsert idempotently. Then room → `ended`. (Direct `close_item()`
    alone would noop before `ends_at` — the clamp is the whole point.)
- `POST /api/chat` (new) — no auth required. Validates via `lib/chat`,
  resolves sender key (`user_id` or `x-forwarded-for` first IP),
  DB-backed rate check (latest message from sender key in room within
  `CHAT_RATE_MS` → 429 `rate_limited`), inserts via service_role,
  returns the row. 400 `invalid`, 413-equivalent 400 `too_long`
  (keeps the repo's `{ error }` JSON contract; no new HTTP semantics).
  Rejects with 403 `closed` when the room is `ended` (video_only end
  stops chat).
- `POST /api/items/[id]/close` — **unchanged** (still unauthenticated;
  safe because `close_item()` noops before `ends_at`).

## 6. UI (`app/[locale]/live/[roomId]/page.tsx` + components)

- Page fetches `GET /api/rooms/[id]` on mount alongside items; derives
  `isOwner` (signed-in user id === `owner_id`) and `roomStatus`.
- `components/StreamControls.tsx` (owner-only): **Start Stream** button
  when `preview` (→ go-live, then LiveVideo publishes); **End Stream**
  button when `live` → `EndStreamDialog` (neu card modal, glass
  backdrop) with the two §1-option-2 choices → `POST end`.
  Non-owners see nothing. The watch page renders a glass slate
  (`startingSoon` / `streamEnded`) in the video slot until the room is
  `live` and only mounts `LiveVideo` then; the streamer publishes via
  the existing `LiveVideo`, viewers subscribe — no `LiveVideo` changes.
- `components/ChatPanel.tsx` (all viewers incl. guests): nickname
  prompt on first send (localStorage `hobyd_nick`), message list
  (last 30, Realtime INSERT on `room_id`), input + send with inline
  retry on failure and `rate_limited` hint. Placed under the video
  column on mobile, right rail on desktop.
- `components/Leaderboard.tsx`: subscribes the **same** `bids-${itemId}`
  channel pattern as `BidFeed`; renders `topBids()` top-5 with rank,
  resolved profile name (batch `profiles` select by bidder ids,
  fallback `bidder.slice(0,8)…`), amount. Sits atop the bidding neu
  panel. `BidFeed` stays as the full recent-bids list below it.
- Lobby (`app/[locale]/page.tsx`): preview rooms render with a muted
  "starting soon" badge via existing `Badge`; no filter-logic change.
- Sell page (`app/[locale]/sell/page.tsx`): after `POST /api/rooms`
  creates the seller's preview room, listing targets that room's id
  (instead of today's first-room fallback); a **Start Stream** entry
  links the seller to `/live/[roomId]` where `StreamControls` takes
  over. Item creation itself is unchanged (allowlist check in
  `POST /api/items` is dropped alongside rooms — same
  `requireUser()`-only rule).
- New i18n keys (both `messages/en.json` + `messages/id.json`):
  `goLive, endStream, endTitle, settleAndClose, settleNote,
  videoOnly, videoOnlyNote, startingSoon, streamEnded, chatHint,
  nickname, nicknamePrompt, send, topBids, noBidsYet, rateLimited`.

## 7. Realtime channels per watch page

`items-${activeId}` (exists), `bids-${itemId}` (exists, shared by
BidFeed + Leaderboard), `chat-${roomId}` (new), `room-${roomId}`
(new, rooms UPDATE → status flips re-render controls/video slate).
Four channels max; each removed on unmount / id change following the
`BidFeed` pattern.

## 8. Error handling & edge cases

- LiveKit drop mid-stream: bidding, chat, leaderboard unaffected
  (isolation preserved); existing "reconnecting video" copy reused.
- Chat POST failure: message kept in input, inline retry; 429 shows
  `rateLimited` hint for 2s.
- Nickname collision: allowed (guests are best-effort identified by
  `user_id`/IP + timestamp); no uniqueness enforcement for pilot.
- End-`settle` racing last-second bids: anti-sniping extension may push
  `ends_at` forward — the clamp sets `ends_at = now()` **before**
  `close_item()` runs, so in-flight bids placed prior still count and
  the RPC remains the single settler (idempotent, concurrent settles
  noop via row lock).
- Room `ended` with item still live (`video_only`): watch page shows
  `streamEnded` slate over video slot; bidding panel stays fully
  functional until the item's own `ends_at` → normal close flow.
- Abandoned `preview` rooms (never started): listed as starting soon;
  cleanup (auto-expire cron) explicitly out of scope (§9).
- Public profile names (§3) expose `reputation` too — accepted for
  pilot; alternative (name-resolution route) noted if this bothers
  review.

## 9. Out of scope

Profanity/moderation tooling, streamer analytics, co-hosts, recording/
VOD, viewer counts, chat history pagination (cap 30, no scrollback),
auto-expiry of stale previews, multi-item queue management UI, push
notifications.

## 10. Acceptance

1. Any signed-in user creates room (preview) → lists item → Start
   Stream → room live in lobby; publisher publishes, guest viewer
   subscribes with zero auth.
2. Guest sets nickname, chats; messages appear on a second client
   <2s; >200 chars rejected; 2 rapid sends → second 429s.
3. Two bidders alternate; leaderboard reorders live; #1 equals
   eventual `close_item()` winner.
4. End → settle: item closes, order `pending` exists, room ended,
   winner sees pay flow. End → video_only: video/chat stop, bidding
   continues to natural close.
5. Kill LiveKit (block WS): bids + chat + leaderboard keep working.
6. `npx vitest run` + `npx tsc --noEmit` + `npm run build` green;
   ID + EN strings render, no missing-key fallback.
