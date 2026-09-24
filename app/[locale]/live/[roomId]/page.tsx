// app/[locale]/live/[roomId]/page.tsx — WATCH+BID with glass live stage.
// Timers, closer, subscriptions, handlers untouched; visual-only hybrid:
// glass overlay (LIVE badge + countdown chip) over video, neu bidding panel,
// CountUp price, mapped ID/EN errors, skeleton while loading.
"use client";
import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { LiveVideo } from "@/components/LiveVideo";
import { BidFeed } from "@/components/BidFeed";
import { BidForm } from "@/components/BidForm";
import { StreamControls } from "@/components/StreamControls";
import { ChatPanel } from "@/components/ChatPanel";
import { Leaderboard } from "@/components/Leaderboard";
import { WinnerPill } from "@/components/WinnerPill";
import { ListItemForm } from "@/components/ListItemForm";
import { ThumbnailSetter } from "@/components/ThumbnailSetter";
import { NeuCard } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CountUp } from "@/components/effects/CountUp";
import { browserDb } from "@/lib/supabase/client";
import {
  bidErrorMessage,
  countdownParts,
  elapsedParts,
  isUrgent,
} from "@/lib/format";
import { cn } from "@/lib/ui";
import { CATEGORIES } from "@/lib/rooms";

type Item = {
  id: string;
  title: string;
  img_url: string;
  current_price: number;
  ends_at: string;
  status: string;
  auction_mode: string;
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
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);
  const [room, setRoom] = useState<{
    owner_id: string | null;
    status: string;
    category: string | null;
    title: string;
    seller_name: string;
    created_at: string;
  } | null>(null);
  const [me, setMe] = useState<string | null>(null);
  const [viewers, setViewers] = useState<number | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [armClose, setArmClose] = useState<string | null>(null);
  const [catMsg, setCatMsg] = useState(false);
  const [acting, setActing] = useState(false);
  const [theater, setTheater] = useState(false);
  const [vidPortrait, setVidPortrait] = useState(false);
  const [vidKnown, setVidKnown] = useState(false);
  const [fsOpen, setFsOpen] = useState(false);
  const [isPortraitHw, setIsPortraitHw] = useState(false);
  const fsRef = useRef<HTMLDivElement>(null);
  // Stream diagnostics: append ?debug=1 to the URL for a track-event readout
  // (publisher capture settings, subscriber events, first frames). Used to
  // pin down device-specific black-video reports; invisible otherwise.
  const [debug, setDebug] = useState(false);
  const [dbgLines, setDbgLines] = useState<string[]>([]);
  useEffect(() => {
    try {
      setDebug(new URLSearchParams(window.location.search).get("debug") === "1");
    } catch {
      /* non-browser — stays off */
    }
  }, []);
  function dbg(line: string) {
    setDbgLines((cur) => [...cur, `${new Date().toLocaleTimeString()}.${String(Date.now() % 1000).padStart(3, "0")} ${line}`].slice(-30));
  }
  const closeFired = useRef<Set<string>>(new Set());

  // Mobile (<md) viewer layout is a separate overlay stack — one matchMedia
  // source of truth, shared by the box, the aside, and the stack itself.
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const f = () => setIsMobile(mq.matches);
    f();
    mq.addEventListener("change", f);
    return () => mq.removeEventListener("change", f);
  }, []);

  // A new room means a new stream — drop the previous orientation verdict.
  useEffect(() => { setVidPortrait(false); setVidKnown(false); setFsOpen(false); }, [roomId]);

  function reportSize(w: number, h: number) {
    setVidPortrait(h > w);
    setVidKnown(true);
  }

  // True-fullscreen landscape overlay (mobile viewers). ESC / OS gesture
  // exits natively — resync state so the overlay unmounts too.
  useEffect(() => {
    const onFs = () => {
      if (!document.fullscreenElement) setFsOpen(false);
    };
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);
  useEffect(() => {
    const mq = window.matchMedia("(orientation: portrait)");
    const f = () => setIsPortraitHw(mq.matches);
    f();
    mq.addEventListener("change", f);
    return () => mq.removeEventListener("change", f);
  }, []);
  useEffect(() => {
    if (!fsOpen) return;
    const el = fsRef.current as (HTMLDivElement & {
      webkitRequestFullscreen?: () => void;
    }) | null;
    try {
      if (el?.requestFullscreen) void el.requestFullscreen().catch(() => {});
      else el?.webkitRequestFullscreen?.();
    } catch {
      /* older iOS: the fixed overlay below still covers the viewport */
    }
  }, [fsOpen]);

  function closeFs() {
    try {
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    } catch {
      /* already exited */
    }
    setFsOpen(false);
  }

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
      .then((row) => row && setRoom({
        owner_id: row.owner_id ?? null,
        status: row.status,
        category: row.category ?? null,
        title: row.title ?? "HOBYD Live",
        seller_name: row.seller_name ?? "",
        created_at: row.created_at ?? new Date().toISOString(),
      }))
      .catch(() => {});
    setViewers(null);
    browserDb().auth.getUser().then(({ data }) => setMe(data.user?.id ?? null)).catch(() => setMe(null));
    const db = browserDb();
    const ch = db.channel(`room-${roomId}`)
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "rooms", filter: `id=eq.${roomId}` },
        (p) => setRoom((r) => {
          if (!r) return r;
          const n = p.new as { status: string; category?: string | null; title?: string };
          return {
            ...r,
            status: n.status,
            category: "category" in n ? (n.category ?? null) : r.category,
            title: "title" in n && typeof n.title === "string" ? n.title : r.title,
          };
        }))
      .subscribe();
    return () => { db.removeChannel(ch); };
  }, [roomId]);

  // Loading sentinel until the room fetch resolves — avoids flashing the
  // LIVE badge or mounting LiveVideo for a room that may be preview/ended.
  const roomStatus = room?.status ?? "loading";
  const isOwner = !!me && !!room && me === room.owner_id;
  // Mobile viewers get the immersive overlay stack; owners keep the stacked
  // scroll layout (they need controls, not immersion).
  const mobileViewer = isMobile && !isOwner;
  const sellerInitial = (room?.seller_name.trim().charAt(0) ?? "?").toUpperCase() || "?";
  const streamMs = room ? now - new Date(room.created_at).getTime() : 0;

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (!active || active.status === "closed" || active.status === "lobby") return;
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

  const placeBid = async (amount: number) => {    if (!active) return;
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
  const biddingOpen =
    !!active &&
    (active.status === "live" ||
      active.status === "extended" ||
      active.status === "ending");

  async function pickCategory(category: string) {
    if (!room) return;
    const res = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/settings`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ category }),
    });
    if (!res.ok) {
      setError(t("actionFailed"));
      return;
    }
    setRoom((r) => (r ? { ...r, category } : r));
    setCatMsg(true);
  }

  async function startBid(id: string) {
    if (acting) return;
    setActing(true);
    try {
      const res = await fetch(`/api/items/${id}/start`, { method: "POST" });
      const body = await res.json().catch(() => null);
      if (res.ok && body?.id)
        setItems((cur) => cur.map((i) => (i.id === id ? { ...i, ...(body as object) } : i)));
      else setError(bidErrorMessage(body?.error ?? "bid_failed", locale));
    } catch {
      setError(bidErrorMessage("bid_failed", locale));
    } finally {
      setActing(false);
    }
  }

  // Theater replaces native fullscreen: the same video box DOM node goes
  // fixed-viewport, so LiveKit never reconnects and publisher tracks survive.
  useEffect(() => {
    if (!theater) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setTheater(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [theater]);

  async function closeBid(id: string) {
    if (armClose !== id) {
      setArmClose(id);
      return;
    }
    if (acting) return;
    setActing(true);
    try {
      const res = await fetch(`/api/items/${id}/settle`, { method: "POST" });
      const body = await res.json().catch(() => null);
      if (res.ok && body && ("closed" in body || "noop" in body)) {
        setItems((cur) => cur.map((i) => (i.id === id ? { ...i, status: "closed" } : i)));
        setArmClose(null);
      } else setError(bidErrorMessage(body?.error ?? "bid_failed", locale));
    } catch {
      setError(bidErrorMessage("bid_failed", locale));
    } finally {
      setActing(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section className="min-w-0">
          {isOwner && room && (
            <div className="mb-3 flex flex-col gap-2">
              {viewers != null && (
                <p className="tnum text-xs text-white/70">
                  {viewers} {t("watching")}
                </p>
              )}
              {room.category == null ? (
                <NeuCard className="flex flex-col gap-2 p-4">
                  <p className="text-sm">{t("pickCategory")}</p>
                  <div className="flex flex-wrap gap-2">
                    {CATEGORIES.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => pickCategory(c)}
                        className="pressable rounded-full border border-white/15 px-3 py-1 text-xs"
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </NeuCard>
              ) : (
                <StreamControls roomId={roomId} roomStatus={room.status} activeItemId={activeId} onChange={(s) => setRoom((r) => r && { ...r, status: s })} />
              )}
              {catMsg && room.category != null && (
                <p className="text-xs text-emerald-300">{t("categorySet")}</p>
              )}
              {roomStatus !== "ended" && <ThumbnailSetter roomId={roomId} />}
            </div>
          )}
          <div
            className={cn(
              "bg-black",
              theater
                ? "fixed inset-0 z-50 flex gap-4 bg-black/95 p-4"
                : mobileViewer
                  ? "fixed inset-0 z-0"
                  : "relative overflow-hidden rounded-2xl",
              !theater && !mobileViewer && vidPortrait && "mx-auto aspect-[9/16] h-[75dvh] max-w-full",
            )}
          >
            {!room ? (
              <div className="glass-panel flex h-64 items-center justify-center">
                <p className="text-sm text-white/80">{t("waiting")}</p>
              </div>
            ) : roomStatus !== "live" ? (
              isOwner && roomStatus === "preview" ? (
                <LiveVideo
                  key="owner-pub"
                  roomId={roomId}
                  canPublish
                  contain={vidPortrait && !isMobile}
                  fill={theater}
                  previewPortrait={isMobile}
                  onVideoSize={reportSize}
                  onViewers={setViewers}
                  onEvent={debug ? dbg : undefined}
                />
              ) : (
                <div className="glass-panel flex h-64 items-center justify-center">
                  <p className="text-sm text-white/80">{t(roomStatus === "preview" ? "startingSoon" : "streamEnded")}</p>
                </div>
              )
            ) : (
              <LiveVideo
                key={isOwner ? "owner-pub" : "viewer"}
                roomId={roomId}
                canPublish={isOwner}
                contain={vidPortrait && !isMobile}
                fill={theater}
                previewPortrait={isOwner && isMobile}
                audioMuted={fsOpen}
                bleed={mobileViewer}
                onVideoSize={reportSize}
                onViewers={setViewers}
                onEvent={debug ? dbg : undefined}
              />
            )}
            {!theater && !isOwner && (
            <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
              {roomStatus === "live" && !mobileViewer && (
                <Badge tone="live">
                  <span className="live-dot" /> LIVE
                </Badge>
              )}
              {viewers != null && (
                <span className="tnum pointer-events-auto rounded-full bg-black/45 px-3 py-1 text-xs text-white backdrop-blur-md">
                  {viewers} {t("watching")}
                </span>
              )}
              {biddingOpen && (
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
            )}
            {mobileViewer && vidKnown && !vidPortrait && roomStatus === "live" && !fsOpen && (
              <div className="absolute bottom-3 right-3">
                <button
                  type="button"
                  onClick={() => setFsOpen(true)}
                  aria-label={t("maximize")}
                  className="pressable rounded-full border border-white/15 bg-black/45 p-2.5 text-white backdrop-blur-md"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4" />
                  </svg>
                </button>
              </div>
            )}
            {room && roomStatus !== "ended" && !isMobile && !theater && (
              <div className="absolute bottom-0 right-0 p-3">
                <button
                  type="button"
                  onClick={() => setTheater((v) => !v)}
                  aria-label={t("theaterMode")}
                  aria-pressed={theater}
                  className="pressable rounded-full border border-white/15 bg-black/45 p-2.5 text-white backdrop-blur-md"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4" />
                  </svg>
                </button>
              </div>
            )}
            {theater && (
              <div className="flex w-[340px] shrink-0 flex-col gap-3 overflow-y-auto">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {roomStatus === "live" && (
                      <Badge tone="live">
                        <span className="live-dot" /> LIVE
                      </Badge>
                    )}
                    {viewers != null && (
                      <span className="tnum rounded-full bg-white/10 px-3 py-1 text-xs text-white">
                        {viewers} {t("watching")}
                      </span>
                    )}
                    {biddingOpen && (
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
                  <button
                    type="button"
                    onClick={() => setTheater(false)}
                    aria-label={t("close")}
                    className="pressable rounded-full border border-white/15 bg-black/45 p-2 text-white backdrop-blur-md"
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                      <path d="M2 2l10 10M12 2L2 12" />
                    </svg>
                  </button>
                </div>
                {loaded && active ? (
                  <>
                    <div className="glass-panel flex items-center gap-3 rounded-2xl p-2.5">
                      {active.img_url && (
                        <img
                          src={active.img_url}
                          alt=""
                          className="aspect-video h-14 shrink-0 rounded-xl object-cover"
                        />
                      )}
                      <div className="min-w-0 flex-1 leading-tight">
                        <p className="truncate text-sm font-semibold text-white">{active.title}</p>
                        <p className="tnum text-sm font-semibold text-accent">
                          <CountUp value={active.current_price} />
                        </p>
                      </div>
                      <Badge tone={active.status === "closed" ? "closed" : "muted"}>
                        {active.status}
                      </Badge>
                    </div>
                    {active.status === "closed" && <WinnerPill itemId={active.id} />}
                    {active.status === "closed" ? (
                      <Link
                        href={`/${locale}/win/${active.id}`}
                        className="pressable rounded-full bg-accent px-4 py-2 text-center text-sm font-semibold text-accent-ink"
                      >
                        {t("seeResult")}
                      </Link>
                    ) : !biddingOpen ? (
                      <p className="rounded-2xl bg-white/5 px-3 py-2 text-center text-sm text-white/80">
                        {t("bidNotStarted")}
                      </p>
                    ) : (
                      <BidForm current={active.current_price} onBid={placeBid} />
                    )}
                    {error && (
                      <p role="alert" className="text-sm text-red-400">
                        {error}
                      </p>
                    )}
                    <div className="glass-panel flex min-h-72 flex-1 flex-col p-3">
                      <ChatPanel roomId={roomId} roomStatus={roomStatus} variant="panel" />
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-white/70">{t("waiting")}</p>
                )}
              </div>
            )}
          </div>
          {!mobileViewer && items.length > 0 && (items.length > 1 || isOwner) && (
            <ul className="mt-4 flex flex-col gap-2">
              {items.map((i) => {
                const liveish =
                  i.status === "live" || i.status === "extended" || i.status === "ending";
                return (
                  <li
                    key={i.id}
                    className={cn(
                      "flex items-center gap-2 rounded-xl border px-3 py-2 text-sm backdrop-blur-md",
                      i.id === activeId
                        ? "border-accent/50 bg-accent/10"
                        : "border-white/10 bg-white/5",
                    )}
                  >
                    <button
                      onClick={() => setActiveId(i.id)}
                      aria-pressed={i.id === activeId}
                      className="min-w-0 flex-1 text-left"
                    >
                      {i.title} ({i.status})
                    </button>
                    <Badge tone="muted">{i.auction_mode === "hard" ? t("hardClose") : t("softClose")}</Badge>
                    {isOwner && room?.category != null && i.status === "lobby" && (
                      <button
                        type="button"
                        onClick={() => startBid(i.id)}
                        disabled={acting}
                        className="pressable shrink-0 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-ink disabled:opacity-50"
                      >
                        {t("startBid")}
                      </button>
                    )}
                    {isOwner && liveish && (
                      <button
                        type="button"
                        onClick={() => closeBid(i.id)}
                        disabled={acting}
                        className={cn(
                          "pressable shrink-0 rounded-full border px-3 py-1 text-xs disabled:opacity-50",
                          armClose === i.id
                            ? "border-red-400/60 bg-red-400/10 font-semibold text-red-300"
                            : "border-white/15",
                        )}
                      >
                        {armClose === i.id ? t("confirmClose") : t("closeBid")}
                      </button>
                    )}
                  </li>
                );
              })}
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
        <aside className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)]">
          {!mobileViewer && !theater && (!loaded ? (
            <div className="skeleton h-72 rounded-2xl" aria-hidden />
          ) : !active ? (
            <p className="text-sm opacity-70">{t("waiting")}</p>
          ) : (
            <NeuCard className="flex shrink-0 flex-col gap-3 p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <h1 className="display text-xl font-bold sm:text-2xl">
                  {active.title}
                </h1>
                <Badge
                  tone={active.status === "closed" ? "closed" : "muted"}
                >
                  {active.status}
                </Badge>
                <Badge tone="muted">
                  {active.auction_mode === "hard" ? t("hardClose") : t("softClose")}
                </Badge>
              </div>
              {active.img_url && (
                <img
                  src={active.img_url}
                  alt={active.title}
                  loading="lazy"
                  className="aspect-video w-full rounded-xl object-cover"
                />
              )}
              <p className="text-lg">
                {t("current")}: <CountUp value={active.current_price} />
              </p>
              {biddingOpen && (
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
              ) : !biddingOpen ? (
                <p className="text-sm opacity-70">{t("bidNotStarted")}</p>
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
              <div className="max-h-48 overflow-y-auto">
                <BidFeed itemId={active.id} />
              </div>
            </NeuCard>
          ))}
          {loaded && active && !mobileViewer && !theater && (
            <div className="glass-panel flex h-96 min-h-0 flex-col p-3 lg:h-auto lg:min-h-64 lg:flex-1">
              <ChatPanel roomId={roomId} roomStatus={roomStatus} variant="panel" />
            </div>
          )}
        </aside>
      </div>
      {mobileViewer && room && (
        <>
          <div className="fixed inset-x-0 top-0 z-20 flex items-start justify-between gap-2 p-3 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
            <div className="flex min-w-0 items-center gap-2 rounded-full bg-black/45 py-1 pl-1 pr-3 backdrop-blur-md">
              <span
                aria-hidden
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-ink"
              >
                {sellerInitial}
              </span>
              <span className="flex min-w-0 flex-col leading-tight">
                <span className="truncate text-[13px] font-semibold text-white">
                  {room.seller_name || room.title}
                </span>
                <span className="tnum flex items-center gap-1.5 text-[11px] text-white/80">
                  <span className="live-dot" /> LIVE · {elapsedParts(streamMs)}
                </span>
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {viewers != null && (
                <span className="tnum rounded-full bg-black/45 px-3 py-1 text-xs text-white backdrop-blur-md">
                  {viewers} {t("watching")}
                </span>
              )}
              {biddingOpen && (
                <span
                  className={cn(
                    "tnum rounded-full bg-black/45 px-3 py-1 text-xs backdrop-blur-md",
                    urgent ? "font-semibold text-accent" : "text-white",
                  )}
                >
                  {m}:{s}
                </span>
              )}
              <button
                type="button"
                onClick={() => router.back()}
                aria-label={t("close")}
                className="pressable rounded-full bg-black/45 p-2 text-white backdrop-blur-md"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                  <path d="M2 2l10 10M12 2L2 12" />
                </svg>
              </button>
            </div>
          </div>
          <div
            className="fixed inset-x-0 z-20 flex flex-col gap-2 p-3"
            style={{ bottom: "calc(env(safe-area-inset-bottom) + 76px)" }}
          >
            {loaded && !fsOpen && <ChatPanel roomId={roomId} roomStatus={roomStatus} variant="overlay" />}
            {active?.status === "closed" && <WinnerPill itemId={active.id} />}
            {active && (
              <div className="glass-panel flex items-center gap-3 rounded-2xl p-2.5">
                {active.img_url && (
                  <img
                    src={active.img_url}
                    alt=""
                    className="aspect-video h-14 shrink-0 rounded-xl object-cover"
                  />
                )}
                <div className="min-w-0 flex-1 leading-tight">
                  <p className="truncate text-sm font-semibold text-white">{active.title}</p>
                  <p className="tnum text-sm font-semibold text-accent">
                    <CountUp value={active.current_price} />
                  </p>
                  {biddingOpen && (
                    <p className={cn("tnum text-xs opacity-80", urgent && "font-semibold text-accent opacity-100")}>
                      {t("endsIn")}: {Math.floor(left / 1000)} {t("seconds")}
                    </p>
                  )}
                </div>
                <Badge tone={active.status === "closed" ? "closed" : "muted"}>
                  {active.status}
                </Badge>
              </div>
            )}
            {loaded && active && (
              active.status === "closed" ? (
                <Link
                  href={`/${locale}/win/${active.id}`}
                  className="pressable rounded-full bg-accent px-4 py-2.5 text-center text-sm font-semibold text-accent-ink"
                >
                  {t("seeResult")}
                </Link>
              ) : !biddingOpen ? (
                <p className="rounded-2xl bg-black/45 px-3 py-2 text-center text-sm text-white backdrop-blur-md">
                  {t("bidNotStarted")}
                </p>
              ) : (
                <div className="glass-panel rounded-2xl p-2.5">
                  <BidForm current={active.current_price} onBid={placeBid} />
                </div>
              )
            )}
            {error && (
              <p role="alert" className="rounded-2xl bg-black/45 px-3 py-2 text-center text-sm text-red-300 backdrop-blur-md">
                {error}
              </p>
            )}
          </div>
        </>
      )}
      {fsOpen && (
        <div
          ref={fsRef}
          role="dialog"
          aria-modal="true"
          aria-label={t("maximize")}
          className="fixed inset-0 z-[60] flex flex-col gap-2 bg-black p-3"
        >
          <div className="flex shrink-0 items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              {roomStatus === "live" && (
                <Badge tone="live">
                  <span className="live-dot" /> LIVE
                </Badge>
              )}
              {viewers != null && (
                <span className="tnum rounded-full bg-white/10 px-3 py-1 text-xs text-white">
                  {viewers} {t("watching")}
                </span>
              )}
              {biddingOpen && (
                <span
                  className={cn(
                    "tnum rounded-full bg-white/10 px-3 py-1 text-xs",
                    urgent ? "font-semibold text-accent" : "text-white",
                  )}
                >
                  {m}:{s}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={closeFs}
              aria-label={t("close")}
              className="pressable shrink-0 rounded-full border border-white/15 bg-black/45 p-2 text-white"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                <path d="M2 2l10 10M12 2L2 12" />
              </svg>
            </button>
          </div>
          {isPortraitHw && (
            <p className="shrink-0 rounded-xl bg-white/10 px-3 py-1.5 text-center text-xs text-white/90">
              {t("rotatePhone")}
            </p>
          )}
          <div className="flex min-h-0 flex-1 gap-2">
            <div className="min-w-0 flex-1 self-center">
              <LiveVideo
                key="viewer-fs"
                roomId={roomId}
                onVideoSize={reportSize}
                onViewers={setViewers}
                onEvent={debug ? dbg : undefined}
              />
            </div>
            <div className="flex w-[46%] max-w-72 shrink-0 flex-col gap-2 overflow-y-auto">
              {active && (
                <div className="glass-panel flex items-center gap-2 rounded-2xl p-2">
                  {active.img_url && (
                    <img
                      src={active.img_url}
                      alt=""
                      className="aspect-video h-10 shrink-0 rounded-lg object-cover"
                    />
                  )}
                  <div className="min-w-0 flex-1 leading-tight">
                    <p className="truncate text-xs font-semibold text-white">{active.title}</p>
                    <p className="tnum text-xs font-semibold text-accent">
                      <CountUp value={active.current_price} />
                    </p>
                  </div>
                </div>
              )}
              {loaded && active && (
                active.status === "closed" ? (
                  <Link
                    href={`/${locale}/win/${active.id}`}
                    className="pressable shrink-0 rounded-full bg-accent px-3 py-1.5 text-center text-xs font-semibold text-accent-ink"
                  >
                    {t("seeResult")}
                  </Link>
                ) : !biddingOpen ? (
                  <p className="shrink-0 rounded-xl bg-white/10 px-2 py-1.5 text-center text-xs text-white/80">
                    {t("bidNotStarted")}
                  </p>
                ) : (
                  <div className="glass-panel shrink-0 rounded-2xl p-2">
                    <BidForm current={active.current_price} onBid={placeBid} />
                  </div>
                )
              )}
              {loaded && (
                <div className="glass-panel flex min-h-48 flex-1 flex-col p-2">
                  <ChatPanel roomId={roomId} roomStatus={roomStatus} variant="panel" />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {debug && dbgLines.length > 0 && (
        <div className="tnum fixed bottom-1 left-1 z-[70] max-h-40 w-64 overflow-y-auto rounded-lg bg-black/80 p-2 font-mono text-[10px] leading-snug text-emerald-300">
          {dbgLines.map((l, i) => (
            <p key={i}>{l}</p>
          ))}
        </div>
      )}
    </main>
  );
}
