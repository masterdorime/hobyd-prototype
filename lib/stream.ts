// lib/stream.ts — room lifecycle machine + shared route guards (pure, tested).
export type RoomStatus = "lobby" | "preview" | "live" | "ended";

const NEXT: Record<RoomStatus, RoomStatus[]> = {
  lobby: ["preview"],
  preview: ["live", "ended"],
  live: ["ended"],
  ended: [],
};

export function canTransition(from: string, to: string): boolean {
  const next = (NEXT as Record<string, string[]>)[from];
  return Array.isArray(next) && next.includes(to);
}

export function isUuid(v: unknown): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
  );
}
