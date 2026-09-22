import { buildStartUpdate } from "../lib/auction";

test("bid start stamps a fresh live timer", () => {
  const now = new Date("2026-09-22T10:00:00Z").getTime();
  expect(buildStartUpdate(now, 120)).toEqual({
    status: "live",
    ends_at: new Date(now + 120_000).toISOString(),
    extensions_used: 0,
  });
});
