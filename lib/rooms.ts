// lib/rooms.ts — lobby category filter (pure, tested).
export type LobbyRoom = { id: string; title: string; status: string; thumbnail_url?: string | null };
export type Category = "all" | "pokemon" | "diecast" | "sneakers";

const HINTS: Record<Exclude<Category, "all">, string[]> = {
  pokemon: ["pokemon", "tcg", "charizard", "pikachu"],
  diecast: ["diecast", "hot wheels", "hw ", "r34", "lbwk"],
  sneakers: ["sneaker", "nike", "jordan", "dunk"],
};

export function buildRoomRow(o: { title: string; seller_name: string; owner_id: string }): {
  title: string;
  seller_name: string;
  owner_id: string;
  status: string;
} {
  return { title: o.title, seller_name: o.seller_name, owner_id: o.owner_id, status: "preview" };
}

export function filterRooms(rooms: LobbyRoom[], cat: string): LobbyRoom[] {
  if (cat === "pokemon" || cat === "diecast" || cat === "sneakers") {
    const hits = rooms.filter((r) =>
      HINTS[cat].some((h) => r.title.toLowerCase().includes(h)),
    );
    return hits.length > 0 ? hits : rooms;
  }
  return rooms;
}
