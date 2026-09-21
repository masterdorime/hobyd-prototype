// app/[locale]/win/[itemId]/page.tsx — winner display, consumed by Task 7 pay page
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

export default function WinPage({
  params,
}: {
  params: Promise<{ locale: string; itemId: string }>;
}) {
  const { locale, itemId } = use(params);
  const [item, setItem] = useState<Item | null>(null);
  useEffect(() => {
    fetch("/api/items")
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: Item[]) => setItem(rows.find((i) => i.id === itemId) ?? null))
      .catch(() => setItem(null));
  }, [itemId]);
  return (
    <main>
      <h1>ITEM WON</h1>
      {item ? (
        <section>
          <h2>{item.title}</h2>
          <p>Rp{item.current_price.toLocaleString("id-ID")}</p>
          <Link href={`/${locale}/pay/${item.id}`}>Pay now</Link>
        </section>
      ) : (
        <p>Loading result…</p>
      )}
    </main>
  );
}
