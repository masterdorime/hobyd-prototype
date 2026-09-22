// app/[locale]/live/[roomId]/page.tsx — WATCH+BID with glass live stage.
// Timers, closer, subscriptions, handlers untouched; visual-only hybrid:
// glass overlay (LIVE badge + countdown chip) over video, neu bidding panel,
// CountUp price, mapped ID/EN errors, skeleton while loading.
"use client";
import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { LiveVideo } from "@/components/LiveVideo";
import { BidFeed } from "@/components/BidFeed";
import { BidForm } from "@/components/BidForm";
import { StreamControls } from "@/components/StreamControls";
import { ChatPanel } from "@/components/ChatPanel";
import { Leaderboard } from "@/components/Leaderboard";
import { ListItemForm } from "@/components/ListItemForm";
import { NeuCard } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CountUp } from "@/components/effects/CountUp";
import { browserDb } from "@/lib/supabase/client";
import {
  bidErrorMessage,
  countdownParts,
  isUrgent,
} from "@/lib/format";
import { cn } from "@/lib/ui";

type Item = {
  id: string;
  title: string;
  img_url: string;
  current_price: number;
  ends_at: string;
  status: string;
};

function msLeft(endsAt: string, now: number) {
  return Math.max(0, new Date(endsAt).getTime() - now);
}

export default function LivePage({
  params,
}: {
  params: Promise<{ locale: string; roomId: string }>;
}) {
  const { locale, roomId } = use(params);
  const t = useTranslations();
  const [items, setItems] = useState<Item[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);
  const [room, setRoom] = useState<{ owner_id: string | null; status: string } | null>(null);
  const [me, setMe] = useState<string | null>(null);
  const closeFired = useRef<Set<string>>(new Set());

  const active = items.find((i) => i.id === activeId) ?? null;

  useEffect(() => {
    fetch(`/api/items?room_id=${encodeURIComponent(roomId)}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: Item[]) => {
        const list = Array.isArray(rows) ? rows : [];
        setItems(list);
        setActiveId(
          list.find((i) => i.status === "live")?.id ?? list[0]?.id ?? null,
        );
      })
      .catch(() => setItems([]))
      .finally(() => setLoaded(true));
  }, [roomId]);

  useEffect(() => {
    if (!activeId) return;
    const db = browserDb();
    const ch = db
      .channel(`items-${activeId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "items", filter: `id=eq.${activeId}` },
        (p) =>
          setItems((cur) =>
            cur.map((i) => (i.id === activeId ? { ...i, ...(p.new as object) } : i)),
          ),
      )
      .subscribe();
    return () => {
      db.removeChannel(ch);
    };
  }, [activeId]);

  useEffect(() => {
    fetch(`/api/rooms/${encodeURIComponent(roomId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((row) => row && setRoom({ owner_id: row.owner_id ?? null, status: row.status }))
      .catch(() => {});
    browserDb().auth.getUser().then(({ data }) => setMe(data.user?.id ?? null)).catch(() => setMe(null));
    const db = browserDb();
    const ch = db.channel(`room-${roomId}`)
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "rooms", filter: `id=eq.${roomId}` },
        (p) => setRoom((r) => r && { ...r, status: (p.new as { status: string }).status }))
      .subscribe();
    return () => { db.removeChannel(ch); };
  }, [roomId]);

  // Loading sentinel until the room fetch resolves — avoids flashing the
  // LIVE badge or mounting LiveVideo for a room that may be preview/ended.
  const roomStatus = room?.status ?? "loading";
  const isOwner = !!me && !!room && me === room.owner_id;

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (!active || active.status === "closed") return;
    if (msLeft(active.ends_at, now) <= 0 && !closeFired.current.has(active.id)) {
      closeFired.current.add(active.id);
      fetch(`/api/items/${active.id}/close`, { method: "POST" })
        .then((r) => (r.ok ? r.json() : null))
        .then((body) => {
          if (body && ("closed" in body || "noop" in body))
            setItems((cur) =>
              cur.map((i) => (i.id === active.id ? { ...i, status: "closed" } : i)),
            );
        })
        .catch(() => {});
    }
  }, [active, now]);

  const placeBid = async (amount: number) => {
    if (!active) return;
    setError(null);
    const res = await fetch("/api/bids", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ item_id: active.id, amount }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(bidErrorMessage(body?.error ?? "bid_failed", locale));
    }
  };

  const left = active ? msLeft(active.ends_at, now) : 0;
  const urgent = active !== null && isUrgent(left);
  const { m, s } = countdownParts(left);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="min-w-0">
          {isOwner && room && (
            <div className="mb-3">
              <StreamControls roomId={roomId} roomStatus={room.status} activeItemId={activeId} onChange={(s) => setRoom((r) => r && { ...r, status: s })} />
            </div>
          )}
          <div className="relative overflow-hidden rounded-2xl">
            {!room ? (
              <div className="glass-panel flex h-64 items-center justify-center">
                <p className="text-sm text-white/80">{t("waiting")}</p>
              </div>
            ) : roomStatus !== "live" ? (
              isOwner && roomStatus === "preview" ? (
                <LiveVideo key="owner-pub" roomId={roomId} canPublish />
              ) : (
                <div className="glass-panel flex h-64 items-center justify-center">
                  <p className="text-sm text-white/80">{t(roomStatus === "preview" ? "startingSoon" : "streamEnded")}</p>
                </div>
              )
            ) : (
              <LiveVideo key={isOwner ? "owner-pub" : "viewer"} roomId={roomId} canPublish={isOwner} />
            )}
            <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
              {roomStatus === "live" && (
                <Badge tone="live">
                  <span className="live-dot" /> LIVE
                </Badge>
              )}
              {active && active.status !== "closed" && (
                <span
                  className={cn(
                    "glass-panel tnum rounded-full px-3 py-1 text-sm",
                    urgent ? "font-semibold text-accent" : "text-white",
                  )}
                >
                  {m}:{s}
                </span>
              )}
            </div>
          </div>
          {items.length > 1 && (
            <ul className="mt-4 flex flex-col gap-2">
              {items.map((i) => (
                <li key={i.id}>
                  <button
                    onClick={() => setActiveId(i.id)}
                    aria-pressed={i.id === activeId}
                    className={cn(
                      "pressable w-full rounded-xl border px-3 py-2 text-left text-sm backdrop-blur-md",
                      i.id === activeId
                        ? "border-accent/50 bg-accent/10"
                        : "border-white/10 bg-white/5",
                    )}
                  >
                    {i.title} ({i.status})
                  </button>
                </li>
              ))}
            </ul>
          )}
          {isOwner && room && roomStatus !== "ended" && (
            <div className="mt-4">
              <ListItemForm
                roomId={roomId}
                onListed={(item) => {
                  setItems((cur) => [...cur, item]);
                  setActiveId(item.id);
                }}
              />
            </div>
          )}
        </section>
        <section className="min-w-0">
          {!loaded ? (
            <div className="skeleton h-72 rounded-2xl" aria-hidden />
          ) : !active ? (
            <p className="text-sm opacity-70">{t("waiting")}</p>
          ) : (
            <NeuCard className="flex flex-col gap-3 p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <h1 className="display text-xl font-bold sm:text-2xl">
                  {active.title}
                </h1>
                <Badge
                  tone={active.status === "closed" ? "closed" : "muted"}
                >
                  {active.status}
                </Badge>
              </div>
              {active.img_url && (
                <img
                  src={active.img_url}
                  alt={active.title}
                  loading="lazy"
                  className="h-auto w-full rounded-xl object-cover"
                />
              )}
              <p className="text-lg">
                {t("current")}: <CountUp value={active.current_price} />
              </p>
              {active.status !== "closed" && (
                <p
                  className={cn(
                    "tnum text-sm opacity-80",
                    urgent && "font-semibold text-accent opacity-100",
                  )}
                >
                  {t("endsIn")}: {Math.floor(left / 1000)} {t("seconds")}
                </p>
              )}
              {active.status === "closed" ? (
                <Link
                  href={`/${locale}/win/${active.id}`}
                  className="pressable inline-block rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-ink"
                >
                  {t("seeResult")}
                </Link>
              ) : (
                <>
                  <Leaderboard itemId={active.id} />
                  <BidForm current={active.current_price} onBid={placeBid} />
                </>
              )}
              {error && (
                <p role="alert" className="text-sm text-red-400">
                  {error}
                </p>
              )}
              <BidFeed itemId={active.id} />
              <ChatPanel roomId={roomId} roomStatus={roomStatus} />
            </NeuCard>
          )}
        </section>
      </div>
    </main>
  );
}
