// components/BottomNav.tsx — mobile-only (<md) bottom navigation.
"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { browserDb } from "@/lib/supabase/client";
import { cn } from "@/lib/ui";

function itemCls(active: boolean) {
  return cn(
    "pressable flex min-h-12 min-w-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px]",
    active ? "text-accent" : "text-white/60",
  );
}

export function BottomNav({ locale }: { locale: string }) {
  const t = useTranslations();
  const pathname = usePathname();
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [goingLive, setGoingLive] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  useEffect(() => {
    let live = true;
    try {
      const db = browserDb();
      db.auth.getUser().then(({ data }) => {
        if (live) setEmail(data.user?.email ?? null);
      });
      const { data: sub } = db.auth.onAuthStateChange((_event, session) => {
        if (live) setEmail(session?.user?.email ?? null);
      });
      return () => {
        live = false;
        sub.subscription.unsubscribe();
      };
    } catch {
      return undefined;
    }
  }, []);

  async function goLive() {
    if (goingLive) return;
    setGoingLive(true);
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      const body = await res.json().catch(() => null);
      if (res.ok && body?.id) router.push(`/${locale}/live/${body.id}`);
      // On failure stay put — the lobby fetch surfaces room errors.
    } catch {
      // Stay put — the lobby fetch surfaces room errors.
    } finally {
      setGoingLive(false);
    }
  }

  async function signOut() {
    try {
      await browserDb().auth.signOut();
    } finally {
      setEmail(null);
      setAccountOpen(false);
      router.refresh();
    }
  }

  const path = pathname ?? "";
  const discoverHref = `/${locale}`;
  const sellHref = `/${locale}/sell`;
  const loginHref = `/${locale}/login`;
  const isDiscover = path === discoverHref;
  const isSell = path === sellHref || path.startsWith(`${sellHref}/`);
  const isLogin = path === loginHref || path.startsWith(`${loginHref}/`);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-canvas/95 backdrop-blur md:hidden">
      <div className="flex items-stretch gap-1 px-2 pt-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)]">
        <Link
          href={discoverHref}
          aria-current={isDiscover ? "page" : undefined}
          className={itemCls(isDiscover)}
        >
          {t("discover")}
        </Link>
        {email ? (
          <button
            type="button"
            onClick={goLive}
            disabled={goingLive}
            className="pressable min-h-12 min-w-12 flex-1 rounded-xl bg-accent text-[11px] font-semibold text-accent-ink disabled:opacity-50"
          >
            {t("goLive")}
          </button>
        ) : (
          <Link
            href={loginHref}
            aria-current={isLogin ? "page" : undefined}
            className="pressable flex min-h-12 min-w-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl bg-accent text-[11px] font-semibold text-accent-ink"
          >
            {t("goLive")}
          </Link>
        )}
        <Link
          href={sellHref}
          aria-current={isSell ? "page" : undefined}
          className={itemCls(isSell)}
        >
          Sell
        </Link>
        {email ? (
          <button
            type="button"
            onClick={() => setAccountOpen((v) => !v)}
            aria-expanded={accountOpen}
            className={itemCls(accountOpen)}
          >
            <span className="max-w-16 truncate">
              {email.split("@")[0]}
            </span>
          </button>
        ) : (
          <Link
            href={loginHref}
            aria-current={isLogin ? "page" : undefined}
            className={itemCls(isLogin)}
          >
            {t("login")}
          </Link>
        )}
      </div>
      {accountOpen && email ? (
        <div className="px-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)]">
          <button
            type="button"
            onClick={signOut}
            className="pressable flex min-h-12 w-full items-center justify-center rounded-xl bg-white/10 text-[11px] text-white"
          >
            {t("signout")}
          </button>
        </div>
      ) : null}
    </nav>
  );
}
