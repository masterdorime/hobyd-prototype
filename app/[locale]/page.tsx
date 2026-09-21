// app/[locale]/page.tsx — lobby: lists GET /api/rooms
// Task 11 restyle (visual-only): card hierarchy (title → status chip →
// CTA) with a uiSpring staggered enter. Data flow untouched.
"use client";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { motion } from "motion/react";
import { uiSpring, useEnter } from "@/lib/motion";

type Room = { id: string; title: string; status: string };

export default function LobbyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = use(params);
  const t = useTranslations();
  const [rooms, setRooms] = useState<Room[]>([]);
  const enter = useEnter(uiSpring, 16);
  useEffect(() => {
    fetch("/api/rooms")
      .then((r) => (r.ok ? r.json() : []))
      .then(setRooms)
      .catch(() => setRooms([]));
  }, []);
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
      <h1 className="display text-2xl font-bold sm:text-3xl">
        {t("discover")} · {t("live")}
      </h1>
      {rooms.length === 0 ? (
        <p className="mt-4 text-sm opacity-70">{t("lobbyEmpty")}</p>
      ) : (
        <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rooms.map((r, i) => (
            <motion.li
              key={r.id}
              initial={enter.initial}
              animate={enter.animate}
              transition={{ ...enter.transition, delay: Math.min(i * 0.05, 0.3) }}
              className="flex flex-col rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md"
            >
              <p className="font-semibold tracking-tight">{r.title}</p>
              <p className="mt-2 w-fit rounded-full bg-white/10 px-2.5 py-0.5 text-xs opacity-80">
                {r.status}
              </p>
              <Link
                href={`/${locale}/live/${r.id}`}
                className="pressable mt-4 inline-block rounded-full bg-accent px-4 py-2 text-center text-sm font-semibold text-accent-ink"
              >
                {t("watch")}
              </Link>
            </motion.li>
          ))}
        </ul>
      )}
    </main>
  );
}
