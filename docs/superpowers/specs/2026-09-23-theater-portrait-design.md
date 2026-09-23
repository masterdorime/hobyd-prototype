# Theater + portrait video — design spec (2026-09-23, Section F)

## Problem
The watch page forces every stream into a 16:9 landscape box, so
portrait phone streams arrive cropped (`object-cover`). The fullscreen
button uses native Fullscreen API, which hides chat and bidding entirely.

## Decision (approved)
Orientation-aware video box + a theater overlay that replaces native
fullscreen. No new backend, no new columns.

## Changes
1. `LiveVideo` gains two optional props:
   - `onVideoSize(w, h)` — fired from `loadedmetadata`/`resize` on every
     attached `<video>` (viewer remote tracks + publisher preview).
   - `contain` — swaps the frame to `aspect-[9/16]` + `object-contain`.
   - `fill` — `h-full` chain so the frame fills the theater box.
2. Watch page keeps `vidPortrait` state (`h > w` from the callback, reset on
   `roomId` change). Portrait box: `mx-auto aspect-[9/16] h-[75dvh]` so the
   phone frame is shown whole, never cropped.
3. Theater replaces native fullscreen: the **same video box DOM node** becomes
   `fixed inset-0 z-50` (no remount → no LiveKit reconnect, publisher tracks
   survive). LIVE badge, countdown, and the toggle button stay visible;
   chat/bidding wait behind until exit. Escape exits. Button keeps its icon,
   aria-label becomes the new `theaterMode` key (EN + ID).
4. `isFs` / `boxRef` / Fullscreen API listeners are removed.

## Invariants
- Landscape behavior byte-for-byte unchanged (aspect-video + object-cover).
- No second LiveVideo instance anywhere (would double viewer connections and
  steal the publisher camera — the one-topic-per-component rule's cousin).
- Reduced-motion and overlay layout untouched.
