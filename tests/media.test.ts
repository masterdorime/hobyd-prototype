import { classifyMediaError } from "../lib/media";

test("permission denial maps to blocked", () => {
  expect(classifyMediaError({ name: "NotAllowedError" })).toBe("blocked");
  expect(classifyMediaError({ name: "SecurityError" })).toBe("blocked");
});

test("missing hardware maps to nodevice", () => {
  expect(classifyMediaError({ name: "NotFoundError" })).toBe("nodevice");
  expect(classifyMediaError({ name: "OverconstrainedError" })).toBe("nodevice");
});

test("busy hardware maps to inuse", () => {
  expect(classifyMediaError({ name: "NotReadableError" })).toBe("inuse");
  expect(classifyMediaError({ name: "AbortError" })).toBe("inuse");
});

test("unknown failures default to blocked", () => {
  expect(classifyMediaError(new Error("boom"))).toBe("blocked");
  expect(classifyMediaError(null)).toBe("blocked");
});
