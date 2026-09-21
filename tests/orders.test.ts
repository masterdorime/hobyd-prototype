// tests/orders.test.ts
import { canConfirm } from "../app/api/orders/[id]/mock-confirm/route";
test("only winner confirms", () => {
  expect(canConfirm({ caller: "w", winner: "w" })).toBe(true);
  expect(canConfirm({ caller: "x", winner: "w" })).toBe(false);
});
