// app/[locale]/page.tsx — lobby: lists GET /api/rooms
"use client";
import { use, useEffect, useState } from "react";
import Link from "next/link";

type Room = { id: string; title: string; status: string };

export default function LobbyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = use(params);
  const [rooms, setRooms] = useState<Room[]>([]);
  useEffect(() => {
    fetch("/api/rooms")
      .then((r) => (r.ok ? r.json() : []))
      .then(setRooms)
      .catch(() => setRooms([]));
  }, []);
  return (
    <main>
      <h1>Live auctions</h1>
      {rooms.length === 0 && <p>No live rooms right now.</p>}
      <ul>
        {rooms.map((r) => (
          <li key={r.id}>
            <Link href={`/${locale}/live/${r.id}`}>
              {r.title} ({r.status})
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
