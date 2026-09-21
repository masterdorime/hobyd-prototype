// components/Chrome.tsx — translucent app shell (Task 11, visual-only).
// Sticky blurred header (content scrolls under) with the wordmark left and
// locale toggle + login link right; simple footer with the demo disclaimer.
// MotionConfig reducedMotion="user" is the library-level kill-switch for
// springs/slides; per-component transitions still branch explicitly.
"use client";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { MotionConfig } from "motion/react";
import { LocaleToggle } from "@/components/LocaleToggle";

export function Chrome({
  locale,
  children,
}: {
  locale: string;
  children: React.ReactNode;
}) {
  const t = useTranslations();
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
              <LocaleToggle locale={locale} />
              <Link
                href={`/${locale}/login`}
                className="pressable rounded-full bg-white/10 px-3 py-1 text-sm text-white hover:bg-white/15"
              >
                {t("login")}
              </Link>
            </div>
          </div>
        </header>
        <div className="mx-auto w-full max-w-6xl flex-1">{children}</div>
        <footer className="mt-8 border-t border-white/10">
          <p className="mx-auto w-full max-w-6xl px-4 py-4 text-xs opacity-50 sm:px-6">
            {t("footerNote")}
          </p>
        </footer>
      </div>
    </MotionConfig>
  );
}
