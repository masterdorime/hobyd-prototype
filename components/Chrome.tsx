// components/Chrome.tsx — translucent app shell (Task 11, visual-only).
// Sticky blurred header (content scrolls under) with the wordmark left and
// locale toggle + session-aware auth control right; simple footer with the
// demo disclaimer. The header subscribes to Supabase auth state so a
// signed-in user sees their email + sign-out instead of the login link.
// MotionConfig reducedMotion="user" is the library-level kill-switch for
// springs/slides; per-component transitions still branch explicitly.
"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { MotionConfig } from "motion/react";
import { LocaleToggle } from "@/components/LocaleToggle";
import { BottomNav } from "@/components/BottomNav";
import { GoLiveDialog } from "@/components/GoLiveDialog";
import { browserDb } from "@/lib/supabase/client";

export function Chrome({
  locale,
  children,
}: {
  locale: string;
  children: React.ReactNode;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [dialog, setDialog] = useState(false);
  useEffect(() => {
    let live = true;
    try {
      const db = browserDb();
      db.auth.getUser().then(({ data }) => {
        if (live) setEmail(data.user?.email ?? null);
      });
      const { data: sub } = db.auth.onAuthStateChange((_event, session) => {
        setEmail(session?.user?.email ?? null);
      });
      return () => {
        live = false;
        sub.subscription.unsubscribe();
      };
    } catch {
      // Env/client unavailable — stay in logged-out state.
      return undefined;
    }
  }, []);
  async function signOut() {
    try {
      await browserDb().auth.signOut();
    } finally {
      setEmail(null);
      router.refresh();
    }
  }
  return (
    <MotionConfig reducedMotion="user">
      <div className="flex min-h-dvh flex-col bg-canvas text-white">
        <header className="chrome-surface sticky top-0 z-40">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <Link
              href={`/${locale}`}
              className="pressable text-sm font-semibold tracking-tight"
            >
              HOBYD <span className="opacity-50">·</span>{" "}
              <span className="opacity-70">Live Auction</span>
            </Link>
            <div className="flex items-center gap-3">
              <div className="hidden items-center gap-3 md:flex">
                <Link
                  href={`/${locale}/sell`}
                  className="pressable rounded-full bg-white/10 px-3 py-1 text-sm text-white hover:bg-white/15"
                >
                  Sell
                </Link>
                {email && (
                  <Link
                    href={`/${locale}/sales`}
                    className="pressable rounded-full bg-white/10 px-3 py-1 text-sm text-white hover:bg-white/15"
                  >
                    {t("sales")}
                  </Link>
                )}
                {email && (
                  <button
                    type="button"
                    onClick={() => setDialog(true)}
                    className="pressable rounded-full bg-accent px-3 py-1 text-sm font-semibold text-accent-ink disabled:opacity-50"
                  >
                    {t("goLive")}
                  </button>
                )}
                {email ? (
                  <span className="flex items-center gap-2">
                    <span className="max-w-32 truncate text-sm opacity-70">
                      {email}
                    </span>
                    <button
                      onClick={signOut}
                      className="pressable rounded-full bg-white/10 px-3 py-1 text-sm text-white hover:bg-white/15"
                    >
                      {t("signout")}
                    </button>
                  </span>
                ) : (
                  <Link
                    href={`/${locale}/login`}
                    className="pressable rounded-full bg-white/10 px-3 py-1 text-sm text-white hover:bg-white/15"
                  >
                    {t("login")}
                  </Link>
                )}
              </div>
              <LocaleToggle locale={locale} />
            </div>
          </div>
        </header>
        <div className="mx-auto w-full max-w-6xl flex-1 pb-20 md:pb-0">{children}</div>
        <footer className="mt-8 border-t border-white/10">
          <p className="mx-auto w-full max-w-6xl px-4 py-4 text-xs opacity-50 sm:px-6">
            {t("footerNote")}
          </p>
        </footer>
        <BottomNav locale={locale} />
        {dialog && <GoLiveDialog locale={locale} onClose={() => setDialog(false)} />}
      </div>
    </MotionConfig>
  );
}
