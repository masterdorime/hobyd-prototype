import { filterRooms, type LobbyRoom } from "../lib/rooms";

const rooms: LobbyRoom[] = [
  { id: "1", title: "Charizard Holo PSA 9", status: "live" },
  { id: "2", title: "Diecast LBWK R34", status: "lobby" },
];

test("all returns everything", () => {
  expect(filterRooms(rooms, "all")).toHaveLength(2);
});

test("pokemon matches tcg/charizard/pokemon titles", () => {
  expect(filterRooms(rooms, "pokemon")).toEqual([rooms[0]]);
});

test("unknown category returns everything", () => {
  expect(filterRooms(rooms, "sneakers")).toHaveLength(2);
});
