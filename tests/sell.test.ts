import { validateSellInput } from "../lib/sell";

test("accepts photo + title + positive price", () => {
  expect(
    validateSellInput({ title: "Charizard", img_url: "https://x/y.png", start_price: 100 }),
  ).toEqual({ ok: true });
});

test("rejects blank title and bad price", () => {
  expect(validateSellInput({ title: " ", img_url: "u", start_price: 10 }).ok).toBe(false);
  expect(validateSellInput({ title: "A", img_url: "u", start_price: 0 }).ok).toBe(false);
  expect(validateSellInput({ title: "A", img_url: "", start_price: 10 }).ok).toBe(false);
});
