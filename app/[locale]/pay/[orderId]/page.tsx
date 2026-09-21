// app/[locale]/pay/[orderId]/page.tsx — sandbox QRIS checkout (PAY).
// Order summary + public/qris-sandbox.png fixture + countdown from
// created_at + PAYMENT_WINDOW_SEC + mock-confirm button (winner-only) +
// timeout state with relist note. When the Midtrans client key is live,
// the fixture swaps for the Snap embed — the webhook route already
// handles real notify.
// Task 11 restyle (visual-only): heavier material card, framed QR,
// tabular countdown, pressable confirm, confirm errors announced with
// role=alert (a11y). All state, timers, writers, and branches untouched.
"use client";
import { use, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

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
  const t = useTranslations();
  const [order, setOrder] = useState<Order | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const expireFired = useRef(false);

  useEffect(() => {
    expireFired.current = false;
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

  // Fire the pending→expired writer once when the window lapses. Depends on
  // the ticking clock: `order` alone never changes at the zero crossing.
  useEffect(() => {
    if (!order || order.status !== "pending" || expireFired.current) return;
    if (msLeft(order, now) > 0) return;
    expireFired.current = true;
    fetch(`/api/orders/${order.id}/expire`, { method: "POST" })
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        if (body?.expired)
          setOrder((o) => (o ? { ...o, status: "expired" } : o));
      })
      .catch(() => {});
  }, [order, now]);

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

  if (!loaded)
    return (
      <main className="mx-auto w-full max-w-xl px-4 py-10 sm:px-6">
        <p className="text-sm opacity-70">{t("loadingPayment")}</p>
      </main>
    );
  if (!order)
    return (
      <main className="mx-auto w-full max-w-xl px-4 py-10 sm:px-6">
        <h1 className="display text-2xl font-bold sm:text-3xl">{t("paymentNotFound")}</h1>
        <p className="mt-4 text-sm opacity-70">{t("paymentNotFoundNote")}</p>
      </main>
    );

  if (order.status === "paid" || order.paid_at)
    return (
      <main className="mx-auto w-full max-w-xl px-4 py-10 sm:px-6">
        <h1 className="display text-2xl font-bold sm:text-3xl">{t("paymentConfirmed")}</h1>
        <p className="mt-4 text-sm opacity-70">
          Order {order.id} {t("paidNote")}
        </p>
      </main>
    );

  const left = msLeft(order, now);
  if (order.status !== "pending" || left <= 0)
    return (
      <main className="mx-auto w-full max-w-xl px-4 py-10 sm:px-6">
        <h1 className="display text-2xl font-bold sm:text-3xl">{t("payTitle")}</h1>
        <p className="mt-4 text-sm opacity-70">
          Order {order.id}: {t("expiredNote")}
        </p>
        <p className="mt-2 text-sm opacity-70">{t("relistNote")}</p>
      </main>
    );

  return (
    <main className="mx-auto w-full max-w-xl px-4 py-10 sm:px-6">
      <p className="text-sm uppercase tracking-wide opacity-60">{t("pay")}</p>
      <h1 className="display mt-1 text-2xl font-bold sm:text-3xl">{t("payTitle")}</h1>
      <section className="mt-6 flex flex-col gap-2 rounded-2xl border border-white/10 bg-overlay p-4 shadow-2xl shadow-black/60 backdrop-blur-xl sm:p-6">
        <p className="text-sm">Order {order.id}</p>
        <p className="text-sm opacity-80">Item {order.item_id}</p>
        <p className="tnum text-sm">
          {t("payWithin")}: {fmt(left)}
        </p>
        {/* Sandbox QR fixture — swap for the Midtrans Snap embed when live. */}
        <img
          src="/qris-sandbox.png"
          alt="Sandbox QRIS code"
          width={240}
          height={240}
          className="h-auto w-full max-w-[240px] rounded-xl bg-white p-3"
        />
        <button
          onClick={confirm}
          disabled={confirming}
          className="pressable mt-2 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-ink disabled:opacity-50"
        >
          {confirming ? t("confirming") : t("paidConfirm")}
        </button>
        {confirmError && (
          <p role="alert" className="text-sm text-red-400">
            {confirmError}
          </p>
        )}
      </section>
    </main>
  );
}
