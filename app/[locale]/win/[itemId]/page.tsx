// app/[locale]/win/[itemId]/page.tsx — winner display, consumed by Task 7 pay page.
// RULING R2: resolve the order by item (GET /api/orders?item_id=, visible to
// winner or seller) and link the correct /pay/{orderId} — not /pay/{itemId}.
"use client";
import { use, useEffect, useState } from "react";
import Link from "next/link";

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
    <main>
      <h1>ITEM WON</h1>
      {item && order ? (
        <section>
          <h2>{item.title}</h2>
          <p>Rp{item.current_price.toLocaleString("id-ID")}</p>
          <p>Winner: {order.winner}</p>
          <Link href={`/${locale}/pay/${order.id}`}>Pay now</Link>
        </section>
      ) : orderDone ? (
        <p>Result unavailable — only the winner can view this order.</p>
      ) : (
        <p>Loading result…</p>
      )}
    </main>
  );
}
