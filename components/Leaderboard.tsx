// components/Leaderboard.tsx — top-5 live bids for the current item.
// Same bids channel pattern as BidFeed; names resolved via public profiles.
"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { fadeTransition, momentumSpring } from "@/lib/motion";
import { displayName, topBids, type RankedBid } from "@/lib/leaderboard";
import { browserDb } from "@/lib/supabase/client";

export function Leaderboard({ itemId }: { itemId: string }) {
  const t = useTranslations();
  const reduce = useReducedMotion();
  const [bids, setBids] = useState<RankedBid[]>([]);
  const [names, setNames] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    setBids([]);
    const db = browserDb();
    db.from("bids").select("id,bidder,amount,created_at").eq("item_id", itemId)
      .order("created_at", { ascending: false }).limit(20)
      .then(({ data }) => setBids((data ?? []) as RankedBid[]));
    const ch = db.channel(`bids-${itemId}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "bids", filter: `item_id=eq.${itemId}` },
        (p) => setBids((b) => [...b, p.new as RankedBid].slice(-20)))
      .subscribe();
    return () => { db.removeChannel(ch); };
  }, [itemId]);

  useEffect(() => {
    const ids = [...new Set(bids.map((b) => b.bidder))].filter((id) => !names.has(id));
    if (ids.length === 0) return;
    browserDb().from("profiles").select("id,name").in("id", ids)
      .then(({ data }) => {
        if (!data) return;
        setNames((m) => new Map([...m, ...(data as { id: string; name: string }[]).map((r) => [r.id, r.name] as [string, string])]));
      });
  }, [bids, names]);

  const top = topBids(bids);
  if (top.length === 0) return <p className="text-sm opacity-70">{t("noBidsYet")}</p>;
  return (
    <div>
      <h2 className="text-sm font-semibold uppercase tracking-wide opacity-70">{t("topBids")}</h2>
      <ol className="mt-2 flex flex-col gap-1 text-sm">
        <AnimatePresence initial={false}>
          {top.map((b, i) => (
            <motion.li
              key={b.id}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={reduce ? fadeTransition : momentumSpring}
              className="tnum flex items-center justify-between rounded-lg bg-white/5 px-3 py-1.5"
            >
              <span>#{i + 1} {displayName(b.bidder, names)}</span>
              <span className="font-semibold">Rp{b.amount.toLocaleString("id-ID")}</span>
            </motion.li>
          ))}
        </AnimatePresence>
      </ol>
    </div>
  );
}
