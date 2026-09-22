// lib/rooms.ts — lobby category filter (pure, tested).
export type LobbyRoom = { id: string; title: string; status: string };
export type Category = "all" | "pokemon" | "diecast" | "sneakers";

const HINTS: Record<Exclude<Category, "all">, string[]> = {
  pokemon: ["pokemon", "tcg", "charizard", "pikachu"],
  diecast: ["diecast", "hot wheels", "hw ", "r34", "lbwk"],
  sneakers: ["sneaker", "nike", "jordan", "dunk"],
};

export function filterRooms(rooms: LobbyRoom[], cat: string): LobbyRoom[] {
  if (cat === "pokemon" || cat === "diecast" || cat === "sneakers") {
    const hits = rooms.filter((r) =>
      HINTS[cat].some((h) => r.title.toLowerCase().includes(h)),
    );
    return hits.length > 0 ? hits : rooms;
  }
  return rooms;
}
