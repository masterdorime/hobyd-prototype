import { isUrgent, quickAmounts } from "../lib/format";

test("isUrgent flags last 10s only", () => {
  expect(isUrgent(10000)).toBe(true);
  expect(isUrgent(0)).toBe(true);
  expect(isUrgent(10001)).toBe(false);
});

test("quickAmounts steps above current", () => {
  expect(quickAmounts(1250000)).toEqual([1260000, 1300000, 1350000]);
});
