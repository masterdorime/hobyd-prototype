// app/[locale]/win/[itemId]/page.tsx — winner display, consumed by Task 7 pay page.
// RULING R2: resolve the order by item (GET /api/orders?item_id=, visible to
// winner or seller) and link the correct /pay/{orderId} — not /pay/{itemId}.
"use client";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

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
      <h1 className="text-2xl font-bold uppercase sm:text-3xl">{t("win")}</h1>
      {item && order ? (
        <section className="mt-6 flex flex-col gap-2 rounded-lg border p-4 sm:p-6">
          <h2 className="text-lg font-semibold">{item.title}</h2>
          <p>Rp{item.current_price.toLocaleString("id-ID")}</p>
          <p className="text-sm opacity-80">
            {t("winner")}: {order.winner}
          </p>
          <Link
            href={`/${locale}/pay/${order.id}`}
            className="mt-2 inline-block rounded bg-black px-4 py-2 text-sm text-white"
          >
            {t("payNow")}
          </Link>
        </section>
      ) : orderDone ? (
        <p className="mt-4 text-sm opacity-70">{t("resultUnavailable")}</p>
      ) : (
        <p className="mt-4 text-sm opacity-70">{t("loadingResult")}</p>
      )}
    </main>
  );
}
