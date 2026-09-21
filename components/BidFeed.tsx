// components/BidFeed.tsx
// Task 11 restyle (visual-only): feed rows animate in from presentation
// values with momentumSpring on bursts (new inserts mount via AnimatePresence;
// the initial list fades/slides once). Reduced-motion users get an opacity
// cross-fade. Data flow untouched — the added `id` column only provides
// stable React keys so inserts (not index-shifted rows) animate.
"use client";
import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { momentumSpring, fadeTransition } from "@/lib/motion";
import { browserDb } from "@/lib/supabase/client";

type Bid = { id: string; bidder: string; amount: number };

export function BidFeed({ itemId }: { itemId: string }) {
  const [bids, setBids] = useState<Bid[]>([]);
  const reduce = useReducedMotion();
  useEffect(() => {
    const db = browserDb();
    db.from("bids").select("id,bidder,amount").eq("item_id", itemId)
      .order("created_at", { ascending: false }).limit(20).then(({ data }) => setBids(data ?? []));
    const ch = db.channel(`bids-${itemId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "bids", filter: `item_id=eq.${itemId}` },
        (p) => setBids((b) => [p.new as Bid, ...b].slice(0, 20)))
      .subscribe();
    return () => { db.removeChannel(ch); };
  }, [itemId]);
  return (
    <ul className="mt-2 flex flex-col gap-1 text-sm">
      <AnimatePresence initial={false}>
        {bids.map((b) => (
          <motion.li
            key={b.id}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduce ? fadeTransition : momentumSpring}
            className="tnum rounded-lg bg-white/5 px-3 py-1.5"
          >
            {b.bidder}: Rp{b.amount.toLocaleString("id-ID")}
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}
