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
