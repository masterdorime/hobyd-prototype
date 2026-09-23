import { cn } from "../lib/ui";
import { formatIDR, countdownParts, elapsedParts, bidErrorMessage } from "../lib/format";

test("cn merges truthy classes only", () => {
  expect(cn("a", false && "b", "c", undefined, null, "")).toBe("a c");
});

test("formatIDR uses id-ID grouping", () => {
  expect(formatIDR(1250000)).toBe("Rp1.250.000");
  expect(formatIDR(0)).toBe("Rp0");
});

test("countdownParts splits ms into mm:ss", () => {
  expect(countdownParts(300000)).toEqual({ m: "05", s: "00" });
  expect(countdownParts(16000)).toEqual({ m: "00", s: "16" });
  expect(countdownParts(-5)).toEqual({ m: "00", s: "00" });
});

test("elapsedParts reads MM:SS, then H:MM:SS", () => {
  expect(elapsedParts(65000)).toBe("01:05");
  expect(elapsedParts(5 * 3600000 + 42000)).toBe("5:00:42");
  expect(elapsedParts(-5)).toBe("00:00");
});

test("bidErrorMessage maps codes ID+EN", () => {
  expect(bidErrorMessage("closed", "id")).toMatch(/tutup|berakhir/i);
  expect(bidErrorMessage("closed", "en")).toMatch(/closed/i);
  expect(bidErrorMessage("too_low", "en")).toMatch(/higher/i);
  expect(bidErrorMessage("rate_limited", "id")).toMatch(/detik|tunggu/i);
  expect(bidErrorMessage("unknown_code", "en")).toBe("unknown_code");
});
