// components/WinnerPill.tsx — "X won for RpY" pill for the mobile stack.
// Top bid + profile-name resolution (same pattern as Leaderboard), own
// `winner-<itemId>` topic so it never collides with BidFeed/Leaderboard.
"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { displayName } from "@/lib/leaderboard";
import { formatIDR } from "@/lib/format";
import { browserDb } from "@/lib/supabase/client";

export function WinnerPill({ itemId }: { itemId: string }) {
  const t = useTranslations();
  const [line, setLine] = useState<string | null>(null);

  useEffect(() => {
    setLine(null);
    let live = true;
    const db = browserDb();
    async function load() {
      const { data } = await db.from("bids")
        .select("bidder,amount").eq("item_id", itemId)
        .order("amount", { ascending: false }).limit(1);
      const top = (data as { bidder: string; amount: number }[] | null)?.[0];
      if (!top || !live) return;
      let name = displayName(top.bidder, new Map());
      const { data: prof } = await db.from("profiles").select("id,name").eq("id", top.bidder).single();
      if (!live) return;
      if (prof) name = displayName(top.bidder, new Map([[prof.id as string, prof.name as string]]));
      setLine(`${name} · ${formatIDR(top.amount)}`);
    }
    load();
    const ch = db.channel(`winner-${itemId}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "bids", filter: `item_id=eq.${itemId}` },
        () => load())
      .subscribe();
    return () => {
      live = false;
      db.removeChannel(ch);
    };
  }, [itemId]);

  if (!line) return null;
  return (
    <p className="tnum w-fit max-w-full truncate rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-ink">
      {t("winner")}: {line}
    </p>
  );
}
