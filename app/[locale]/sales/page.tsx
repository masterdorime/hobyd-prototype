// app/[locale]/sales/page.tsx — seller "my sales" inbox.
// Sold items I own (closed with an order) with winner contact + tap-to-chat,
// so numbers are findable after the stream ends. Winner names resolve via
// public profiles, same pattern as the Leaderboard.
"use client";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { NeuCard } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CountUp } from "@/components/effects/CountUp";
import { waLink } from "@/lib/contact";
import { displayName } from "@/lib/leaderboard";
import { browserDb } from "@/lib/supabase/client";

type Sale = {
  item_id: string;
  room_id: string;
  title: string;
  img_url: string;
  current_price: number;
  item_status: string;
  order: {
    id: string;
    winner: string;
    winner_contact: string | null;
    status: string;
    paid_at: string | null;
    created_at: string;
  };
};

export default function SalesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = use(params);
  const t = useTranslations();
  const [sales, setSales] = useState<Sale[] | null>(null);
  const [names, setNames] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    fetch("/api/orders/sales")
      .then((r) => (r.ok ? r.json() : null))
      .then((rows) => setSales(Array.isArray(rows) ? rows : null))
      .catch(() => setSales(null));
  }, []);

  useEffect(() => {
    if (!sales) return;
    const ids = [...new Set(sales.map((s) => s.order.winner))].filter((id) => !names.has(id));
    if (ids.length === 0) return;
    (async () => {
      try {
        const { data } = await browserDb().from("profiles").select("id,name").in("id", ids);
        if (!data) return;
        setNames((m) => new Map([...m, ...(data as { id: string; name: string }[]).map((r) => [r.id, r.name] as [string, string])]));
      } catch {
        /* names stay as raw ids */
      }
    })();
  }, [sales, names]);

  return (
    <main className="mx-auto w-full max-w-xl px-4 py-6 sm:px-6">
      <h1 className="display text-2xl font-bold sm:text-3xl">{t("sales")}</h1>
      {sales === null ? (
        <p className="mt-4 text-sm opacity-70">
          <Link href={`/${locale}/login`} className="underline">{t("login")}</Link>
        </p>
      ) : sales.length === 0 ? (
        <p className="mt-4 text-sm opacity-70">{t("noSales")}</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {sales.map((s) => (
            <li key={s.item_id}>
              <NeuCard className="flex gap-3 p-3">
                {s.img_url && (
                  <img
                    src={s.img_url}
                    alt=""
                    loading="lazy"
                    className="aspect-video w-28 shrink-0 self-start rounded-xl object-cover"
                  />
                )}
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate text-sm font-semibold">{s.title}</p>
                    <Badge tone={s.order.status === "paid" ? "live" : "muted"}>
                      {s.order.status}
                    </Badge>
                  </div>
                  <p className="tnum text-sm font-semibold text-accent">
                    <CountUp value={s.current_price} />
                  </p>
                  <p className="tnum truncate text-xs opacity-70">
                    {t("winner")}: {displayName(s.order.winner, names)}
                  </p>
                  {s.order.winner_contact ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="tnum text-xs">{s.order.winner_contact}</span>
                      <a
                        href={waLink(s.order.winner_contact)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="pressable rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-ink"
                      >
                        {t("chatWinner")}
                      </a>
                    </div>
                  ) : (
                    <p className="text-xs opacity-50">{t("noContactYet")}</p>
                  )}
                  <p className="tnum text-[11px] opacity-50">
                    {new Date(s.order.paid_at ?? s.order.created_at).toLocaleString(locale)}
                  </p>
                </div>
              </NeuCard>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
