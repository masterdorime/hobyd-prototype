// tests/chat.test.ts
import { CHAT_RATE_MS, isRateLimited, validateChat } from "../lib/chat";

test("blank nickname or body is invalid (whitespace trimmed)", () => {
  expect(validateChat({ nickname: "   ", body: "hi" })).toEqual({ ok: false, error: "invalid" });
  expect(validateChat({ nickname: "fan", body: "  " })).toEqual({ ok: false, error: "invalid" });
});

test("overlong nick/body is too_long", () => {
  expect(validateChat({ nickname: "f".repeat(25), body: "hi" })).toEqual({ ok: false, error: "too_long" });
  expect(validateChat({ nickname: "fan", body: "x".repeat(201) })).toEqual({ ok: false, error: "too_long" });
});

test("good message passes", () => {
  expect(validateChat({ nickname: " fan ", body: " Charizard! " })).toEqual({ ok: true });
});

test("rate limit is a 2s window", () => {
  expect(CHAT_RATE_MS).toBe(2000);
  expect(isRateLimited(null, 1000)).toBe(false);
  expect(isRateLimited(0, 1999)).toBe(true);
  expect(isRateLimited(0, 2000)).toBe(false);
});
