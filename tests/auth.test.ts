import { expect, test } from "vitest";
import { isSeller } from "../lib/auth";
test("only allowlisted email is seller", () => {
  process.env.SELLER_ALLOWLIST = "seller@hobyd.id";
  expect(isSeller("seller@hobyd.id")).toBe(true);
  expect(isSeller("bidder@x.id")).toBe(false);
  expect(isSeller("SELLER@HOBYD.ID")).toBe(true);
});
