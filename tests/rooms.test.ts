import { vi } from "vitest";
import { buildRoomRow, filterRooms, type LobbyRoom } from "../lib/rooms";

vi.mock("@/lib/supabase/admin", () => ({ adminDb: vi.fn() }));

import { adminDb } from "@/lib/supabase/admin";
import { GET as roomGET } from "../app/api/rooms/[id]/route";

const rooms: LobbyRoom[] = [
  { id: "1", title: "Charizard Holo PSA 9", status: "live" },
  { id: "2", title: "Diecast LBWK R34", status: "lobby" },
];

test("all returns everything", () => {
  expect(filterRooms(rooms, "all")).toHaveLength(2);
});

test("pokemon matches tcg/charizard/pokemon titles", () => {
  expect(filterRooms(rooms, "pokemon")).toEqual([rooms[0]]);
});

test("unknown category returns everything", () => {
  expect(filterRooms(rooms, "sneakers")).toHaveLength(2);
});

test("buildRoomRow opens a preview room for any signed-in user", () => {
  expect(buildRoomRow({ title: "HOBYD Live", seller_name: "s@hobyd.id", owner_id: "u1" })).toEqual({
    title: "HOBYD Live",
    seller_name: "s@hobyd.id",
    owner_id: "u1",
    status: "preview",
  });
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
  expect(cols).toBe("id,title,seller_name,owner_id,status,thumbnail_url,created_at");
  expect(await res.json()).toEqual(row);
});
