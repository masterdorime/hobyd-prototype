import { vi } from "vitest";
import { canTransition, isUuid } from "../lib/stream";

vi.mock("@/lib/supabase/admin", () => ({ adminDb: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireUser: vi.fn() }));

import { adminDb } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth";
import { POST as endPOST } from "../app/api/rooms/[id]/end/route";

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

const END_ID = "123e4567-e89b-12d3-a456-426614174000";
function endCtx() {
  return { params: Promise.resolve({ id: END_ID }) } as any;
}
function endReq() {
  return new Request("http://localhost/", {
    method: "POST",
    body: JSON.stringify({ mode: "video_only" }),
  });
}
function roomDb(room: any, onUpdate: () => void) {
  return {
    from: (table: string) => {
      if (table !== "rooms") throw new Error("unexpected table " + table);
      return {
        select: () => ({ eq: () => ({ single: async () => ({ data: room }) }) }),
        update: () => ({ eq: () => { onUpdate(); return { error: null }; } }),
      };
    },
  };
}

test("POST end on already-ended room is idempotent (200, no update)", async () => {
  let updates = 0;
  vi.mocked(adminDb).mockReturnValue(roomDb({ id: END_ID, owner_id: "u1", status: "ended" }, () => { updates++; }) as any);
  vi.mocked(requireUser).mockResolvedValue({ id: "u1", email: "u@e" } as any);
  const res = await endPOST(endReq(), endCtx());
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ ended: true, closed: null });
  expect(updates).toBe(0);
});

test("POST end on already-ended room still enforces ownership", async () => {
  vi.mocked(adminDb).mockReturnValue(roomDb({ id: END_ID, owner_id: "u1", status: "ended" }, () => {}) as any);
  vi.mocked(requireUser).mockResolvedValue({ id: "intruder", email: "x@e" } as any);
  const res = await endPOST(endReq(), endCtx());
  expect(res.status).toBe(403);
  expect(await res.json()).toEqual({ error: "forbidden" });
});
