import { buildStartUpdate, clampDuration, decideBidOutcome, validateListing } from "../lib/auction";
import { CATEGORIES, isCategory } from "../lib/rooms";

test("soft extends inside the window", () => {
  expect(decideBidOutcome({ timeLeftMs: 3000, windowMs: 10_000, addMs: 10_000, mode: "soft" })).toBe("extend");
});

test("soft maintains outside the window", () => {
  expect(decideBidOutcome({ timeLeftMs: 30_000, windowMs: 10_000, addMs: 10_000, mode: "soft" })).toBe("maintain");
});

test("at-zero never extends (close wins the race)", () => {
  expect(decideBidOutcome({ timeLeftMs: 0, windowMs: 10_000, addMs: 10_000, mode: "soft" })).toBe("reject");
  expect(decideBidOutcome({ timeLeftMs: 0, windowMs: 10_000, addMs: 10_000, mode: "hard" })).toBe("reject");
});

test("hard never extends, accepts while open", () => {
  expect(decideBidOutcome({ timeLeftMs: 3000, windowMs: 10_000, addMs: 10_000, mode: "hard" })).toBe("maintain");
  expect(decideBidOutcome({ timeLeftMs: -5, windowMs: 10_000, addMs: 10_000, mode: "hard" })).toBe("reject");
});

test("validateListing guards hostile input", () => {
  expect(validateListing({ mode: "soft", durationSec: 30 })).toEqual({ ok: true });
  expect(validateListing({ mode: "hard", durationSec: 300 })).toEqual({ ok: true });
  expect(validateListing({ mode: "turbo", durationSec: 30 })).toEqual({ ok: false, error: "invalid_mode" });
  expect(validateListing({ mode: "soft", durationSec: 5 })).toEqual({ ok: false, error: "invalid_duration" });
  expect(validateListing({ mode: "soft", durationSec: 9999 })).toEqual({ ok: false, error: "invalid_duration" });
});

test("clampDuration caps above max (301→300)", () => {
  expect(clampDuration(301)).toBe(300);
});

test("clampDuration floors below min (9→10)", () => {
  expect(clampDuration(9)).toBe(10);
});

test("clampDuration falls back on non-finite (NaN→30)", () => {
  expect(clampDuration(NaN)).toBe(30);
});

test("category set is the spec four plus Other", () => {
  expect([...CATEGORIES]).toEqual(["Sneakers", "TCG", "Vintage Clothing", "Electronics", "Other"]);
  expect(isCategory("TCG")).toBe(true);
  expect(isCategory("Other")).toBe(true);
  expect(isCategory("Pokemon")).toBe(false);
  expect(isCategory(null)).toBe(false);
});
