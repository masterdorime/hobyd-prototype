import { vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({ adminDb: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireUser: vi.fn() }));

import { adminDb } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth";
import { GET as salesGET } from "../app/api/orders/sales/route";

function dbFor(tables: Record<string, unknown[]>) {
  return {
    from: (table: string) => ({
      select: () => ({
        eq: async () => ({ data: tables[table] ?? [] }),
        in: async () => ({ data: tables[table] ?? [] }),
      }),
    }),
  };
}

test("sales rejects unauthenticated", async () => {
  vi.mocked(requireUser).mockRejectedValue(new Error("nope"));
  expect((await salesGET()).status).toBe(401);
});

test("sales returns [] with no rooms", async () => {
  vi.mocked(requireUser).mockResolvedValue({ id: "s", email: "s@e" } as any);
  vi.mocked(adminDb).mockReturnValue(dbFor({}) as any);
  expect(await (await salesGET()).json()).toEqual([]);
});

test("sales joins owned items with their orders only", async () => {
  vi.mocked(requireUser).mockResolvedValue({ id: "s", email: "s@e" } as any);
  vi.mocked(adminDb).mockReturnValue(dbFor({
    rooms: [{ id: "r1" }],
    items: [
      { id: "i1", room_id: "r1", title: "Sold", img_url: "u", current_price: 5, status: "closed" },
      { id: "i2", room_id: "r1", title: "Unsold", img_url: "u", current_price: 1, status: "lobby" },
    ],
    orders: [{ id: "o1", item_id: "i1", winner: "w", winner_contact: "0812", status: "paid", paid_at: "t", created_at: "t" }],
  }) as any);
  const rows = await (await salesGET()).json();
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({
    item_id: "i1",
    title: "Sold",
    order: expect.objectContaining({ id: "o1", winner_contact: "0812" }),
  });
});
