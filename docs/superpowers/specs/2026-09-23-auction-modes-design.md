# Auction Modes + Category Gate + Mobile Nav — Design Spec (2026-09-23)

Per-item SOFT_CLOSE/HARD_CLOSE bidding, seller-chosen categories and
durations, and a mobile overflow fix with bottom navigation. LiveKit,
chat, leaderboard, and settlement flows are untouched.

## 1. Locked decisions

1. **Mode control: seller per item.** Mode picker on every listing form
   (mid-stream + Sell page), default SOFT_CLOSE. Stored on the item;
   applies to that item's whole run.
2. **Duration: preset chips + custom input.** 15s / 30s / 60s chips with
   30s preselected, plus a custom seconds field clamped 10–300.
3. **Categories: spec set.** Sneakers, TCG, Vintage Clothing,
   Electronics. Lobby filter tabs switch to exactly this set.
4. **Mobile nav: bottom nav.** Icon bar under 768px (Discover, Go Live,
   Sell, Account); desktop header untouched; mobile top bar shrinks to
   wordmark + locale toggle.
5. **Window/add stay global.** `EXTENSION_WINDOW_SEC` /
   `EXTENSION_ADD_SEC` env (default 10/10, current behavior). Only mode
   + duration vary per item.

## 2. Architecture

```
Listing form (mode toggle + duration chips/custom)
  → POST /api/items {mode, duration_sec} → validated → items row (lobby)
Start bid → POST /api/items/[id]/start → ends_at = now + duration_sec
Bid → POST /api/bids → place_bid(p_mode) → extends iff soft ∧ in-window
Go-live gate → rooms.category null ⇒ bid controls disabled (video live)
Lobby filter → new 4-category hint map
Mobile → overflow root fix + BottomNav component (<md only)
```

Unchanged: `close_item()`, settle/end routes, LiveKit grants, chat,
leaderboard, orders, auth, RLS-deny-writes (all writes via service_role
route handlers).

## 3. Data model (migration, appended to `supabase/schema.sql`)

- `items.auction_mode text not null default 'soft'`
  `check (auction_mode in ('soft','hard'))`.
- `items.duration_sec int not null default 30`
  `check (duration_sec between 10 and 300)`.
- `rooms.category text check (category in
  ('Sneakers','TCG','Vintage Clothing','Electronics'))`, nullable.
  Null = gate closed (see §5). Existing rooms stay null until the
  seller picks (backfill not required; old rooms simply can't open new
  bids until categorized — documented in SETUP note).
- RLS: no new policies (writes already service_role-only; reads already
  public). No Realtime changes (items/rooms already in publication).

## 4. Pure logic (`lib/`, vitest-covered)

- `lib/auction.ts` — `buildStartUpdate(nowMs, durationSec)` unchanged
  (already takes duration; callers pass the item's value).
- `lib/auction.ts` — `decideBidOutcome({ timeLeftMs, windowMs, addMs,
  mode })` → `"maintain" | "extend" | "reject"`: hard always
  maintain-while-open (never extend); soft extends iff
  `0 <= timeLeftMs < windowMs` (mirrors the 0.1s–window inclusive rule
  at ms precision; at/after zero the bid path never runs — close wins).
- `lib/auction.ts` — `validateListing({ mode, durationSec })` →
  `ok | invalid_mode | invalid_duration`. Chips constrain the UI;
  this guards hostile clients.
- `app/api/bids/route.ts` — `decideExtension()` gains a `mode` param:
  hard returns `{ extend: false }` without reading the clock.
- `lib/rooms.ts` — `CATEGORIES = ["Sneakers","TCG","Vintage
  Clothing","Electronics"] as const` + `isCategory(v: unknown)` guard;
  `filterRooms` hint map rebuilt for the new set (sneakers: sneaker,
  nike, jordan, dunk; tcg: pokemon, tcg, charizard, pikachu, gengar;
  vintage clothing: vintage, clothing, jacket, denim; electronics:
  electronics, phone, laptop, camera, console).

## 5. Route handlers

- `POST /api/items` — accepts `mode` + `duration_sec`; validates via
  `validateListing` (400 `invalid_mode` / `invalid_duration`);
  `buildItemRow` stores both (status stays `lobby`).
- `POST /api/items/[id]/start` — unchanged except the fresh timer uses
  the row's `duration_sec` instead of `env.auctionSecs()`.
- `POST /api/items/[id]/settle`, close, end routes — unchanged
  (mode-independent settlement; hard-close items end by timer or owner).
- `POST /api/rooms/[id]/category` (new) — owner-only; body
  `{ category }`; `isCategory` else 400 `invalid`; returns the room.
  Powers the gate picker. (Sub-route POST matches the go-live/end
  house style for owner actions.)
- `POST /api/rooms/[id]/go-live` — unchanged (video may start
  category-less; §6 gates bidding, not video).
- `place_bid(p_item_id, p_bidder, p_amount, p_max_extensions, p_mode)` —
  new `p_mode text` arg; the anti-sniping block (SELECT..FOR UPDATE
  already held) is skipped when `p_mode = 'hard'`. `revoke`/`grant`
  lines updated for the 5-arg signature. Old 4-arg calls fail loudly
  (fail-closed, per I3) — the only caller is updated in the same task.

## 6. UI

- **Listing forms** (`ListItemForm` + sell page): mode toggle (Soft /
  Sudden-death two-option segmented control, soft preselected) +
  duration chips (15/30/60, 30 preselected) + custom seconds input
  (10–300, clamps on blur). Submitted with the existing multipart
  POST. New i18n keys: `auctionMode, softClose, hardClose,
  softNote ("Bids in the last seconds extend the clock."),
  hardNote ("The clock never moves. Last bid wins."),
  duration, customSeconds`.
- **Category gate** (live page, owner-only): when `room.category ==
  null`, a neu card replaces `StreamControls` + bid controls:
  four category buttons → `POST category` → room updates via existing
  `room-${roomId}` subscription. Video/camera/stream controls stay
  live. outright: no category ⇒ no Start-bid buttons anywhere
  (list buttons hidden, not just disabled — a disabled button with no
  explanation is worse). New keys: `pickCategory
  ("Pick a category to open bidding."), categorySet`.
- **Items list**: per-row mode badge (`soft`/`hard`, muted tone) next
  to the status badge so viewers know the rules before bidding.
- **BottomNav** (`components/BottomNav.tsx`, `md:hidden`): fixed
  bottom bar, safe-area padding, 4 tabs ≥48px targets —
  Discover (`/{locale}`), Go Live (center accent; authed only, same
  POST-then-push as header; guests see Log in), Sell
  (`/{locale}/sell`), Account (email + Sign out via existing
  `browserDb` session read). Active-tab highlight from pathname.
  `aria-label` + `aria-current` on tabs.
- **Header on mobile**: wordmark + locale toggle only (Sell, Go Live,
  email, Sign out move to BottomNav). Desktop header byte-identical.
  Implementation: `hidden md:flex` on the action group; BottomNav
  `md:hidden`.
- **Overflow root fix** (`app/globals.css`): `html, body {
  overflow-x: hidden; max-width: 100vw; }` + app wrapper keeps
  `w-full max-w-6xl` (no fixed-pixel containers introduced anywhere;
  audit in Task: `grep -rn "w-\[[0-9]" app components` must return
  only the intentional 900px canvas cap in CameraCapture).
- **360px sweep**: countdown chip, bid panel, chat input row, leaderboard
  rows, both modals (end-stream, camera) render without clipping at
  360×740. Camera modal is already `max-w-sm + p-4`; verify, don't
  restyle.

## 7. Realtime (already compliant — verify, don't build)

Bids, items, rooms, chat already broadcast over Supabase Realtime with
no page refreshes anywhere in the app. Acceptance pins it: open two
windows, bid in one, observe sub-second update in the other — for soft
extend, hard accept, start, settle, and category pick alike.

## 8. Error handling & edge cases

- Hostile `mode`/`duration_sec` in POST body → 400 before any write.
- `start` on already-live item → 200 idempotent (existing behavior).
- `settle` on lobby item → 409 (existing); on hard-close item →
  normal clamp + `close_item` (owner escape hatch preserved).
- Hard-close last-second bid: accepted if `now <= ends_at` inside the
  txn (RULESET 2 boundary); `close_item` remains the single settler.
- Category POST by non-owner → 403; invalid value → 400; room
  not found → 404 (matches house style).
- BottomNav Go Live failure (no session mid-tap) → stays put; header
  Go Live keeps its current silent behavior (parked item, unchanged).
- `duration_sec` backfill: existing items get 30 (column default);
  existing rooms get null category (gate closed until picked).

## 9. Out of scope

Per-room default mode, per-category durations, changing window/add per
item, countdown progress bars, bid history export, category editing
after first bid (PATCH allowed anytime in pilot — relabel risk
accepted), push notifications, desktop nav changes.

## 10. Acceptance

1. List with Soft/20s custom → start → bid at 3s left → clock +10s
   (env defaults); same on Hard → clock unmoved, bid accepted.
2. Bid at 0.0s on either mode → rejected (closed path wins the race).
3. Hostile POSTs (`mode=turbo`, `duration_sec=5`, `duration_sec=9999`)
   → 400, nothing written.
4. Category-less room: video publishes, Start-bid buttons absent;
   pick Vintage Clothing → buttons appear, lobby shows room under
   Vintage Clothing tab.
5. Two windows: every mutation above reflects in <2s, no refresh.
6. 360px viewport: no horizontal scroll on lobby/live/sell/login;
   bottom nav fully tappable, 48px targets, no overlap.
7. `npx vitest run` + `npx tsc --noEmit` + `npm run build` green;
   ID + EN render, no missing-key fallback.
