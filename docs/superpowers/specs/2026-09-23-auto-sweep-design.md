# Auto-erase abandoned streams — design spec (2026-09-23)

## Decisions (approved)
- TTL: **10 minutes**.
- **Preview** rooms older than 10 min → **deleted** (order-free by
  construction: orders only exist via settle/close, which reject lobby items).
- **Live** rooms older than 10 min with **zero LiveKit participants** →
  flipped to **ended**, NOT deleted (deletion would cascade into items, bids,
  and payment orders).
- No cron: a lazy sweep rides on `GET /api/rooms` (every lobby visit).
  Fail-open — any sweep error is swallowed, the lobby always loads.

## Changes
1. `lib/sweep.ts` — `STALE_MS = 10 * 60_000`; pure `isStale(createdAt, nowMs,
   ttlMs)` (tested).
2. `GET /api/rooms` — before returning, sweeps: delete stale previews; for
   stale live rooms, `RoomServiceClient.listParticipants` (livekit-server-sdk
   is already installed, creds in env) → empty ends the room. A LiveKit
   `not_found` means nobody ever joined → also ends; any other error skips.
3. i18n: none (silent janitor, no UI).

## Invariants
- Sweep never deletes a room that could hold orders (only previews die).
- Sweep never breaks or slows the lobby materially (single cheap query for
  previews; LiveKit calls only for live rooms past TTL, which are rare).
