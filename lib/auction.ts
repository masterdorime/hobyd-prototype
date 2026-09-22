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
