import { STALE_MS, isStale } from "../lib/sweep";

test("STALE_MS is ten minutes", () => {
  expect(STALE_MS).toBe(10 * 60_000);
});

test("isStale flags rooms past the TTL", () => {
  const now = Date.now();
  const old = new Date(now - 11 * 60_000).toISOString();
  const fresh = new Date(now - 9 * 60_000).toISOString();
  expect(isStale(old, now)).toBe(true);
  expect(isStale(fresh, now)).toBe(false);
  expect(isStale("not-a-date", now)).toBe(false);
  expect(isStale(old, now, 60_000)).toBe(true);
  expect(isStale(fresh, now, 60 * 60_000)).toBe(false);
});
