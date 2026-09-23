// lib/rooms.ts — lobby category filter (pure, tested).
export type LobbyRoom = { id: string; title: string; status: string; thumbnail_url?: string | null };
export const CATEGORIES = ["Sneakers", "TCG", "Vintage Clothing", "Electronics", "Other"] as const;
export type RoomCategory = (typeof CATEGORIES)[number];

export function isCategory(v: unknown): v is RoomCategory {
  return typeof v === "string" && (CATEGORIES as readonly string[]).includes(v);
}

export type Category = "all" | "sneakers" | "tcg" | "vintage" | "electronics" | "other";

const HINTS: Record<Exclude<Category, "all">, string[]> = {
  sneakers: ["sneaker", "nike", "jordan", "dunk"],
  tcg: ["pokemon", "tcg", "charizard", "pikachu", "gengar"],
  vintage: ["vintage", "clothing", "jacket", "denim"],
  electronics: ["electronics", "phone", "laptop", "camera", "console"],
  // "other" is the complement set — no hints by definition. The other-branch
  // of filterRooms matches titles none of the above cover.
  other: [],
};

export function buildRoomRow(o: { title: string; seller_name: string; owner_id: string; category?: RoomCategory | null }): {
  title: string;
  seller_name: string;
  owner_id: string;
  status: string;
  category?: RoomCategory;
} {
  const row: {
    title: string;
    seller_name: string;
    owner_id: string;
    status: string;
    category?: RoomCategory;
  } = { title: o.title, seller_name: o.seller_name, owner_id: o.owner_id, status: "preview" };
  if (o.category && isCategory(o.category)) row.category = o.category;
  return row;
}

// Stream titles: 1–80 chars after trimming (pure, tested).
export function validateRoomTitle(v: unknown): v is string {
  return typeof v === "string" && v.trim().length >= 1 && v.trim().length <= 80;
}

export function filterRooms(rooms: LobbyRoom[], cat: string): LobbyRoom[] {
  if (cat === "sneakers" || cat === "tcg" || cat === "vintage" || cat === "electronics") {
    const hits = rooms.filter((r) =>
      HINTS[cat].some((h) => r.title.toLowerCase().includes(h)),
    );
    return hits.length > 0 ? hits : rooms;
  }
  if (cat === "other") {
    // Rooms matching no known category hint — the long tail.
    const all = Object.values(HINTS).flat();
    const hits = rooms.filter((r) =>
      !all.some((h) => r.title.toLowerCase().includes(h)),
    );
    return hits.length > 0 ? hits : rooms;
  }
  return rooms;
}
