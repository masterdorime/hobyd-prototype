// components/BidFeed.tsx
"use client";
import { useEffect, useState } from "react";
import { browserDb } from "@/lib/supabase/client";
export function BidFeed({ itemId }: { itemId: string }) {
  const [bids, setBids] = useState<{ bidder: string; amount: number }[]>([]);
  useEffect(() => {
    const db = browserDb();
    db.from("bids").select("bidder,amount").eq("item_id", itemId)
      .order("created_at", { ascending: false }).limit(20).then(({ data }) => setBids(data ?? []));
    const ch = db.channel(`bids-${itemId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "bids", filter: `item_id=eq.${itemId}` },
        (p) => setBids((b) => [p.new as never, ...b].slice(0, 20)))
      .subscribe();
    return () => { db.removeChannel(ch); };
  }, [itemId]);
  return <ul className="mt-2 flex flex-col gap-1 text-sm">{bids.map((b, i) => <li key={i}>{b.bidder}: Rp{b.amount.toLocaleString("id-ID")}</li>)}</ul>;
}
