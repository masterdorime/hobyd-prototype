// app/[locale]/page.tsx — lobby: lists GET /api/rooms
"use client";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

type Room = { id: string; title: string; status: string };

export default function LobbyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = use(params);
  const t = useTranslations();
  const [rooms, setRooms] = useState<Room[]>([]);
  useEffect(() => {
    fetch("/api/rooms")
      .then((r) => (r.ok ? r.json() : []))
      .then(setRooms)
      .catch(() => setRooms([]));
  }, []);
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
      <h1 className="text-2xl font-bold sm:text-3xl">
        {t("discover")} · {t("live")}
      </h1>
      {rooms.length === 0 ? (
        <p className="mt-4 text-sm opacity-70">{t("lobbyEmpty")}</p>
      ) : (
        <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rooms.map((r) => (
            <li key={r.id} className="rounded-lg border p-4">
              <p className="font-semibold">{r.title}</p>
              <p className="mt-1 text-sm opacity-70">{r.status}</p>
              <Link
                href={`/${locale}/live/${r.id}`}
                className="mt-3 inline-block rounded bg-black px-4 py-2 text-sm text-white"
              >
                {t("watch")}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
