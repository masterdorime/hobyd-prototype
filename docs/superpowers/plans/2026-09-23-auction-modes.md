# Auction Modes + Category Gate + Mobile Nav Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Per-item Soft/Hard-close bidding with seller durations, a category gate before bidding, and a mobile overflow fix with bottom navigation.

**Architecture:** Two new item columns + one room column drive everything; `place_bid()` branches on mode (7-arg signature); listing/start routes validate and stamp; live page gates bid controls on category; a new `BottomNav` owns <768px navigation while the desktop header is byte-identical.

**Tech Stack:** Next.js 16.3.5 App Router + TypeScript, Supabase Postgres (+RLS, Realtime), next-intl (ID+EN), Tailwind v4, motion, vitest 5.

**Spec:** `docs/superpowers/specs/2026-09-23-auction-modes-design.md`

## Global Constraints

- RLS denies client writes: no insert/update/delete policies for anon/authenticated; every write goes through a Route Handler using `adminDb()` (service_role).
- Route `params` is a Promise: `const { id } = await ctx.params` (see `app/api/items/[id]/start/route.ts:10`).
- Every user-facing string needs both `messages/en.json` and `messages/id.json` keys; never hardcode copy.
- New UI follows the glass + neu hybrid (`glass-panel`, `NeuCard`, `Badge`, `pressable`, `tnum`); motion uses `motion/react` with `useReducedMotion` fallback.
- Pure logic lives in `lib/` with vitest coverage; `npx vitest run` from the worktree root.
- Verify each task with `npx tsc --noEmit`; final gate is `npx vitest run` + `npx tsc --noEmit` + `npm run build` all green.
- DB migrations are appended to `supabase/schema.sql`; the **controller** applies them to the live project via Supabase MCP and verifies columns/signatures — implementers never touch the live DB.

## Review Focus

- Hostile `POST /api/items` with `mode: "turbo"` or `duration_sec: 5` → 400, nothing written. Pinned in Task 3 (route code + curl smoke with exact bodies).
- Bid arriving exactly at `ends_at` on HARD → rejected (close path wins; no extension, no acceptance). Pinned in Task 2 (`decideBidOutcome` boundary test at `timeLeftMs: 0`).
- Category-less room: Start-bid buttons must be absent from the DOM, not merely disabled. Pinned in Task 4 (conditional render, verified in browser pass Task 6).
- Custom duration `301` / `9` in the form → clamped to 300 / 10 on blur, never submitted out of range. Pinned in Task 4 (clamp code + manual check Task 6).
- BottomNav Go Live tapped with no session → stays put, no throw, no navigation. Pinned in Task 5 (guard code + browser pass Task 6).

---

### Task 1: Migration SQL (items mode/duration, rooms.category, place_bid branches on mode)

**Files:**
- Modify: `supabase/schema.sql` (append one section at end)
- Modify: `docs/SETUP.md` (note: existing items get soft/30; existing rooms get null category = gate closed until picked)

**Interfaces:**
- Consumes: nothing.
- Produces: `items.auction_mode`, `items.duration_sec`, `rooms.category`, 7-arg `place_bid()` — consumed by Tasks 3–4. Controller applies via MCP after merge and verifies before Task 3 starts.

- [ ] **Step 1: Append the migration SQL**

```sql
-- 2026-09-23 auction modes + category gate.
alter table items add column if not exists auction_mode text not null default 'soft'
  check (auction_mode in ('soft','hard'));
alter table items add column if not exists duration_sec int not null default 30
  check (duration_sec between 10 and 300);
alter table rooms add column if not exists category text
  check (category in ('Sneakers','TCG','Vintage Clothing','Electronics'));

create or replace function place_bid(p_item_id uuid, p_bidder uuid, p_amount int, p_max_extensions int, p_mode text, p_window_secs int, p_add_secs int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_item items%rowtype;
  v_bid bids%rowtype;
  v_extended boolean := false;
begin
  if p_item_id is null or p_bidder is null or p_amount is null or p_amount <= 0 then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;
  if p_max_extensions is null or p_max_extensions < 0 then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;
  if p_mode is null or p_mode not in ('soft','hard') then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;
  if p_window_secs is null or p_window_secs < 0 or p_add_secs is null or p_add_secs < 0 then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;

  perform pg_advisory_xact_lock(hashtext(p_item_id::text));

  select * into v_item from items where id = p_item_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'closed');
  end if;
  if v_item.status = 'closed' or v_now > v_item.ends_at then
    return jsonb_build_object('ok', false, 'error', 'closed');
  end if;
  if p_amount <= v_item.current_price then
    return jsonb_build_object('ok', false, 'error', 'too_low');
  end if;
  if exists (select 1 from bids
             where item_id = p_item_id and bidder = p_bidder
               and created_at > v_now - interval '1 second') then
    return jsonb_build_object('ok', false, 'error', 'rate_limited');
  end if;

  insert into bids (item_id, bidder, amount)
  values (p_item_id, p_bidder, p_amount)
  returning * into v_bid;

  -- Anti-sniping runs ONLY in soft mode (hard close: clock never moves).
  if p_mode = 'soft'
     and v_item.ends_at - v_now >= interval '0 seconds'
     and v_item.ends_at - v_now < make_interval(secs => p_window_secs)
     and v_item.extensions_used < p_max_extensions then
    v_extended := true;
    update items set
      current_price = p_amount,
      ends_at = v_item.ends_at + make_interval(secs => p_add_secs),
      extensions_used = v_item.extensions_used + 1,
      status = 'extended'
    where id = p_item_id;
  else
    update items set current_price = p_amount where id = p_item_id;
  end if;

  return jsonb_build_object('ok', true, 'bid', row_to_json(v_bid), 'extended', v_extended);
end;
$$;

revoke all on function place_bid(uuid, uuid, int, int, text, int, int) from public, anon, authenticated;
grant all on function place_bid(uuid, uuid, int, int, text, int, int) to service_role;
```

- [ ] **Step 2: Extend `docs/SETUP.md`**

Add: existing items backfill to soft/30 via column defaults (no manual
step); existing rooms get null category — seller picks on the live page
before bidding opens; no RLS/Realtime changes needed.

- [ ] **Step 3: Verify diff-only**

Run: `git diff supabase/schema.sql docs/SETUP.md` — append-only SQL,
no existing statement touched. (Controller applies via MCP + verifies
`auction_mode`/`duration_sec`/`category` columns and the 7-arg
signature before Task 3.)

- [ ] **Step 4: Commit**

```bash
git add supabase/schema.sql docs/SETUP.md
git commit -m "feat: schema for auction modes and category gate"
```

---

### Task 2: Pure auction logic (mode outcome, listing validation, categories)

**Files:**
- Modify: `lib/auction.ts` (add `decideBidOutcome`, `validateListing`)
- Modify: `lib/rooms.ts` (`CATEGORIES`, `isCategory`, rebuilt `filterRooms` hints)
- Create: `tests/auction-modes.test.ts`
- Modify: `tests/sell.test.ts` (extend `validateSellInput` cases — read file first, keep existing cases)
- Modify: `tests/engine.test.ts` (extend `decideExtension` with mode — read file first)

**Interfaces:**
- Consumes: nothing.
- Produces: `decideBidOutcome(o): "maintain"|"extend"|"reject"`, `validateListing(o): {ok}|{ok:false,error:"invalid_mode"|"invalid_duration"}`, `CATEGORIES`, `isCategory(v): v is Category` — consumed by Tasks 3–4. `decideExtension` in `app/api/bids/route.ts` gains a `mode` field (Task 3 updates route + this test).

- [ ] **Step 1: Write the failing tests `tests/auction-modes.test.ts`**

```ts
import { buildStartUpdate, decideBidOutcome, validateListing } from "../lib/auction";
import { CATEGORIES, isCategory } from "../lib/rooms";

test("soft extends inside the window", () => {
  expect(decideBidOutcome({ timeLeftMs: 3000, windowMs: 10_000, addMs: 10_000, mode: "soft" })).toBe("extend");
});

test("soft maintains outside the window", () => {
  expect(decideBidOutcome({ timeLeftMs: 30_000, windowMs: 10_000, addMs: 10_000, mode: "soft" })).toBe("maintain");
});

test("at-zero never extends (close wins the race)", () => {
  expect(decideBidOutcome({ timeLeftMs: 0, windowMs: 10_000, addMs: 10_000, mode: "soft" })).toBe("reject");
  expect(decideBidOutcome({ timeLeftMs: 0, windowMs: 10_000, addMs: 10_000, mode: "hard" })).toBe("reject");
});

test("hard never extends, accepts while open", () => {
  expect(decideBidOutcome({ timeLeftMs: 3000, windowMs: 10_000, addMs: 10_000, mode: "hard" })).toBe("maintain");
  expect(decideBidOutcome({ timeLeftMs: -5, windowMs: 10_000, addMs: 10_000, mode: "hard" })).toBe("reject");
});

test("validateListing guards hostile input", () => {
  expect(validateListing({ mode: "soft", durationSec: 30 })).toEqual({ ok: true });
  expect(validateListing({ mode: "hard", durationSec: 300 })).toEqual({ ok: true });
  expect(validateListing({ mode: "turbo", durationSec: 30 })).toEqual({ ok: false, error: "invalid_mode" });
  expect(validateListing({ mode: "soft", durationSec: 5 })).toEqual({ ok: false, error: "invalid_duration" });
  expect(validateListing({ mode: "soft", durationSec: 9999 })).toEqual({ ok: false, error: "invalid_duration" });
});

test("category set is exactly the spec four", () => {
  expect([...CATEGORIES]).toEqual(["Sneakers", "TCG", "Vintage Clothing", "Electronics"]);
  expect(isCategory("TCG")).toBe(true);
  expect(isCategory("Pokemon")).toBe(false);
  expect(isCategory(null)).toBe(false);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/auction-modes.test.ts`
Expected: FAIL with "does not provide export named 'decideBidOutcome'" (and `CATEGORIES`).

- [ ] **Step 3: Implement in `lib/auction.ts`** (keep existing `buildStartUpdate` untouched)

```ts
// Bid outcome classes: maintain (accept, clock untouched), extend
// (accept + clock += add), reject (too late — closer wins).
export type BidOutcome = "maintain" | "extend" | "reject";

export function decideBidOutcome(o: {
  timeLeftMs: number;
  windowMs: number;
  addMs: number;
  mode: string;
}): BidOutcome {
  void o.addMs;
  if (o.timeLeftMs < 0) return "reject";
  if (o.timeLeftMs === 0) return "reject";
  if (o.mode === "hard") return "maintain";
  if (o.mode === "soft" && o.timeLeftMs < o.windowMs) return "extend";
  return "maintain";
}

export function validateListing(o: { mode: unknown; durationSec: unknown }): {
  ok: boolean;
  error?: string;
} {
  if (o.mode !== "soft" && o.mode !== "hard")
    return { ok: false, error: "invalid_mode" };
  if (!Number.isInteger(o.durationSec) || (o.durationSec as number) < 10 || (o.durationSec as number) > 300)
    return { ok: false, error: "invalid_duration" };
  return { ok: true };
}
```

- [ ] **Step 4: Categories in `lib/rooms.ts`** (keep `filterRooms` signature; rebuild hints)

```ts
export const CATEGORIES = ["Sneakers", "TCG", "Vintage Clothing", "Electronics"] as const;
export type RoomCategory = (typeof CATEGORIES)[number];

export function isCategory(v: unknown): v is RoomCategory {
  return typeof v === "string" && (CATEGORIES as readonly string[]).includes(v);
}

export type Category = "all" | "sneakers" | "tcg" | "vintage" | "electronics";

const HINTS: Record<Exclude<Category, "all">, string[]> = {
  sneakers: ["sneaker", "nike", "jordan", "dunk"],
  tcg: ["pokemon", "tcg", "charizard", "pikachu", "gengar"],
  vintage: ["vintage", "clothing", "jacket", "denim"],
  electronics: ["electronics", "phone", "laptop", "camera", "console"],
};
```

Keep `filterRooms(rooms, cat)` logic identical, only the hint map +
`Category` union change. Check `app/[locale]/page.tsx` CATS usage —
the lobby tab update is Task 4; this task only changes lib + its own
tests. Existing `tests/rooms.test.ts` category expectations WILL break
(pokemon/diecast/sneakers) — update those cases to the new set in this
task (same commit).

- [ ] **Step 5: Extend `decideExtension` tests** in `tests/engine.test.ts`

`decideExtension` keeps its shape; the route change is Task 3. Add
here only a comment-pointer? No — implement the mode param NOW in
`app/api/bids/route.ts` (3-line change, co-located with its test):

```ts
export function decideExtension(o: { endsAtMs: number; nowMs: number; used: number; max: number; mode?: string }) {
  if (o.mode === "hard") return { extend: false, newEndsAtMs: o.endsAtMs };
  const delta = o.endsAtMs - o.nowMs;
  const extend = delta >= 0 && delta < 10_000 && o.used < o.max;
  return { extend, newEndsAtMs: extend ? o.endsAtMs + 10_000 : o.endsAtMs };
}
```

Plus tests: hard in-window → `{ extend: false }`; soft cases from the
existing file keep passing unchanged.

- [ ] **Step 6: Run + typecheck**

Run: `npx vitest run tests/auction-modes.test.ts tests/engine.test.ts tests/rooms.test.ts tests/sell.test.ts tests/auction.test.ts`
Expected: PASS.
Run: `npx tsc --noEmit`
Expected: clean. (Lobby page still imports old `Category` values —
`filterRooms` signature is unchanged so it compiles; tab update is
Task 4.)

- [ ] **Step 7: Commit**

```bash
git add lib/auction.ts lib/rooms.ts app/api/bids/route.ts tests/auction-modes.test.ts tests/engine.test.ts tests/rooms.test.ts tests/sell.test.ts
git commit -m "feat: auction mode outcome, listing validation, categories"
```

---

### Task 3: Routes (listing mode/duration, start uses duration, bid passes mode, category PATCH, env)

**Files:**
- Modify: `lib/env.ts` (add `extensionWindowSecs`, `extensionAddSecs` with `"10"` fallback — NOT required vars)
- Modify: `.env.example` (document the two overrides)
- Modify: `app/api/items/route.ts` (`buildItemRow` stores `auction_mode` + `duration_sec`; POST validates via `validateListing`)
- Modify: `app/api/items/[id]/start/route.ts` (select `duration_sec`; timer from row, not env)
- Modify: `app/api/bids/route.ts` (read item `auction_mode`; pass `p_mode`/window/add to rpc; extend `decideExtension` call with mode)
- Create: `app/api/rooms/[id]/category/route.ts` (owner-only `{ category }` → validated update)
- Test: extend `tests/items.test.ts` (`buildItemRow` stores mode/duration)

**Interfaces:**
- Consumes: `validateListing`, `buildStartUpdate`, `isCategory`, `isUuid`, `adminDb`, `requireUser` (Tasks 1–2); 7-arg `place_bid` live (controller applies Task 1 SQL before this task starts — the dispatch carries confirmation).
- Produces: `{error: invalid_mode|invalid_duration}`, start timer from row, mode-aware bids, `POST→{category}` room update — consumed by Task 4.

- [ ] **Step 1: `lib/env.ts` additions** (fallback, never throws)

```ts
extensionWindowSecs: () =>
  parseInt(process.env.EXTENSION_WINDOW_SEC ?? "10", 10),
extensionAddSecs: () =>
  parseInt(process.env.EXTENSION_ADD_SEC ?? "10", 10),
```

`.env.example`: append commented lines
`# EXTENSION_WINDOW_SEC=10` / `# EXTENSION_ADD_SEC=10` with a one-line
comment (soft-close trigger window / added seconds).

- [ ] **Step 2: `buildItemRow` + POST validation** in `app/api/items/route.ts`

```ts
export function buildItemRow(
  input: { room_id: string; title: string; img_url: string; start_price: number; mode: string; duration_sec: number },
  nowMs: number,
) {
  return {
    room_id: input.room_id, title: input.title, img_url: input.img_url,
    start_price: input.start_price, current_price: input.start_price,
    ends_at: new Date(nowMs + (input.duration_sec as number) * 1000).toISOString(),
    extensions_used: 0, status: "lobby",
    auction_mode: input.mode, duration_sec: input.duration_sec,
  };
}
```

POST (both JSON + multipart paths converge on `input`): after the
existing shape checks, run `validateListing({ mode: body?.mode ??
"soft", durationSec: Number(body?.duration_sec ?? 30) })` → 400
`invalid_mode` / `invalid_duration`. For multipart, read
`fd.get("mode")` / `fd.get("duration_sec")` with the same defaults.
Pass `Date.now()` (drop the `durationSec`/`auctionSecs` arg — update
the one call site + `tests/items.test.ts` to the new signature).

- [ ] **Step 3: Start route uses the row's duration**

In `app/api/items/[id]/start/route.ts`: change select to
`"id,room_id,status,duration_sec"`; replace
`buildStartUpdate(Date.now(), env.auctionSecs())` with
`buildStartUpdate(Date.now(), (it as { duration_sec: number }).duration_sec)`.
Drop the now-unused `env` import if nothing else uses it in that file.

- [ ] **Step 4: Bids route passes mode + window/add**

After auth/body checks, fetch the item's mode (fail-soft matches the
column default):
```ts
const { data: itemRow } = await db.from("items").select("auction_mode").eq("id", item_id).single();
const mode = (itemRow as { auction_mode?: string } | null)?.auction_mode === "hard" ? "hard" : "soft";
const { data, error } = await db.rpc("place_bid", {
  p_item_id: item_id,
  p_bidder: user.id,
  p_amount: amount,
  p_max_extensions: env.maxExtensions(),
  p_mode: mode,
  p_window_secs: env.extensionWindowSecs(),
  p_add_secs: env.extensionAddSecs(),
});
```
Unknown/missing mode fails soft (matches column default). Update the
file's `decideExtension` call-site if it has one (it defines the
function; no internal call — no change needed beyond Task 2).

- [ ] **Step 5: Create `app/api/rooms/[id]/category/route.ts`**

```ts
// Owner-only category set (opens the bidding gate).
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth";
import { isUuid } from "@/lib/stream";
import { isCategory } from "@/lib/rooms";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!isUuid(id)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!isCategory(body?.category))
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  const db = adminDb();
  const { data: room } = await db.from("rooms").select("owner_id").eq("id", id).single();
  if (!room) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if ((room as { owner_id: string | null }).owner_id !== user.id)
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { data, error } = await db.from("rooms").update({ category: body.category }).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: "update_failed" }, { status: 500 });
  return NextResponse.json(data);
}
```

- [ ] **Step 6: Curl smokes (dev running) + typecheck**

`POST /api/items` with `{"mode":"turbo",...}` → 400 `invalid_mode`;
`duration_sec: 5` → 400 `invalid_duration` (authed; unauth → 401 first
— assert the 401 path too). `POST /api/rooms/<uuid>/category`
malformed id → 404; no session → 401.
Run: `npx tsc --noEmit` — Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add lib/env.ts .env.example app/api/items/route.ts "app/api/items/[id]/start/route.ts" app/api/bids/route.ts "app/api/rooms/[id]/category/route.ts" tests/items.test.ts
git commit -m "feat: mode-aware listing, start, bids, category set routes"
```

---

### Task 4: Listing forms, category gate, lobby tabs, mode badges, i18n

**Files:**
- Modify: `components/ListItemForm.tsx` (mode toggle + duration chips/custom)
- Modify: `app/[locale]/sell/page.tsx` (same controls)
- Modify: `app/[locale]/live/[roomId]/page.tsx` (gate picker, hide start buttons when uncategorized, mode badges)
- Modify: `app/[locale]/page.tsx` (CATS → new set)
- Modify: `messages/en.json`, `messages/id.json`

**Interfaces:**
- Consumes: `CATEGORIES`, `isCategory` (Task 2); routes (Task 3); room `category` via `GET /api/rooms/[id]` (add to room state).
- Produces: full UX per spec §6 — verified in Task 6 browser pass.

- [ ] **Step 1: Shared picker snippet** (duplicate in both forms — 30 lines, precedent: file/camera pickers already duplicate)

Mode segmented control (soft preselected) + chips 15/30/60 (30
preselected) + custom input (clamp 10–300 onBlur):

```tsx
const [mode, setMode] = useState<"soft" | "hard">("soft");
const [duration, setDuration] = useState(30);
const [custom, setCustom] = useState("");

// chips row:
{[15, 30, 60].map((s) => (
  <button key={s} type="button" onClick={() => { setDuration(s); setCustom(""); }}
    aria-pressed={custom === "" && duration === s}
    className={cn("pressable rounded-full border px-3 py-1 text-xs",
      custom === "" && duration === s ? "border-accent/60 bg-accent/10 font-semibold" : "border-white/15")}>
    {s}s
  </button>
))}
// custom input:
<FieldInput value={custom} inputMode="numeric" type="number" min={10} max={300}
  placeholder={t("customSeconds")}
  onChange={(e) => setCustom(e.target.value)}
  onBlur={() => {
    const n = Number(custom);
    if (!custom) return;
    const clamped = Number.isFinite(n) ? Math.min(300, Math.max(10, Math.floor(n))) : 30;
    setCustom(String(clamped));
    setDuration(clamped);
  }} />
```

Effective duration helper (inline in each form):
```ts
const effDuration = custom === "" ? duration : Number(custom);
```
Submit includes `mode` + `duration_sec: effDuration` (FormData:
`fd.set("mode", mode); fd.set("duration_sec", String(effDuration));`).

- [ ] **Step 2: Category gate on the live page**

Room state gains `category: string | null` (extend the fetch mapper).
Owner-only, when `room.category == null`, render a neu card REPLACING
`StreamControls` + start buttons (video/camera stay live):

```tsx
{isOwner && room && room.category == null ? (
  <NeuCard className="flex flex-col gap-2 p-4">
    <p className="text-sm">{t("pickCategory")}</p>
    <div className="flex flex-wrap gap-2">
      {CATEGORIES.map((c) => (
        <button key={c} type="button" onClick={() => pickCategory(c)}
          className="pressable rounded-full border border-white/15 px-3 py-1 text-xs">
          {c}
        </button>
      ))}
    </div>
  </NeuCard>
) : (
  isOwner && room && <StreamControls ... />
)}
```

`pickCategory`: `POST /api/rooms/${roomId}/category { category }` →
on ok `setRoom(r => r && ({ ...r, category }))` (Realtime UPDATE also
arrives — idempotent). Import `CATEGORIES` from `@/lib/rooms`.
Start-bid buttons render only when `room.category != null`
(`{isOwner && room?.category != null && i.status === "lobby" && ...}`).

- [ ] **Step 3: Mode badges + lobby tabs**

Item rows: after the status badge line add
`<Badge tone="muted">{i.status === undefined ? "" : (i as { auction_mode?: string }).auction_mode === "hard" ? t("hardClose") : t("softClose")}</Badge>`
(No — write it plainly; items from GET include `auction_mode` after
Task 3. Extend the page `Item` type with `auction_mode: string`.)
Lobby `CATS`: `["all","sneakers","tcg","vintage","electronics"]` with
labels capitalized via existing `capitalize` class; `filterRooms`
import unchanged.

- [ ] **Step 4: i18n keys** (both files, before `footerNote`; verify
with the node JSON-parse one-liner)

en: `auctionMode: "Auction mode"`, `softClose: "Soft close"`,
`hardClose: "Sudden death"`, `softNote: "Bids in the last seconds extend the clock."`,
`hardNote: "The clock never moves. Last bid wins."`,
`duration: "Bid duration"`, `customSeconds: "Custom seconds (10–300)"`,
`pickCategory: "Pick a category to open bidding."`,
`categorySet: "Category set."`
id: `auctionMode: "Mode lelang"`, `softClose: "Perpanjangan otomatis"`,
`hardClose: "Mati mendadak"`, `softNote: "Bid di detik terakhir memperpanjang jam."`,
`hardNote: "Jam tidak pernah bergerak. Bid terakhir menang."`,
`duration: "Durasi bid"`, `customSeconds: "Detik kustom (10–300)"`,
`pickCategory: "Pilih kategori untuk membuka bidding."`,
`categorySet: "Kategori tersimpan."`

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit` — Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add components/ListItemForm.tsx "app/[locale]/sell/page.tsx" "app/[locale]/live/[roomId]/page.tsx" "app/[locale]/page.tsx" messages/en.json messages/id.json
git commit -m "feat: mode/duration pickers, category gate, new lobby tabs"
```

---

### Task 5: Mobile overflow root fix + BottomNav + header split

**Files:**
- Modify: `app/globals.css` (overflow guard)
- Create: `components/BottomNav.tsx`
- Modify: `components/Chrome.tsx` (render BottomNav; `hidden md:flex` action group)
- Modify: `app/[locale]/login/page.tsx`? No — untouched.

**Interfaces:**
- Consumes: `t("goLive")`, `t("discover")`, `t("login")`, `t("signout")`, existing `browserDb` session pattern from Chrome; i18n keys all pre-existing (labels: Discover via `discover`, Sell hardcoded "Sell" precedent — reuse the hardcoded "Sell" to match header; Account via email text).
- Produces: `<BottomNav locale>` — verified in Task 6 at 360px.

- [ ] **Step 1: Root guard in `app/globals.css`**

```css
html,
body {
  overflow-x: hidden;
  max-width: 100vw;
}
```

Merge into the existing `body` rule + add the `html` selector (keep
all existing tokens/comments).

- [ ] **Step 2: Audit fixed-pixel widths**

Run: `grep -rn "w-\[[0-9]" app components || true`
Expected: only intentional px (CameraCapture 900px canvas is JS, not a
class — expect zero class hits, or list each hit with a keep/drop
ruling in the commit message).

- [ ] **Step 3: Create `components/BottomNav.tsx`**

```tsx
// components/BottomNav.tsx — mobile-only (<md) bottom navigation.
"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { browserDb } from "@/lib/supabase/client";
import { cn } from "@/lib/ui";

function itemCls(active: boolean) {
  return cn(
    "pressable flex min-h-12 min-w-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px]",
    active ? "text-accent" : "text-white/60",
  );
}

export function BottomNav({ locale }: { locale: string }) {
  const t = useTranslations();
  const pathname = usePathname();
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [goingLive, setGoingLive] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  useEffect(() => {
    let live = true;
    try {
      const db = browserDb();
      db.auth.getUser().then(({ data }) => {
        if (live) setEmail(data.user?.email ?? null);
      });
      const { data: sub } = db.auth.onAuthStateChange((_event, session) => {
        if (live) setEmail(session?.user?.email ?? null);
      });
      return () => {
        live = false;
        sub.subscription.unsubscribe();
      };
    } catch {
      return undefined;
    }
  }, []);
```

Full behavior: tabs Discover (`/${locale}`, label `t("discover")`),
Go Live center accent (authed: POST /api/rooms {} → push live URL;
guest: link to login; guard `if (goingLive) return`, on failure stay
put), Sell (`/${locale}/sell`), Account (email prefix or `t("login")`
link; tap when authed → `confirm()`? No — link to a `?account` sheet?
Keep: authed shows truncated email; tapping toggles an inline sign-out
row below (useState open). Sign out via `browserDb().auth.signOut()` +
`router.refresh()`). Active tab from `pathname` (`aria-current`).
`className="md:hidden fixed bottom-0 inset-x-0 z-40 ..."`, inner
`pb-[env(safe-area-inset-bottom)]`.

- [ ] **Step 4: Chrome split**

Action group (`Sell` link, Go Live button, locale toggle stays,
email/signout) → wrap Sell+GoLive+email/signout in
`hidden md:flex`; locale toggle always visible. Render
`<BottomNav locale={locale} />` after footer. Add
`pb-20 md:pb-0` spacer on the content wrapper so the fixed bar never
covers CTAs.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit` — Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add app/globals.css components/BottomNav.tsx components/Chrome.tsx
git commit -m "feat: mobile overflow guard and bottom navigation"
```

---

### Task 6: Full verification + acceptance pass

**Files:** none (verification only; fix-forward `fix:` commits if issues surface).

- [ ] **Step 1: Suite + typecheck + build**

Run: `npx vitest run` — Expected: all pass (prior 59 + new
auction-modes/engine/rooms/items cases).
Run: `npx tsc --noEmit`, `npm run build` — Expected: clean/success.

- [ ] **Step 2: Controller applies Task 1 SQL via MCP + verifies**

(Controller does this, not the implementer — listed here so the gate
is explicit.) Columns `auction_mode`/`duration_sec`/`category`
present; `place_bid` 7-arg signature live; re-run migration twice for
idempotence.

- [ ] **Step 3: Browser acceptance per spec §10** (two windows)

Soft/20s custom → bid at 3s left → +10s; hard → clock unmoved; bid at
0.0s rejected; hostile POSTs 400; category-less room hides start
buttons → pick → appear + lobby tab; two-window <2s reflection;
360px no-scroll + bottom nav 48px targets; EN/ID toggle, no
missing-key fallback.

- [ ] **Step 4: Final log**

```bash
git log --oneline -12
git status --short
```

Each fix gets its own `fix:` commit; no amend after review starts.
