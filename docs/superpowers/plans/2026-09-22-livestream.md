# Open Go-Live Livestream Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Any signed-in user can start/end a livestream with chat (guests welcome) and a realtime top-5 leaderboard on the watch page.

**Architecture:** Supabase stays the single source of truth; all writes go through Route Handlers with service_role. Rooms gain a `preview → live → ended` state machine plus `owner_id`; chat is a new table behind `POST /api/chat`; the leaderboard derives from the existing bids Realtime channel; LiveKit grants switch from allowlist to owner-check.

**Tech Stack:** Next.js 16.3.5 App Router + TypeScript, @supabase/ssr + @supabase/supabase-js, livekit-client + livekit-server-sdk, next-intl (ID+EN), motion, vitest 5.

**Spec:** `docs/superpowers/specs/2026-09-22-livestream-design.md`

## Global Constraints

- RLS denies client writes: no insert/update/delete policies for anon/authenticated on any table; every write goes through a Route Handler using `adminDb()` (service_role).
- Route `params` is a Promise in this Next.js version: `const { id } = await ctx.params` (see `app/api/items/[id]/close/route.ts:18-24`).
- Every user-facing string needs both `messages/en.json` and `messages/id.json` keys; never hardcode copy.
- New UI follows the glass + neu hybrid (`glass-panel`, `NeuCard`, `Badge`, `pressable`, `tnum`); animations use `motion/react` with `useReducedMotion` fallback (see `components/BidFeed.tsx`).
- Pure logic lives in `lib/` with vitest coverage; run `npx vitest run` from the worktree root (no npm script).
- Verify each task with `npx tsc --noEmit`; final gate is `npx vitest run` + `npx tsc --noEmit` + `npm run build` all green.

## Review Focus

- Guest sends chat with a blank/whitespace nickname → rejected 400 `invalid`, input keeps the typed body. Pinned in Task 3 (vitest on `validateChat` trims).
- Owner double-clicks Start Stream → second call returns 200 with the current room (idempotent), never 409. Pinned in Task 6 (route code + curl smoke).
- Settle called with an `item_id` from a different room → 404 `not_found`, nothing closes. Pinned in Task 6 (curl smoke).
- Leaderboard switches items mid-stream → old channel unsubscribed, new one subscribed, no mixed rows. Pinned in Task 8 (code-level `useEffect` cleanup following `BidFeed` + browser check).
- Owner taps settle twice fast → second call noops via `close_item()` row lock, exactly one order row. Pinned in Task 6 (curl smoke, check single order).

---

### Task 1: Schema migration (rooms lifecycle + chat table)

**Files:**
- Modify: `supabase/schema.sql` (append new section at end)
- Modify: `docs/SETUP.md` (extend the SQL-apply step with the new statements)

**Interfaces:**
- Consumes: nothing (foundation task).
- Produces: `rooms.status ∈ lobby|preview|live|ended`, `rooms.owner_id`, `chat_messages` table (+ public read, Realtime enabled), public name read on `profiles` — consumed by Tasks 5–8.

- [ ] **Step 1: Append the migration SQL to `supabase/schema.sql`**

```sql
-- 2026-09-22 livestream subsystem: open go-live, chat, leaderboard names.
alter table rooms drop constraint if exists rooms_status_check;
alter table rooms add constraint rooms_status_check
  check (status in ('lobby','preview','live','ended'));
alter table rooms add column if not exists owner_id uuid references auth.users(id) on delete cascade;

create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  sender_key text not null,
  nickname text not null check (char_length(nickname) between 1 and 24),
  body text not null check (char_length(body) between 1 and 200),
  created_at timestamptz not null default now()
);
create index if not exists chat_room_time_idx on chat_messages (room_id, created_at desc);
create index if not exists chat_sender_time_idx on chat_messages (room_id, sender_key, created_at desc);

alter table chat_messages enable row level security;
drop policy if exists "public read chat" on chat_messages;
create policy "public read chat" on chat_messages for select to anon, authenticated using (true);
-- No write policies: inserts go through POST /api/chat with service_role.

drop policy if exists "public read names" on profiles;
create policy "public read names" on profiles for select to anon, authenticated using (true);
-- Pilot note: exposes reputation alongside names; accepted for the leaderboard.

do $$ begin
  alter publication supabase_realtime add table chat_messages;
exception when duplicate_object then null;
end $$;
```

- [ ] **Step 2: Extend `docs/SETUP.md` SQL step**

Add after the existing schema-apply instructions: re-run the new
section in the SQL editor (it is `if not exists`-safe), then verify
with `select * from chat_messages limit 1;` returning zero rows
without error.

- [ ] **Step 3: Verify SQL is sane**

Run: `git diff supabase/schema.sql` and eyeball that only the new
section was appended; confirm every `create` uses `if not exists` and
no existing table/constraint (other than the intended
`rooms_status_check` replace) is touched.

- [ ] **Step 4: Commit**

```bash
git add supabase/schema.sql docs/SETUP.md
git commit -m "feat: schema for open go-live, chat, leaderboard names"
```

---

### Task 2: Stream state machine + room row builder

**Files:**
- Create: `lib/stream.ts`
- Create: `tests/stream.test.ts`
- Modify: `lib/rooms.ts` (`buildRoomRow` → preview + owner_id)
- Modify: `tests/rooms.test.ts` (update `buildRoomRow` expectation)

**Interfaces:**
- Consumes: nothing.
- Produces: `canTransition(from: RoomStatus, to: RoomStatus): boolean`, `isUuid(v: unknown): v is string`, `buildRoomRow({title, seller_name, owner_id})` (status `"preview"`) — consumed by Tasks 5–6.

- [ ] **Step 1: Write the failing test `tests/stream.test.ts`**

```ts
import { canTransition, isUuid } from "../lib/stream";

test("preview goes live, live ends, ended is terminal", () => {
  expect(canTransition("preview", "live")).toBe(true);
  expect(canTransition("live", "ended")).toBe(true);
  expect(canTransition("ended", "live")).toBe(false);
});

test("live-to-live is illegal (routes handle idempotency, not the machine)", () => {
  expect(canTransition("live", "live")).toBe(false);
});

test("lobby can only become preview", () => {
  expect(canTransition("lobby", "preview")).toBe(true);
  expect(canTransition("lobby", "live")).toBe(false);
});

test("isUuid accepts uuids, rejects junk", () => {
  expect(isUuid("123e4567-e89b-12d3-a456-426614174000")).toBe(true);
  expect(isUuid("nope")).toBe(false);
  expect(isUuid(undefined)).toBe(false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/stream.test.ts`
Expected: FAIL with "Cannot find module '../lib/stream'".

- [ ] **Step 3: Write minimal implementation `lib/stream.ts`**

```ts
// lib/stream.ts — room lifecycle machine + shared route guards (pure, tested).
export type RoomStatus = "lobby" | "preview" | "live" | "ended";

const NEXT: Record<RoomStatus, RoomStatus[]> = {
  lobby: ["preview"],
  preview: ["live", "ended"],
  live: ["ended"],
  ended: [],
};

export function canTransition(from: string, to: string): boolean {
  const next = (NEXT as Record<string, string[]>)[from];
  return Array.isArray(next) && next.includes(to);
}

export function isUuid(v: unknown): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
  );
}
```

- [ ] **Step 4: Update `buildRoomRow` in `lib/rooms.ts`**

```ts
export function buildRoomRow(o: { title: string; seller_name: string; owner_id: string }): {
  title: string;
  seller_name: string;
  owner_id: string;
  status: string;
} {
  return { title: o.title, seller_name: o.seller_name, owner_id: o.owner_id, status: "preview" };
}
```

- [ ] **Step 5: Update the `buildRoomRow` test in `tests/rooms.test.ts`**

```ts
test("buildRoomRow opens a preview room for any signed-in user", () => {
  expect(buildRoomRow({ title: "HOBYD Live", seller_name: "s@hobyd.id", owner_id: "u1" })).toEqual({
    title: "HOBYD Live",
    seller_name: "s@hobyd.id",
    owner_id: "u1",
    status: "preview",
  });
});
```

- [ ] **Step 6: Run tests + typecheck**

Run: `npx vitest run tests/stream.test.ts tests/rooms.test.ts`
Expected: PASS (all).
Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add lib/stream.ts lib/rooms.ts tests/stream.test.ts tests/rooms.test.ts
git commit -m "feat: room lifecycle machine, preview rooms with owner"
```

---

### Task 3: Chat validation + leaderboard ranking

**Files:**
- Create: `lib/chat.ts`
- Create: `lib/leaderboard.ts`
- Create: `tests/chat.test.ts`
- Create: `tests/leaderboard.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `validateChat(o): {ok:true}|{ok:false,error:"invalid"|"too_long"}`, `isRateLimited(lastSentAtMs|null, nowMs): boolean`, `CHAT_RATE_MS = 2000`, `topBids(bids, n=5)`, `displayName(bidder, names)` — consumed by Tasks 7–8.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/chat.test.ts
import { CHAT_RATE_MS, isRateLimited, validateChat } from "../lib/chat";

test("blank nickname or body is invalid (whitespace trimmed)", () => {
  expect(validateChat({ nickname: "   ", body: "hi" })).toEqual({ ok: false, error: "invalid" });
  expect(validateChat({ nickname: "fan", body: "  " })).toEqual({ ok: false, error: "invalid" });
});

test("overlong nick/body is too_long", () => {
  expect(validateChat({ nickname: "f".repeat(25), body: "hi" })).toEqual({ ok: false, error: "too_long" });
  expect(validateChat({ nickname: "fan", body: "x".repeat(201) })).toEqual({ ok: false, error: "too_long" });
});

test("good message passes", () => {
  expect(validateChat({ nickname: " fan ", body: " Charizard! " })).toEqual({ ok: true });
});

test("rate limit is a 2s window", () => {
  expect(CHAT_RATE_MS).toBe(2000);
  expect(isRateLimited(null, 1000)).toBe(false);
  expect(isRateLimited(0, 1999)).toBe(true);
  expect(isRateLimited(0, 2000)).toBe(false);
});
```

```ts
// tests/leaderboard.test.ts
import { displayName, topBids } from "../lib/leaderboard";

const bids = [
  { id: "b1", bidder: "u1", amount: 100, created_at: "2026-09-22T10:00:02Z" },
  { id: "b2", bidder: "u2", amount: 200, created_at: "2026-09-22T10:00:03Z" },
  { id: "b3", bidder: "u3", amount: 200, created_at: "2026-09-22T10:00:01Z" },
];

test("sorts amount desc, earliest first on ties (mirrors close_item)", () => {
  expect(topBids(bids).map((b) => b.id)).toEqual(["b3", "b2", "b1"]);
});

test("caps at 5", () => {
  const many = Array.from({ length: 7 }, (_, i) => ({
    id: `b${i}`, bidder: "u1", amount: 10 + i, created_at: "2026-09-22T10:00:00Z",
  }));
  expect(topBids(many)).toHaveLength(5);
  expect(topBids(many)[0].amount).toBe(16);
});

test("displayName falls back to masked id", () => {
  expect(displayName("u1", new Map([["u1", "Ash"]]))).toBe("Ash");
  expect(displayName("abcdef123456", new Map())).toBe("abcdef12…");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/chat.test.ts tests/leaderboard.test.ts`
Expected: FAIL with "Cannot find module".

- [ ] **Step 3: Write minimal implementations**

```ts
// lib/chat.ts — chat validation + rate window (pure, tested).
export const CHAT_RATE_MS = 2000;
export const MAX_NICK = 24;
export const MAX_CHAT = 200;

export type ChatCheck = { ok: true } | { ok: false; error: "invalid" | "too_long" };

export function validateChat(o: { nickname: unknown; body: unknown }): ChatCheck {
  const nick = typeof o.nickname === "string" ? o.nickname.trim() : "";
  const body = typeof o.body === "string" ? o.body.trim() : "";
  if (!nick || !body) return { ok: false, error: "invalid" };
  if (nick.length > MAX_NICK || body.length > MAX_CHAT)
    return { ok: false, error: "too_long" };
  return { ok: true };
}

export function isRateLimited(lastSentAtMs: number | null, nowMs: number): boolean {
  return lastSentAtMs !== null && nowMs - lastSentAtMs < CHAT_RATE_MS;
}
```

```ts
// lib/leaderboard.ts — top-bids ranking (pure, tested).
export type RankedBid = { id: string; bidder: string; amount: number; created_at: string };

export function topBids(bids: RankedBid[], n = 5): RankedBid[] {
  return [...bids]
    .sort(
      (a, b) =>
        b.amount - a.amount ||
        (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0) ||
        (a.id < b.id ? -1 : 1),
    )
    .slice(0, n);
}

export function displayName(bidder: string, names: Map<string, string>): string {
  return names.get(bidder) ?? `${bidder.slice(0, 8)}…`;
}
```

- [ ] **Step 4: Run tests + typecheck**

Run: `npx vitest run tests/chat.test.ts tests/leaderboard.test.ts`
Expected: PASS (all).
Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add lib/chat.ts lib/leaderboard.ts tests/chat.test.ts tests/leaderboard.test.ts
git commit -m "feat: chat validation and leaderboard ranking"
```

---

### Task 4: Owner-based LiveKit grants

**Files:**
- Modify: `app/api/livekit-token/route.ts`
- Modify: `tests/tokengrants.test.ts`

**Interfaces:**
- Consumes: nothing new (uses `requireUser`, `adminDb`, `env` as today).
- Produces: `grantFor(userId: string, ownerId: string | null): "publisher" | "subscriber"`; GET accepts `?roomId=`, 404s unknown rooms — consumed by Task 8 wiring (no code change there).

- [ ] **Step 1: Rewrite the failing test `tests/tokengrants.test.ts`**

```ts
// tests/tokengrants.test.ts
import { grantFor } from "../app/api/livekit-token/route";

test("room owner publishes, everyone else subscribes", () => {
  expect(grantFor("user-1", "user-1")).toBe("publisher");
  expect(grantFor("user-2", "user-1")).toBe("subscriber");
  expect(grantFor("user-2", null)).toBe("subscriber");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/tokengrants.test.ts`
Expected: FAIL (old allowlist signature returns wrong grants).

- [ ] **Step 3: Rewrite `app/api/livekit-token/route.ts`**

```ts
import { NextResponse } from "next/server";
import { AccessToken } from "livekit-server-sdk";
import { requireUser } from "@/lib/auth";
import { adminDb } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { isUuid } from "@/lib/stream";

export function grantFor(userId: string, ownerId: string | null) {
  return ownerId !== null && userId === ownerId ? "publisher" : "subscriber";
}

export async function GET(req: Request) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const room = new URL(req.url).searchParams.get("roomId");
  if (!room || !isUuid(room)) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const { data } = await adminDb().from("rooms").select("owner_id").eq("id", room).single();
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const grant = grantFor(user.id, data.owner_id as string | null);
  const token = new AccessToken(env.livekitKey(), env.livekitSecret(), {
    identity: user.id, ttl: "1h",
  });
  token.addGrant(grant === "publisher"
    ? { room, roomJoin: true, canPublish: true, canSubscribe: true }
    : { room, roomJoin: true, canPublish: false, canSubscribe: true });
  return NextResponse.json({ token: await token.toJwt(), url: env.livekitUrl() });
}
```

Notes: `isSeller` import removed (allowlist no longer consulted here);
JWT shape unchanged, only the grant decision changes. Rooms created
before Task 1 have `owner_id = null` → everyone subscribes (safe).

- [ ] **Step 4: Run test + typecheck**

Run: `npx vitest run tests/tokengrants.test.ts`
Expected: PASS.
Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add app/api/livekit-token/route.ts tests/tokengrants.test.ts
git commit -m "feat: livekit grants by room ownership"
```

---

### Task 5: Open room creation (any signed-in user)

**Files:**
- Modify: `app/api/rooms/route.ts`
- Modify: `app/api/items/route.ts` (drop allowlist on POST only)

**Interfaces:**
- Consumes: `buildRoomRow` + `requireUser` (Task 2).
- Produces: `POST /api/rooms` → 403 only when unauthenticated, returns a `preview` room with `owner_id`; `GET /api/rooms` includes `preview`; `POST /api/items` requires auth only — consumed by Tasks 6, 8, 9.

- [ ] **Step 1: Edit `app/api/rooms/route.ts`**

Replace the import with `import { requireUser } from "@/lib/auth";`
(no `isSeller`). Change GET filter to
`.in("status", ["lobby", "preview", "live"])`. Change POST to:

```ts
export async function POST(req: Request) {
  const user = await requireUser().catch(() => null);
  if (!user)
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const title = String(body?.title ?? "").trim() || "HOBYD Live";
  const row = buildRoomRow({ title, seller_name: user.email, owner_id: user.id });
  const { data, error } = await adminDb().from("rooms").insert(row).select().single();
  if (error) return NextResponse.json({ error: "create_failed" }, { status: 500 });
  return NextResponse.json(data);
}
```

- [ ] **Step 2: Edit `app/api/items/route.ts` POST guard**

Change `import { requireUser, isSeller } from "@/lib/auth";` to
`import { requireUser } from "@/lib/auth";` and the guard to:

```ts
const user = await requireUser().catch(() => null);
if (!user)
  return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
```

Upload validation, bucket, and row building are untouched.

- [ ] **Step 3: Typecheck + smoke**

Run: `npx tsc --noEmit` (Expected: clean).
With dev running: `curl -s -X POST localhost:3001/api/rooms -H 'content-type: application/json' -d '{}'` → expect `{"error":"unauthenticated"}` 401 (proves the allowlist 403 path is gone; authed check needs a session cookie — covered in Task 10 browser pass).

- [ ] **Step 4: Commit**

```bash
git add app/api/rooms/route.ts app/api/items/route.ts
git commit -m "feat: open room and item creation to any signed-in user"
```

---

### Task 6: Room lifecycle routes (get / go-live / end)

**Files:**
- Create: `app/api/rooms/[id]/route.ts`
- Create: `app/api/rooms/[id]/go-live/route.ts`
- Create: `app/api/rooms/[id]/end/route.ts`

**Interfaces:**
- Consumes: `canTransition`, `isUuid` (Task 2); `requireUser`, `adminDb`, `close_item` RPC (existing).
- Produces: `GET → room|null`, `POST go-live → room`, `POST end {mode, item_id?} → {ended, closed?, winner?}` — consumed by Task 8.

- [ ] **Step 1: Write `app/api/rooms/[id]/route.ts`**

```ts
// app/api/rooms/[id]/route.ts — public single-room read (owner controls need it).
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/supabase/admin";
import { isUuid } from "@/lib/stream";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!isUuid(id)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const { data } = await adminDb().from("rooms").select("*").eq("id", id).single();
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(data);
}
```

- [ ] **Step 2: Write `app/api/rooms/[id]/go-live/route.ts`**

```ts
// Owner-only preview → live. Idempotent: already-live returns 200 with the room.
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth";
import { canTransition, isUuid } from "@/lib/stream";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!isUuid(id)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const db = adminDb();
  const { data: room } = await db.from("rooms").select("*").eq("id", id).single();
  if (!room) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (room.owner_id !== user.id)
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (room.status === "live") return NextResponse.json(room);
  if (!canTransition(room.status as string, "live"))
    return NextResponse.json({ error: "illegal_transition" }, { status: 409 });
  const { data, error } = await db.from("rooms").update({ status: "live" })
    .eq("id", id).select().single();
  if (error) return NextResponse.json({ error: "update_failed" }, { status: 500 });
  return NextResponse.json(data);
}
```

- [ ] **Step 3: Write `app/api/rooms/[id]/end/route.ts`**

```ts
// Owner-only end: { mode: "settle" } force-closes item_id then ends the
// room; { mode: "video_only" } ends the room, item timer untouched.
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth";
import { canTransition, isUuid } from "@/lib/stream";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!isUuid(id)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const mode = body?.mode;
  if (mode !== "settle" && mode !== "video_only")
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  const db = adminDb();
  const { data: room } = await db.from("rooms").select("*").eq("id", id).single();
  if (!room) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (room.owner_id !== user.id)
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let closed: unknown = null;
  if (mode === "settle" && typeof body?.item_id === "string" && isUuid(body.item_id)) {
    const { data: item } = await db.from("items")
      .select("id,room_id,status,ends_at").eq("id", body.item_id).single();
    if (!item || (item as { room_id: string }).room_id !== id)
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    const it = item as { status: string; ends_at: string };
    if (it.status !== "closed" && new Date(it.ends_at).getTime() > Date.now()) {
      const { error: clampErr } = await db.from("items")
        .update({ ends_at: new Date().toISOString() }).eq("id", body.item_id);
      if (clampErr) return NextResponse.json({ error: "settle_failed" }, { status: 500 });
    }
    const { data, error } = await db.rpc("close_item", { p_item_id: body.item_id });
    if (error) return NextResponse.json({ error: "settle_failed" }, { status: 500 });
    closed = data;
  }

  const target = room.status === "live" || room.status === "preview" ? "ended" : room.status;
  if (target !== "ended" || !canTransition(room.status as string, "ended"))
    return NextResponse.json({ error: "illegal_transition" }, { status: 409 });
  const { error: roomErr } = await db.from("rooms").update({ status: "ended" }).eq("id", id);
  if (roomErr) return NextResponse.json({ error: "update_failed" }, { status: 500 });
  return NextResponse.json({ ended: true, closed });
}
```

- [ ] **Step 4: Typecheck + smoke the guards**

Run: `npx tsc --noEmit` (Expected: clean).
Smoke (dev running, no session): `curl -s -X POST localhost:3001/api/rooms/123e4567-e89b-12d3-a456-426614174000/go-live` → 401 `unauthenticated`; same for `/end` with `-d '{"mode":"video_only"}'`; malformed id (`/rooms/nope`) → 404 `not_found`. Authed owner flows are covered in the Task 10 browser pass.

- [ ] **Step 5: Commit**

```bash
git add -- app/api/rooms
git commit -m "feat: room get, go-live, end-stream routes"
```

---

### Task 7: Chat post route

**Files:**
- Create: `app/api/chat/route.ts`

**Interfaces:**
- Consumes: `validateChat`, `isRateLimited`, `CHAT_RATE_MS` (Task 3); `requireUser` (optional auth), `adminDb` (existing).
- Produces: `POST /api/chat {room_id, nickname, body} → row | {error}` — consumed by Task 8.

- [ ] **Step 1: Write `app/api/chat/route.ts`**

```ts
// app/api/chat/route.ts — guest-capable chat post. Length + rate-limit
// enforced here; service_role insert. Rejects on ended rooms.
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth";
import { CHAT_RATE_MS, isRateLimited, validateChat } from "@/lib/chat";
import { isUuid } from "@/lib/stream";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const roomId = typeof body?.room_id === "string" ? body.room_id : "";
  if (!isUuid(roomId)) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const check = validateChat({ nickname: body?.nickname, body: body?.body });
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });

  const db = adminDb();
  const { data: room } = await db.from("rooms").select("status").eq("id", roomId).single();
  if (!room) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if ((room as { status: string }).status === "ended")
    return NextResponse.json({ error: "closed" }, { status: 403 });

  const user = await requireUser().catch(() => null);
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
  const senderKey = user ? `u:${user.id}` : `ip:${ip || "unknown"}`;
  const { data: last } = await db.from("chat_messages").select("created_at")
    .eq("room_id", roomId).eq("sender_key", senderKey)
    .order("created_at", { ascending: false }).limit(1).single();
  if (last && isRateLimited(new Date((last as { created_at: string }).created_at).getTime(), Date.now()))
    return NextResponse.json({ error: "rate_limited", retry_ms: CHAT_RATE_MS }, { status: 429 });

  const nickname = String(body.nickname).trim();
  const text = String(body.body).trim();
  const { data, error } = await db.from("chat_messages").insert({
    room_id: roomId,
    user_id: user?.id ?? null,
    sender_key: senderKey,
    nickname,
    body: text,
  }).select().single();
  if (error) return NextResponse.json({ error: "send_failed" }, { status: 500 });
  return NextResponse.json(data);
}
```

- [ ] **Step 2: Typecheck + smoke**

Run: `npx tsc --noEmit` (Expected: clean).
Smoke: `curl -s -X POST localhost:3001/api/chat -H 'content-type: application/json' -d '{"room_id":"nope","nickname":"fan","body":"hi"}'` → 400 `invalid`. Overlong body (201 chars) → 400 `too_long`. Authed/room flows in Task 10.

- [ ] **Step 3: Commit**

```bash
git add app/api/chat/route.ts
git commit -m "feat: guest-capable chat post route"
```

---

### Task 8: i18n keys (EN + ID)

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/id.json`

**Interfaces:**
- Consumes: key list from spec §6.
- Produces: 16 keys × 2 locales — consumed by Task 9.

- [ ] **Step 1: Add keys to `messages/en.json`** (insert before `"footerNote"`, keep trailing-comma valid JSON)

```json
"goLive": "Go Live",
"endStream": "End Stream",
"endTitle": "End the stream?",
"settleAndClose": "Close + settle",
"settleNote": "Active item closes, winner locks, order created.",
"videoOnly": "End video only",
"videoOnlyNote": "Video/chat stop, auction runs until timer ends.",
"startingSoon": "Starting soon",
"streamEnded": "Stream ended",
"chatHint": "Write a message…",
"nickname": "Nickname",
"nicknamePrompt": "Pick a chat nickname",
"send": "Send",
"topBids": "Top Bids",
"noBidsYet": "No bids yet.",
"rateLimited": "Slow down — wait a moment.",
```

- [ ] **Step 2: Add keys to `messages/id.json`**

```json
"goLive": "Mulai Siaran",
"endStream": "Akhiri Siaran",
"endTitle": "Akhiri siaran?",
"settleAndClose": "Tutup + tentukan pemenang",
"settleNote": "Item aktif ditutup, pemenang dikunci, order dibuat.",
"videoOnly": "Hanya akhiri video",
"videoOnlyNote": "Video/chat berhenti, lelang berjalan sampai timer habis.",
"startingSoon": "Segera mulai",
"streamEnded": "Siaran berakhir",
"chatHint": "Tulis pesan…",
"nickname": "Nama",
"nicknamePrompt": "Pilih nama untuk chat",
"send": "Kirim",
"topBids": "Bid Tertinggi",
"noBidsYet": "Belum ada bid.",
"rateLimited": "Pelan-pelan — tunggu sebentar.",
```

- [ ] **Step 3: Verify JSON + build locale load**

Run: `node -e "JSON.parse(require('fs').readFileSync('messages/en.json'));JSON.parse(require('fs').readFileSync('messages/id.json'));console.log('json ok')"`
Expected: `json ok`.
Run: `npx tsc --noEmit` (Expected: clean).

- [ ] **Step 4: Commit**

```bash
git add messages/en.json messages/id.json
git commit -m "feat: i18n keys for livestream controls, chat, leaderboard"
```

---

### Task 9: Components (StreamControls, ChatPanel, Leaderboard)

**Files:**
- Create: `components/StreamControls.tsx` (Start button + End button + end dialog)
- Create: `components/ChatPanel.tsx`
- Create: `components/Leaderboard.tsx`

**Interfaces:**
- Consumes: `topBids`, `displayName` (Task 3); i18n keys (Task 8); `browserDb` + Realtime channel pattern from `components/BidFeed.tsx`; `NeuCard`, `Badge`, `Button`, `FieldInput` from `components/ui/*`.
- Produces: `<StreamControls roomId isOwner roomStatus activeItemId onChange>`; `<ChatPanel roomId roomStatus>`; `<Leaderboard itemId>` — consumed by Task 10.

- [ ] **Step 1: Write `components/Leaderboard.tsx`**

```tsx
// components/Leaderboard.tsx — top-5 live bids for the current item.
// Same bids channel pattern as BidFeed; names resolved via public profiles.
"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { fadeTransition, momentumSpring } from "@/lib/motion";
import { displayName, topBids, type RankedBid } from "@/lib/leaderboard";
import { browserDb } from "@/lib/supabase/client";

export function Leaderboard({ itemId }: { itemId: string }) {
  const t = useTranslations();
  const reduce = useReducedMotion();
  const [bids, setBids] = useState<RankedBid[]>([]);
  const [names, setNames] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    setBids([]);
    const db = browserDb();
    db.from("bids").select("id,bidder,amount,created_at").eq("item_id", itemId)
      .order("created_at", { ascending: false }).limit(20)
      .then(({ data }) => setBids((data ?? []) as RankedBid[]));
    const ch = db.channel(`bids-${itemId}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "bids", filter: `item_id=eq.${itemId}` },
        (p) => setBids((b) => [...b, p.new as RankedBid].slice(-20)))
      .subscribe();
    return () => { db.removeChannel(ch); };
  }, [itemId]);

  useEffect(() => {
    const ids = [...new Set(bids.map((b) => b.bidder))].filter((id) => !names.has(id));
    if (ids.length === 0) return;
    browserDb().from("profiles").select("id,name").in("id", ids)
      .then(({ data }) => {
        if (!data) return;
        setNames((m) => new Map([...m, ...(data as { id: string; name: string }[]).map((r) => [r.id, r.name] as [string, string])]));
      });
  }, [bids, names]);

  const top = topBids(bids);
  if (top.length === 0) return <p className="text-sm opacity-70">{t("noBidsYet")}</p>;
  return (
    <div>
      <h2 className="text-sm font-semibold uppercase tracking-wide opacity-70">{t("topBids")}</h2>
      <ol className="mt-2 flex flex-col gap-1 text-sm">
        <AnimatePresence initial={false}>
          {top.map((b, i) => (
            <motion.li
              key={b.id}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={reduce ? fadeTransition : momentumSpring}
              className="tnum flex items-center justify-between rounded-lg bg-white/5 px-3 py-1.5"
            >
              <span>#{i + 1} {displayName(b.bidder, names)}</span>
              <span className="font-semibold">Rp{b.amount.toLocaleString("id-ID")}</span>
            </motion.li>
          ))}
        </AnimatePresence>
      </ol>
    </div>
  );
}
```

- [ ] **Step 2: Write `components/ChatPanel.tsx`**

```tsx
// components/ChatPanel.tsx — guest-capable live chat (last 30, Realtime INSERT).
"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { browserDb } from "@/lib/supabase/client";

type Msg = { id: string; nickname: string; body: string; created_at: string };
const NICK_KEY = "hobyd_nick";

export function ChatPanel({ roomId, roomStatus }: { roomId: string; roomStatus: string }) {
  const t = useTranslations();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [nick, setNick] = useState("");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    setMsgs([]);
    const db = browserDb();
    db.from("chat_messages").select("id,nickname,body,created_at").eq("room_id", roomId)
      .order("created_at", { ascending: false }).limit(30)
      .then(({ data }) => setMsgs(((data ?? []) as Msg[]).reverse()));
    const ch = db.channel(`chat-${roomId}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `room_id=eq.${roomId}` },
        (p) => setMsgs((m) => [...m, p.new as Msg].slice(-30)))
      .subscribe();
    return () => { db.removeChannel(ch); };
  }, [roomId]);

  useEffect(() => {
    try { setNick(localStorage.getItem(NICK_KEY) ?? ""); } catch { /* private mode */ }
  }, []);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !draft.trim()) return;
    const name = nick.trim();
    if (!name) { setHint(t("nicknamePrompt")); return; }
    setBusy(true);
    setHint(null);
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ room_id: roomId, nickname: name, body: draft.trim() }),
    });
    setBusy(false);
    if (!res.ok) {
      const err = (await res.json().catch(() => null))?.error;
      setHint(err === "rate_limited" ? t("rateLimited") : t("nicknamePrompt"));
      if (err === "rate_limited") setTimeout(() => setHint(null), 2000);
      return;
    }
    try { localStorage.setItem(NICK_KEY, name); } catch { /* private mode */ }
    setDraft("");
  }

  const closed = roomStatus === "ended";
  return (
    <div className="flex flex-col gap-2">
      <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto text-sm" aria-live="polite">
        {msgs.map((m) => (
          <li key={m.id} className="rounded-lg bg-white/5 px-3 py-1.5">
            <span className="font-semibold">{m.nickname}</span>
            <span className="opacity-80"> — {m.body}</span>
          </li>
        ))}
      </ul>
      {closed ? (
        <p className="text-sm opacity-70">{t("streamEnded")}</p>
      ) : (
        <form onSubmit={send} className="flex flex-col gap-2">
          <input
            value={nick} onChange={(e) => setNick(e.target.value)} maxLength={24}
            placeholder={t("nicknamePrompt")} aria-label={t("nickname")}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <input
              value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={200}
              placeholder={t("chatHint")} aria-label={t("send")}
              className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
            />
            <button type="submit" disabled={busy}
              className="pressable rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-ink disabled:opacity-50">
              {t("send")}
            </button>
          </div>
          {hint && <p role="alert" className="text-sm text-red-400">{hint}</p>}
        </form>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Write `components/StreamControls.tsx`**

```tsx
// components/StreamControls.tsx — owner-only Start/End + end-mode dialog.
"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { NeuCard } from "@/components/ui/card";

export function StreamControls({ roomId, roomStatus, activeItemId, onChange }:
  { roomId: string; roomStatus: string; activeItemId: string | null; onChange: (status: string) => void }) {
  const t = useTranslations();
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState(false);

  async function goLive() {
    if (busy) return;
    setBusy(true);
    const res = await fetch(`/api/rooms/${roomId}/go-live`, { method: "POST" });
    const body = await res.json().catch(() => null);
    setBusy(false);
    if (res.ok && body?.status) onChange(body.status);
  }

  async function end(mode: "settle" | "video_only") {
    if (busy) return;
    setBusy(true);
    const res = await fetch(`/api/rooms/${roomId}/end`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode, item_id: activeItemId }),
    });
    const body = await res.json().catch(() => null);
    setBusy(false);
    setDialog(false);
    if (res.ok && body?.ended) onChange("ended");
  }

  if (roomStatus === "preview")
    return (
      <button onClick={goLive} disabled={busy}
        className="pressable rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-ink disabled:opacity-50">
        {t("goLive")}
      </button>
    );
  if (roomStatus !== "live") return null;
  return (
    <>
      <button onClick={() => setDialog(true)}
        className="pressable rounded-full border border-red-400/40 px-4 py-2 text-sm font-semibold text-red-300">
        {t("endStream")}
      </button>
      {dialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label={t("endTitle")}>
          <NeuCard className="flex w-full max-w-sm flex-col gap-3 p-5">
            <h2 className="text-lg font-bold">{t("endTitle")}</h2>
            <button onClick={() => end("settle")} disabled={busy}
              className="pressable rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-ink disabled:opacity-50">
              {t("settleAndClose")}
            </button>
            <p className="-mt-2 text-xs opacity-70">{t("settleNote")}</p>
            <button onClick={() => end("video_only")} disabled={busy}
              className="pressable rounded-xl border border-white/15 px-4 py-2 text-sm disabled:opacity-50">
              {t("videoOnly")}
            </button>
            <p className="-mt-2 text-xs opacity-70">{t("videoOnlyNote")}</p>
          </NeuCard>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean. (Fix `@/lib/motion` exports against actual `lib/motion.ts` — `momentumSpring`, `fadeTransition` per `BidFeed.tsx` imports. Fix `components/ui/*` prop names against actual files before committing.)

- [ ] **Step 5: Commit**

```bash
git add components/StreamControls.tsx components/ChatPanel.tsx components/Leaderboard.tsx
git commit -m "feat: stream controls, chat panel, leaderboard components"
```

---

### Task 10: Watch-page wiring + lobby preview + sell room targeting

**Files:**
- Modify: `app/[locale]/live/[roomId]/page.tsx`
- Modify: `app/[locale]/page.tsx` (preview badge — small)
- Modify: `app/[locale]/sell/page.tsx` (target created preview room + go-live link)

**Interfaces:**
- Consumes: all previous tasks.
- Produces: full livestream UX per spec §6 + acceptance §10.

- [ ] **Step 1: Wire the live page**

In `app/[locale]/live/[roomId]/page.tsx` (follow existing hooks style).
Room-fetch + subscription pattern (place beside the items effects):

```tsx
const [room, setRoom] = useState<{ owner_id: string | null; status: string } | null>(null);
const [me, setMe] = useState<string | null>(null);

useEffect(() => {
  fetch(`/api/rooms/${encodeURIComponent(roomId)}`)
    .then((r) => (r.ok ? r.json() : null))
    .then((row) => row && setRoom({ owner_id: row.owner_id ?? null, status: row.status }));
  browserDb().auth.getUser().then(({ data }) => setMe(data.user?.id ?? null)).catch(() => setMe(null));
  const db = browserDb();
  const ch = db.channel(`room-${roomId}`)
    .on("postgres_changes",
      { event: "UPDATE", schema: "public", table: "rooms", filter: `id=eq.${roomId}` },
      (p) => setRoom((r) => r && { ...r, status: (p.new as { status: string }).status }))
    .subscribe();
  return () => { db.removeChannel(ch); };
}, [roomId]);

const roomStatus = room?.status ?? "live";
const isOwner = !!me && !!room && me === room.owner_id;
```

Then:
1. Video column: `roomStatus !== "live"` → glass slate (`startingSoon` when preview, `streamEnded` when ended); else `<LiveVideo roomId>` unchanged. LIVE badge shows only when live.
2. Owner slot above video: `{isOwner && room && <StreamControls roomId roomStatus={room.status} activeItemId={activeId} onChange={(s) => setRoom((r) => r && { ...r, status: s })} />}`.
3. Bidding panel: `<Leaderboard itemId={active.id} />` above `BidForm`; `<ChatPanel roomId roomStatus={roomStatus} />` below `BidFeed` (guests included — no auth gate).

- [ ] **Step 2: Lobby preview badge**

In `app/[locale]/page.tsx`, where rooms render their status badge: show `t("startingSoon")` with `tone="muted"` when `status === "preview"`. No filter change (GET already includes preview since Task 5).

- [ ] **Step 3: Sell page targets its own preview room**

In `app/[locale]/sell/page.tsx`: replace the "first room" fetch with `POST /api/rooms` (title from the listing, requires sign-in) storing the returned room id; list the item into it; after success show `done` plus a `Link` to `/${locale}/live/${roomId}` labeled `t("goLive")`. (Read the rest of the file from line 81 before editing — the submit flow continues past what was reviewed.)

- [ ] **Step 4: Typecheck + build**

Run: `npx tsc --noEmit` (Expected: clean).
Run: `npm run build` (Expected: success).

- [ ] **Step 5: Commit**

```bash
git add "app/[locale]/live/[roomId]/page.tsx" "app/[locale]/page.tsx" "app/[locale]/sell/page.tsx"
git commit -m "feat: wire livestream UX into watch, lobby, sell"
```

---

### Task 11: Full verification + acceptance pass

**Files:** none (verification only; fix-forward commits if issues surface).

- [ ] **Step 1: Run the full suite**

Run: `npx vitest run`
Expected: all files pass (prior 39 + new stream/chat/leaderboard/tokengrants tests).

- [ ] **Step 2: Typecheck + production build**

Run: `npx tsc --noEmit` then `npm run build`
Expected: both clean.

- [ ] **Step 3: Browser acceptance (two windows: streamer + guest)**

Per spec §10: (1) signed-in user creates room → lists item → Go Live → guest subscribes without auth; (2) guest nick + chat <2s, 201-char reject, rapid double-send 429; (3) two bidders → leaderboard reorders, #1 equals eventual winner; (4a) End → settle creates pending order + room ended; (4b) fresh room → End → video_only keeps bidding alive; (5) block LiveKit WS → bids/chat/leaderboard work; (6) toggle ID/EN, no missing-key fallback.

- [ ] **Step 4: Commit any fix-forwards, then final log**

```bash
git log --oneline -12
git status --short
```

Each fix gets its own `fix:` commit; no amend after review starts.
