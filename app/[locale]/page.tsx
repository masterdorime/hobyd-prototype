// app/[locale]/page.tsx — DISCOVER lobby: hero + category strip + room cards.
// Data flow untouched (GET /api/rooms); visual-only hybrid restyle:
// Spotlight hero (aceternity-style), neu cards, status badges, skeletons.
"use client";
import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { motion } from "motion/react";
import { uiSpring, useEnter } from "@/lib/motion";
import { filterRooms, type Category } from "@/lib/rooms";
import { cn } from "@/lib/ui";
import { NeuCard } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spotlight } from "@/components/effects/Spotlight";

type Room = { id: string; title: string; status: string; thumbnail_url?: string | null };

const CATS: Category[] = ["all", "sneakers", "tcg", "vintage", "electronics"];

function toneFor(status: string): "live" | "ending" | "closed" | "muted" {
  if (status === "live") return "live";
  if (status === "ending") return "ending";
  if (status === "ended" || status === "closed") return "closed";
  // "preview" (and any unknown) shares the muted tone — Badge has no
  // preview variant and we add no new visual language for it.
  return "muted";
}

export default function LobbyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = use(params);
  const t = useTranslations();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [cat, setCat] = useState<Category>("all");
  const enter = useEnter(uiSpring, 16);

  useEffect(() => {
    fetch("/api/rooms")
      .then((r) => (r.ok ? r.json() : []))
      .then((rows) => setRooms(Array.isArray(rows) ? rows : []))
      .catch(() => setRooms([]))
      .finally(() => setLoading(false));
  }, []);

  const visible = useMemo(() => filterRooms(rooms, cat), [rooms, cat]);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-raised px-5 py-8 sm:px-8">
        <Spotlight />
        <p className="text-xs font-semibold tracking-[0.2em] text-accent uppercase">
          Pokemon TCG · Pilot
        </p>
        <h1 className="display mt-2 max-w-xl text-2xl font-bold sm:text-4xl">
          {t("discover")} · {t("live")}
        </h1>
        <p className="mt-2 max-w-xl text-sm opacity-70">
          {t("lobbyEmpty") === "No live rooms right now."
            ? "Real live video, server-authoritative bids, 10s anti-sniping."
            : "Video live asli, bid otoritatif server, anti-sniping 10 detik."}
        </p>
      </section>

      <div
        role="tablist"
        aria-label="categories"
        className="neu-pressed mt-5 flex w-fit max-w-full gap-1 overflow-x-auto rounded-full p-1"
      >
        {CATS.map((c) => (
          <button
            key={c}
            role="tab"
            aria-selected={cat === c}
            onClick={() => setCat(c)}
            className={cn(
              "pressable rounded-full px-4 py-1.5 text-sm whitespace-nowrap capitalize",
              cat === c
                ? "bg-accent font-semibold text-accent-ink"
                : "text-white/70 hover:text-white",
            )}
          >
            {c}
          </button>
        ))}
      </div>

      {loading ? (
        <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <li key={i} className="skeleton h-40 rounded-2xl" aria-hidden />
          ))}
        </ul>
      ) : visible.length === 0 ? (
        <p className="mt-6 text-sm opacity-70">{t("lobbyEmpty")}</p>
      ) : (
        <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((r, i) => (
            <motion.li
              key={r.id}
              initial={enter.initial}
              animate={enter.animate}
              transition={{ ...enter.transition, delay: Math.min(i * 0.05, 0.3) }}
            >
              <NeuCard className="flex flex-col gap-2 p-4">
                {r.thumbnail_url && (
                  <img
                    src={r.thumbnail_url}
                    alt={r.title}
                    loading="lazy"
                    className="h-32 w-full rounded-xl object-cover"
                  />
                )}
                <p className="font-semibold tracking-tight">{r.title}</p>
                <Badge tone={toneFor(r.status)}>
                  {r.status === "live" && <span className="live-dot" />}
                  {r.status === "preview" ? t("startingSoon") : r.status}
                </Badge>
                <Link
                  href={`/${locale}/live/${r.id}`}
                  className="pressable mt-2 inline-block rounded-full bg-accent px-4 py-2 text-center text-sm font-semibold text-accent-ink"
                >
                  {t("watch")}
                </Link>
              </NeuCard>
            </motion.li>
          ))}
        </ul>
      )}
    </main>
  );
}
