// app/[locale]/live/[roomId]/page.tsx — watch + bid + countdown + closer
"use client";
import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { LiveVideo } from "@/components/LiveVideo";
import { BidFeed } from "@/components/BidFeed";
import { BidForm } from "@/components/BidForm";
import { browserDb } from "@/lib/supabase/client";

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
  const [activeId, setActiveId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);
  const closeFired = useRef<Set<string>>(new Set());

  const active = items.find((i) => i.id === activeId) ?? null;

  useEffect(() => {
    fetch(`/api/items?room_id=${encodeURIComponent(roomId)}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: Item[]) => {
        setItems(rows);
        setActiveId(rows.find((i) => i.status === "live")?.id ?? rows[0]?.id ?? null);
      })
      .catch(() => setItems([]));
  }, [roomId]);

  // Subscribe to the active item row (price / ends_at / status updates).
  useEffect(() => {
    if (!activeId) return;
    const db = browserDb();
    const ch = db
      .channel(`items-${activeId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "items", filter: `id=eq.${activeId}` },
        (p) =>
          setItems((cur) => cur.map((i) => (i.id === activeId ? { ...i, ...(p.new as object) } : i))),
      )
      .subscribe();
    return () => {
      db.removeChannel(ch);
    };
  }, [activeId]);

  // Tick the countdown; fire the closer once when the timer hits zero.
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
            setItems((cur) => cur.map((i) => (i.id === active.id ? { ...i, status: "closed" } : i)));
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
      setError(body?.error ?? "bid_failed");
    }
  };

  const left = active ? msLeft(active.ends_at, now) : 0;

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
      {/* Mobile-first single column; desktop splits video | bidding 2-col. */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="min-w-0">
          <LiveVideo roomId={roomId} />
          {items.length > 1 && (
            <ul className="mt-4 flex flex-col gap-2">
              {items.map((i) => (
                <li key={i.id}>
                  <button
                    onClick={() => setActiveId(i.id)}
                    className="w-full rounded border px-3 py-2 text-left text-sm"
                  >
                    {i.title} ({i.status})
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="min-w-0">
          {!active && <p className="text-sm opacity-70">{t("waiting")}</p>}
          {active && (
            <div className="flex flex-col gap-3">
              <h1 className="text-xl font-bold sm:text-2xl">{active.title}</h1>
              {active.img_url && (
                <img
                  src={active.img_url}
                  alt={active.title}
                  className="h-auto w-full rounded object-cover"
                />
              )}
              <p className="text-lg">
                {t("current")}: Rp{active.current_price.toLocaleString("id-ID")}
              </p>
              <p className="text-sm tabular-nums opacity-80">
                {t("endsIn")}: {Math.floor(left / 1000)} {t("seconds")}
              </p>
              {active.status === "closed" ? (
                <Link
                  href={`/${locale}/win/${active.id}`}
                  className="inline-block rounded bg-black px-4 py-2 text-sm text-white"
                >
                  {t("seeResult")}
                </Link>
              ) : (
                <BidForm current={active.current_price} onBid={placeBid} />
              )}
              {error && <p className="text-sm text-red-600">{error}</p>}
              <BidFeed itemId={active.id} />
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
