// app/[locale]/win/[itemId]/page.tsx — winner display, consumed by Task 7 pay page.
// RULING R2: resolve the order by item (GET /api/orders?item_id=, visible to
// winner or seller) and link the correct /pay/{orderId} — not /pay/{itemId}.
// Task 11 restyle (visual-only): a real modal — dimming scrim, dialog that
// springs in with uiSpring (exit mirrors the enter path), background pushed
// back behind the scrim. Fetches, branches, and links are untouched.
"use client";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { motion } from "motion/react";
import { uiSpring, useEnter } from "@/lib/motion";

type Item = {
  id: string;
  title: string;
  current_price: number;
  status: string;
  winner: string | null;
};

type Order = {
  id: string;
  item_id: string;
  winner: string;
  status: string;
};

export default function WinPage({
  params,
}: {
  params: Promise<{ locale: string; itemId: string }>;
}) {
  const { locale, itemId } = use(params);
  const t = useTranslations();
  const [item, setItem] = useState<Item | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [orderDone, setOrderDone] = useState(false);
  const enter = useEnter(uiSpring, 24);
  useEffect(() => {
    fetch("/api/items")
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: Item[]) => setItem(rows.find((i) => i.id === itemId) ?? null))
      .catch(() => setItem(null));
    fetch(`/api/orders?item_id=${encodeURIComponent(itemId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((o) => {
        setOrder(o && o.id ? o : null);
        setOrderDone(true);
      })
      .catch(() => setOrderDone(true));
  }, [itemId]);
  return (
    <main className="mx-auto w-full max-w-xl px-4 py-10 sm:px-6">
      <h1 className="display text-2xl font-bold uppercase sm:text-3xl">{t("win")}</h1>
      {item && order ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Dimming scrim; background sits pushed back behind it. */}
          <motion.div
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={enter.transition}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          />
          <motion.section
            role="dialog"
            aria-modal="true"
            aria-labelledby="win-title"
            initial={enter.initial}
            animate={enter.animate}
            exit={enter.initial}
            transition={enter.transition}
            className="relative flex w-full max-w-md flex-col gap-2 rounded-2xl border border-white/10 bg-overlay p-4 shadow-2xl shadow-black/60 sm:p-6"
          >
            <h2 id="win-title" className="display text-lg font-semibold">
              {item.title}
            </h2>
            <p className="tnum">Rp{item.current_price.toLocaleString("id-ID")}</p>
            <p className="text-sm opacity-80">
              {t("winner")}: {order.winner}
            </p>
            <Link
              href={`/${locale}/pay/${order.id}`}
              className="pressable mt-2 inline-block rounded-full bg-accent px-4 py-2 text-center text-sm font-semibold text-accent-ink"
            >
              {t("payNow")}
            </Link>
          </motion.section>
        </div>
      ) : orderDone ? (
        <p className="mt-4 text-sm opacity-70">{t("resultUnavailable")}</p>
      ) : (
        <p className="mt-4 text-sm opacity-70">{t("loadingResult")}</p>
      )}
    </main>
  );
}
