# Post-Modes Addenda — Design Notes (2026-09-23, chat-driven batch)

Decisions and root causes for the work that shipped between the
auction-modes plan and this doc without a dedicated spec. Each item was
approved in chat before implementation; this file preserves the reasoning
so future sessions don't re-derive it.

## 1. Owner camera publish (preview-first)

LiveVideo only subscribed. Added a `canPublish` path: local tracks are
created and previewed muted first (mic/cam toggles), publishing happens
only on explicit tap via the owner's publisher token. Viewers can never
publish. LiveKit Cloud Build ($0, 5k participant-min/month) covers the
pilot (~660 min per 1h×10-viewer stream).

## 2. Mic silence — viewer never attached audio

Seller mic published fine; the viewer's `trackSubscribed` handler only
attached video. Fixed by attaching audio tracks too (existing + late
joiners). Added `MicLevel` (AnalyserNode meter on the local audio track)
so the seller sees capture working. Lesson: when media "doesn't work",
check the far end first.

## 3. Camera failure classifier (`lib/media.ts`)

All getUserMedia failures mapped to "blocked". Now: permission denial →
blocked; missing hardware → nodevice; busy hardware → inuse; unknown →
blocked. Audio/video tracks are created independently so one missing
device doesn't kill the other; dead toggles disable themselves.

## 4. Decoupled stream vs auction

Starting the stream no longer starts bidding. Listings are created
`lobby`; `POST /api/items/[id]/start` opens bidding with the item's own
`duration_sec`; `POST /api/items/[id]/settle` force-closes early
(clamp + `close_item()`, owner-only). Bid UI, countdown, and the
auto-closer engage only on live statuses. Mid-stream multi-item listing
via `ListItemForm` (posts to the current room, activates the new item).

## 5. Camera quick capture (`CameraCapture`)

A `capture=` file input opens the folder picker on desktop — useless.
Replaced in both listing forms with an in-app modal: getUserMedia
preview (3:4 portrait frame default), front/rear toggle, shutter
center-crops a ≤900px JPEG into the existing validation/upload flow.

## 6. Thumbnails + header Go Live

`rooms.thumbnail_url` (nullable) via owner-only multipart
`POST /api/rooms/[id]/thumbnail` (same bucket/validation as items);
lobby cards render it when present. Header Go Live button (authed only)
creates a preview room and pushes to it. Single-room GET uses an
explicit column list (pinned by test).

## 7. Realtime publication outage (root cause, 2026-09-23)

Bids/items/rooms were never added to `supabase_realtime` — only
`chat_messages` was. Every realtime callback for bids/prices/status
silently never fired; the app code was correct. Fixed via idempotent
`alter publication ... add table` + recorded in schema. Rule going
forward: any new subscribed table must be added to the publication in
the same migration, and fresh setups verify with the §11 query.

## 8. Profiles (root cause, 2026-09-22)

`profiles` had 0 rows: nothing created them on signup, so every bid
failed its `bids.bidder` FK (`bid_failed`, mistaken for a money
problem — there is no balance system). Fixed with a backfill +
`on_auth_user_created` trigger (`handle_new_user`, name = email
prefix), both recorded in schema.

## 9. Email verification UX

Supabase's raw "Email not confirmed" error is now mapped to a notice
with resend (`auth.resend` type signup); signup without a session shows
"check your email" instead of silently landing on the lobby as a guest.
`isEmailNotConfirmed` + key-existence tests pin it.

## 10. Watch layout → YouTube-style side rail

Big video left (380px rail on desktop, stacked on mobile), bid card on
top, persistent scrollable chat below (auto-stick). The TikTok overlay
variant stays in `ChatPanel` but is unmounted. Fullscreen toggle on the
video box. Found while building: `catMsg` state was used but never
declared (tree had been red) — declared, green again.

## 11. Realtime channel collision (root cause)

`BidFeed` and `Leaderboard` shared the `bids-<id>` topic; supabase-js
returns one channel instance per topic, so the second `.on()` after
`subscribe()` threw. Leaderboard now uses `leaderboard-<id>`. Rule:
one topic per subscribing component, always.

## 12. Retired: `AUCTION_DURATION_SEC`, `SELLER_ALLOWLIST` (narrowed)

Durations are per-item (`duration_sec`); the env var is removed from
code, `.env.example`, and docs. The allowlist no longer gates listing
or publishing — it only lets allowlisted sellers view any order.
