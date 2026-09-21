// tests/orders.test.ts
import { canConfirm } from "../app/api/orders/[id]/mock-confirm/route";
import { isExpired } from "../app/api/orders/[id]/expire/route";
test("only winner confirms", () => {
  expect(canConfirm({ caller: "w", winner: "w" })).toBe(true);
  expect(canConfirm({ caller: "x", winner: "w" })).toBe(false);
});
test("order expires only after the payment window", () => {
  expect(isExpired({ createdAtMs: 0, nowMs: 299_999, windowSec: 300 })).toBe(false);
  expect(isExpired({ createdAtMs: 0, nowMs: 300_000, windowSec: 300 })).toBe(true);
  expect(isExpired({ createdAtMs: 1_000, nowMs: 301_000, windowSec: 300 })).toBe(true);
});
