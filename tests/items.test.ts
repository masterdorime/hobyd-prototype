// tests/items.test.ts
import { buildItemRow } from "../app/api/items/route";
test("item create sets ends_at from server clock", () => {
  const now = new Date("2026-09-21T10:00:00Z").getTime();
  const row = buildItemRow({ room_id: "r", title: "Charizard", img_url: "u", start_price: 100 }, now, 120);
  expect(row.ends_at).toBe(new Date(now + 120_000).toISOString());
  expect(row.current_price).toBe(100);
  expect(row.extensions_used).toBe(0);
  expect(row.status).toBe("live");
});
