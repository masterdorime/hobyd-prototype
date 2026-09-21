// app/[locale]/pay/[orderId]/page.tsx — sandbox QRIS checkout (PAY).
// Order summary + public/qris-sandbox.png fixture + countdown from
// created_at + PAYMENT_WINDOW_SEC + mock-confirm button (winner-only) +
// timeout state with relist note. When the Midtrans client key is live,
// the fixture swaps for the Snap embed — the webhook route already
// handles real notify.
"use client";
import { use, useEffect, useState } from "react";

// Mirrors PAYMENT_WINDOW_SEC in .env.example (300 = 5:00). Server env is not
// NEXT_PUBLIC_, so the client cannot read it; keep in sync with the example.
const PAY_WINDOW_SEC = 300;

type Order = {
  id: string;
  item_id: string;
  winner: string;
  status: "pending" | "paid" | "expired" | "cancelled";
  created_at: string;
  paid_at: string | null;
};

function msLeft(o: Order, now: number) {
  return Math.max(
    0,
    new Date(o.created_at).getTime() + PAY_WINDOW_SEC * 1000 - now,
  );
}

function fmt(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(1, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export default function PayPage({
  params,
}: {
  params: Promise<{ locale: string; orderId: string }>;
}) {
  const { orderId } = use(params);
  const [order, setOrder] = useState<Order | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    fetch("/api/orders")
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: Order[]) => {
        setOrder(rows.find((o) => o.id === orderId) ?? null);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [orderId]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const confirm = async () => {
    if (!order) return;
    setConfirming(true);
    setConfirmError(null);
    try {
      const res = await fetch(`/api/orders/${order.id}/mock-confirm`, {
        method: "POST",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setConfirmError(body?.error ?? "confirm_failed");
      } else {
        setOrder({ ...order, status: "paid", paid_at: new Date().toISOString() });
      }
    } catch {
      setConfirmError("confirm_failed");
    } finally {
      setConfirming(false);
    }
  };

  if (!loaded) return <main><p>Loading payment…</p></main>;
  if (!order)
    return (
      <main>
        <h1>Payment not found</h1>
        <p>This order does not exist or you are not its winner.</p>
      </main>
    );

  if (order.status === "paid" || order.paid_at)
    return (
      <main>
        <h1>Payment confirmed</h1>
        <p>Order {order.id} is paid. The seller will contact you for handover.</p>
      </main>
    );

  const left = msLeft(order, now);
  if (order.status !== "pending" || left <= 0)
    return (
      <main>
        <h1>Payment window expired</h1>
        <p>The 5:00 payment window for order {order.id} has passed.</p>
        <p>The seller can relist this item as a new auction item — watch the lobby for its return.</p>
      </main>
    );

  return (
    <main>
      <h1>Pay for your win</h1>
      <section>
        <p>Order {order.id}</p>
        <p>Item {order.item_id}</p>
        <p>Pay within: {fmt(left)}</p>
        {/* Sandbox QR fixture — swap for the Midtrans Snap embed when live. */}
        <img src="/qris-sandbox.png" alt="Sandbox QRIS code" width={240} height={240} />
        <button onClick={confirm} disabled={confirming}>
          {confirming ? "Confirming…" : "I have paid (sandbox confirm)"}
        </button>
        {confirmError && <p>{confirmError}</p>}
      </section>
    </main>
  );
}
