import { canTransition, isUuid } from "../lib/stream";

test("preview goes live, live ends, ended is terminal", () => {
  expect(canTransition("preview", "live")).toBe(true);
  expect(canTransition("live", "ended")).toBe(true);
  expect(canTransition("ended", "live")).toBe(false);
});

test("live-to-live is illegal (routes handle idempotency, not the machine)", () => {
  expect(canTransition("live", "live")).toBe(false);
});

test("lobby can only become preview", () => {
  expect(canTransition("lobby", "preview")).toBe(true);
  expect(canTransition("lobby", "live")).toBe(false);
});

test("isUuid accepts uuids, rejects junk", () => {
  expect(isUuid("123e4567-e89b-12d3-a456-426614174000")).toBe(true);
  expect(isUuid("nope")).toBe(false);
  expect(isUuid(undefined)).toBe(false);
});
