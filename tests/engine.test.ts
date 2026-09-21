// tests/engine.test.ts
import { decideExtension, allowedByRate } from "../app/api/bids/route";
import { shouldClose } from "../app/api/items/[id]/close/route";

test("late bid never extends", () => {
  expect(decideExtension({ endsAtMs: 1000, nowMs: 1001, used: 0, max: 5 }).extend).toBe(false);
});
test("bid in last 10s extends until cap", () => {
  expect(decideExtension({ endsAtMs: 10_000, nowMs: 5_000, used: 0, max: 5 }).extend).toBe(true);
  expect(decideExtension({ endsAtMs: 10_000, nowMs: 5_000, used: 5, max: 5 }).extend).toBe(false);
});
test("6th last-second bid does not extend", () => {
  const d = decideExtension({ endsAtMs: 10_000, nowMs: 9_500, used: 5, max: 5 });
  expect(d.extend).toBe(false);
});
test("two bids under 1s apart: second rejected", () => {
  expect(allowedByRate({ lastMs: 1000, nowMs: 2000 })).toBe(true);
  expect(allowedByRate({ lastMs: 1000, nowMs: 1000 })).toBe(false);
});
test("closer is idempotent: closed item or live item never closes", () => {
  expect(shouldClose({ status: "closed", endsAtMs: 1000, nowMs: 5000 })).toBe(false);
  expect(shouldClose({ status: "live", endsAtMs: 9000, nowMs: 5000 })).toBe(false);
  expect(shouldClose({ status: "live", endsAtMs: 1000, nowMs: 5000 })).toBe(true);
});
