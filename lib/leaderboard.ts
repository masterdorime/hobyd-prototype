// lib/leaderboard.ts — top-bids ranking (pure, tested).
export type RankedBid = { id: string; bidder: string; amount: number; created_at: string };

export function topBids(bids: RankedBid[], n = 5): RankedBid[] {
  return [...bids]
    .sort(
      (a, b) =>
        b.amount - a.amount ||
        (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0) ||
        (a.id < b.id ? -1 : 1),
    )
    .slice(0, n);
}

export function displayName(bidder: string, names: Map<string, string>): string {
  return names.get(bidder) ?? `${bidder.slice(0, 8)}…`;
}
