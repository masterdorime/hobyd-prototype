// tests/i18n.test.ts
import id from "../messages/id.json";
import en from "../messages/en.json";
test("locales share keys", () => {
  expect(Object.keys(id).sort()).toEqual(Object.keys(en).sort());
  expect(id.bid).toBe("Tawar");
  expect(en.bid).toBe("Bid");
});
