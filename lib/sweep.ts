// lib/sweep.ts — abandoned-stream janitor (pure, tested).
// TTL and staleness predicate; the side effects live in GET /api/rooms.
export const STALE_MS = 10 * 60_000;

export function isStale(createdAt: string, nowMs: number, ttlMs: number = STALE_MS): boolean {
  const t = new Date(createdAt).getTime();
  if (Number.isNaN(t)) return false;
  return nowMs - t > ttlMs;
}
