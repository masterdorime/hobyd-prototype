# Mobile Whatnot layout — design spec (2026-09-23)

## Scope (approved)
Mobile (`<md`, matchMedia-driven) **viewer** layout only. Desktop untouched.
Sellers on phones keep the stacked scroll layout (they need controls, not
immersion). No right rail, no emoji, no bid-history — explicitly rejected.

## Layout (viewer, mobile)
- **Base:** the same single `LiveVideo` node goes `fixed inset-0 z-0`
  (no second instance — no double connection). Portrait `contain` is
  viewer-desktop only; mobile is full-bleed cover.
- **Top bar** (`fixed top-0 z-20`, safe-area padded): left pill = initials
  circle (from `seller_name`) + name + LIVE + duration ticking from
  `rooms.created_at`; right = viewer count (LiveKit participants via new
  `onViewers`) + countdown chip + X (`router.back()`).
- **Bottom stack** (`fixed`, above BottomNav): expiring `ChatPanel`
  `variant="overlay"` (the ONLY chat instance on mobile — desktop panel and
  leaderboard/feed are not rendered, so no topic collisions), winner pill,
  thumbnail item card (thumbnail mandatory), `BidForm` as-is.
- **Winner pill:** new `WinnerPill` component — top bid + profile name (same
  resolution pattern as Leaderboard), own `winner-<itemId>` topic. Shows when
  the active item is `closed`, hides on next activation.
- **Helpers:** `elapsedParts(ms)` in `lib/format` (tested); `watching` i18n key.

## Invariants
- One LiveVideo, one ChatPanel, one bids-subscription family per mount.
- Owner mobile = today's stacked layout (StreamControls, gate, items,
  ListItemForm all still reachable by scroll).
- Theater button hidden on mobile (theater is a desktop mode).
