import { vi } from "vitest";
import { buildRoomRow, filterRooms, validateRoomTitle, type LobbyRoom } from "../lib/rooms";

vi.mock("@/lib/supabase/admin", () => ({ adminDb: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireUser: vi.fn() }));

import { adminDb } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth";
import { GET as roomGET } from "../app/api/rooms/[id]/route";
import { POST as settingsPOST } from "../app/api/rooms/[id]/settings/route";

const rooms: LobbyRoom[] = [
  { id: "1", title: "Charizard Holo PSA 9", status: "live" },
  { id: "2", title: "Diecast LBWK R34", status: "lobby" },
];

test("all returns everything", () => {
  expect(filterRooms(rooms, "all")).toHaveLength(2);
});

test("tcg matches tcg/charizard/pokemon titles", () => {
  expect(filterRooms(rooms, "tcg")).toEqual([rooms[0]]);
});

test("sneakers falls back to everything when no title matches", () => {
  expect(filterRooms(rooms, "sneakers")).toHaveLength(2);
});

test("unknown category returns everything", () => {
  expect(filterRooms(rooms, "diecast")).toHaveLength(2);
});

test("other matches rooms no hint covers, falls back when empty", () => {
  const mixed: LobbyRoom[] = [
    ...rooms,
    { id: "3", title: "Asep Ikan Goreng", status: "live" },
  ];
  expect(filterRooms(mixed, "other")).toEqual([mixed[1], mixed[2]]);
  expect(filterRooms([rooms[0]], "other")).toHaveLength(1);
});

test("buildRoomRow opens a preview room for any signed-in user", () => {
  expect(buildRoomRow({ title: "HOBYD Live", seller_name: "s@hobyd.id", owner_id: "u1" })).toEqual({
    title: "HOBYD Live",
    seller_name: "s@hobyd.id",
    owner_id: "u1",
    status: "preview",
  });
});

test("buildRoomRow keeps a valid category, drops junk", () => {
  expect(
    buildRoomRow({ title: "T", seller_name: "s", owner_id: "u1", category: "TCG" }).category,
  ).toBe("TCG");
  expect(
    buildRoomRow({ title: "T", seller_name: "s", owner_id: "u1", category: "Diecast" as never }).category,
  ).toBeUndefined();
});

test("validateRoomTitle requires 1–80 trimmed chars", () => {
  expect(validateRoomTitle("  Sneaker Drop  ")).toBe(true);
  expect(validateRoomTitle("")).toBe(false);
  expect(validateRoomTitle("   ")).toBe(false);
  expect(validateRoomTitle("x".repeat(81))).toBe(false);
  expect(validateRoomTitle(undefined)).toBe(false);
});

const SET_ID = "123e4567-e89b-12d3-a456-426614174000";
function setCtx() {
  return { params: Promise.resolve({ id: SET_ID }) } as any;
}
function setReq(body: unknown) {
  return new Request("http://localhost/", { method: "POST", body: JSON.stringify(body) });
}
function setDb(ownerId: string | null, updated: { patch?: unknown } = {}) {
  return {
    from: () => ({
      select: () => ({ eq: () => ({ single: async () => ({ data: ownerId ? { owner_id: ownerId } : null }) }) }),
      update: (patch: unknown) => ({
        eq: () => ({
          select: () => ({
            single: async () => {
              updated.patch = patch;
              return { data: { id: SET_ID, ...((patch as object) ?? {}) }, error: null };
            },
          }),
        }),
      }),
    }),
  };
}

test("settings rejects unauthenticated, bad uuid, and empty patch", async () => {
  vi.mocked(requireUser).mockRejectedValue(new Error("nope"));
  expect((await settingsPOST(setReq({ title: "T" }), setCtx())).status).toBe(401);
  vi.mocked(requireUser).mockResolvedValue({ id: "u1", email: "u@e" } as any);
  expect(
    (await settingsPOST(setReq({ title: "T" }), { params: Promise.resolve({ id: "nope" }) } as any)).status,
  ).toBe(404);
  expect((await settingsPOST(setReq({}), setCtx())).status).toBe(400);
  expect((await settingsPOST(setReq({ title: "  " }), setCtx())).status).toBe(400);
  expect((await settingsPOST(setReq({ category: "Diecast" }), setCtx())).status).toBe(400);
});

test("settings enforces ownership and applies a partial patch", async () => {
  vi.mocked(requireUser).mockResolvedValue({ id: "intruder", email: "x@e" } as any);
  vi.mocked(adminDb).mockReturnValue(setDb("u1") as any);
  expect((await settingsPOST(setReq({ title: "New" }), setCtx())).status).toBe(403);
  vi.mocked(requireUser).mockResolvedValue({ id: "u1", email: "u@e" } as any);
  const updated: { patch?: unknown } = {};
  vi.mocked(adminDb).mockReturnValue(setDb("u1", updated) as any);
  const res = await settingsPOST(setReq({ title: "New", category: "TCG" }), setCtx());
  expect(res.status).toBe(200);
  expect(updated.patch).toEqual({ title: "New", category: "TCG" });
});

test("GET /api/rooms/[id] selects explicit columns only (no select *)", async () => {
  const id = "123e4567-e89b-12d3-a456-426614174000";
  const row = { id, title: "T", seller_name: "S", owner_id: "u1", status: "live", created_at: "2026-09-22T00:00:00Z" };
  let cols = "";
  vi.mocked(adminDb).mockReturnValue({
    from: () => ({
      select: (c: string) => {
        cols = c;
        return { eq: () => ({ single: async () => ({ data: row }) }) };
      },
    }),
  } as any);
  const res = await roomGET(new Request("http://localhost/"), { params: Promise.resolve({ id }) } as any);
  expect(cols).toBe("id,title,seller_name,owner_id,status,category,thumbnail_url,created_at");
  expect(await res.json()).toEqual(row);
});
