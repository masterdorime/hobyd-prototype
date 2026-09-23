# Thumbnail fit, Other category, dialog portal — design spec (2026-09-24)

## Problems (all from live-fire testing)
1. Stored thumbnails are 16:9 but display surfaces cropped them differently
   (lobby `h-32`, mobile card square, aside natural-ratio) — sellers couldn't
   trust what buyers see.
2. No "Other" category — everything off-taxonomy forced into TCG etc.
3. Mobile Go Live dialog rendered cropped: BottomNav's `backdrop-blur`
   creates a containing block that traps non-portaled `fixed` descendants
   inside the nav strip.

## Changes
1. **One display aspect.** Lobby card, item card, rail thumb, mobile card,
   sales thumb, and all previews are `aspect-video object-cover` — the stored
   16:9 is shown whole everywhere, never re-cropped.
2. **`ThumbFitPreview`** (new, shared) — labeled 16:9 frame ("How buyers will
   see it") using the exact display classes. Sell page and mid-stream
   listing show it instead of the raw preview.
3. **Staged room cover.** `ThumbnailSetter` no longer uploads on pick: pick →
   validate + crop + fit preview → Upload/Cancel confirm. Keys: `thumbPreview`
   (EN+ID); `save`/`cancel` reused.
4. **"Other" category.** `CATEGORIES` + lobby tab + `filterRooms` complement
   branch (titles no hint covers, same empty-fallback) + tests. Live
   `rooms_category_check` migrated; `schema.sql` trailing section re-creates
   it idempotently.
5. **Dialog portal.** `GoLiveDialog` renders via `createPortal` to
   `document.body` (SSR-safe, post-mount) with a scrollable
   `max-h-[calc(100dvh-2rem)]` card — immune to ancestor containing blocks
   and short viewports.

## Invariants
- Crop still happens once, client-side, at accept time (`lib/image.ts`).
- No new tables/columns/env. RLS untouched.
