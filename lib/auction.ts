// lib/auction.ts — bid lifecycle updates (pure, tested).
// Listings are created as lobby (pending); the seller opens bidding
// explicitly, which stamps a fresh timer from the server clock.
export function buildStartUpdate(nowMs: number, durationSec: number) {
  return {
    status: "live",
    ends_at: new Date(nowMs + durationSec * 1000).toISOString(),
    extensions_used: 0,
  };
}

// Bid outcome classes: maintain (accept, clock untouched), extend
// (accept + clock += add), reject (too late — closer wins).
export type BidOutcome = "maintain" | "extend" | "reject";

export function decideBidOutcome(o: {
  timeLeftMs: number;
  windowMs: number;
  addMs: number;
  mode: string;
}): BidOutcome {
  void o.addMs;
  if (o.timeLeftMs < 0) return "reject";
  if (o.timeLeftMs === 0) return "reject";
  if (o.mode === "hard") return "maintain";
  if (o.mode === "soft" && o.timeLeftMs < o.windowMs) return "extend";
  return "maintain";
}

export function validateListing(o: { mode: unknown; durationSec: unknown }): {
  ok: boolean;
  error?: string;
} {
  if (o.mode !== "soft" && o.mode !== "hard")
    return { ok: false, error: "invalid_mode" };
  if (!Number.isInteger(o.durationSec) || (o.durationSec as number) < 10 || (o.durationSec as number) > 300)
    return { ok: false, error: "invalid_duration" };
  return { ok: true };
}
