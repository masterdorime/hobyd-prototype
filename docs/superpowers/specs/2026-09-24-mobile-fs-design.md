# Mobile portrait streaming + landscape fullscreen — design spec (2026-09-24)

## Problems (live-fire on phones)
1. Mobile sellers got a small cramped 16:9 camera panel plus overlapping
   badges, while holding the phone portrait.
2. Mobile viewers of landscape (desktop) streams had no way to maximize —
   the portrait stack letterboxed the video with no landscape option.

## Decisions (approved)
- Seller panel: tall portrait 9:16, controls below. No full-bleed.
- Landscape maximize: **true Fullscreen API** + rotate prompt (not an
  in-page overlay). Bid card top-right, chat bottom-right, YouTube-live
  style. `too_large` photo rejects stay as-is.

## Changes
1. `LiveVideo` gains:
   - `previewPortrait` — publisher preview becomes
     `aspect-[9/16] max-h-[55dvh]` on mobile-owner mounts.
   - `audioMuted` — viewer tracks attached audio elements and mutes them on
     demand (no double audio, see 3).
2. Watch page:
   - Box overlay badges gated `!isOwner` (LiveVideo already badges the
     owner view — this also fixes the overlapping pills).
   - Maximize button on mobile-viewer landscape streams only (known
     landscape via `vidKnown && !vidPortrait`, live status).
   - Fullscreen overlay (`fsOpen`): fixed full-viewport black, header
     (LIVE + countdown + X), body row with second viewer `LiveVideo` left
     and 300px rail right (mini bid card, BidForm/result states, panel
     chat). `requestFullscreen` attempted; older iOS falls back to the
     fixed overlay, which still covers the viewport.
   - Rotate hint when `orientation: portrait` while open. ESC / OS gesture
     exits natively and resyncs state via `fullscreenchange`.
3. Subscription discipline: the fs overlay mounts a second viewer LiveVideo
   (underlying instance stays connected but `audioMuted` — instant
   open/close, no reconnect blips) while the underlying stack chat unmounts
   (`!fsOpen` gate) so `chat-*` is never double-subscribed. No WinnerPill in
   the overlay (underlying instance is the only one). BidForm is
   subscription-free, safe to duplicate.
4. Keys: `maximize`, `rotatePhone` (EN+ID).

## Invariants
- Portrait streams on mobile: unchanged full-bleed stack.
- Desktop (theater included): untouched. Theater button stays hidden on
  mobile; maximize stays hidden on desktop.
