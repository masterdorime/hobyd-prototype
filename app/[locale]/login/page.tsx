// app/[locale]/login/page.tsx — localized login/signup (plan-gap fix).
// Browser sessions don't exist without auth UI, so bidding 401s. Reuses the
// Task 2 browser client; a successful sign-in/up lands back on the lobby.
// Task 11 restyle (visual-only): centered card, VISIBLE labels (aria-labels
// kept), email semantics on the email input, errors announced with
// role=alert, focus-visible rings from globals.css. Auth flow untouched.
"use client";
import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { browserDb } from "@/lib/supabase/client";

export const loginTarget = (locale: string) => `/${locale}`;

export function toErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  return "Unknown error";
}

export default function Login({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = use(params);
  const t = useTranslations();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  async function go(mode: "in" | "up") {
    setErr(null);
    try {
      const db = browserDb();
      const { error } =
        mode === "in"
          ? await db.auth.signInWithPassword({ email, password })
          : await db.auth.signUp({ email, password });
      if (error) setErr(error.message);
      else {
        router.push(loginTarget(locale));
        router.refresh();
      }
    } catch (e) {
      setErr(toErrorMessage(e));
    }
  }
  return (
    <main className="mx-auto flex w-full max-w-xl flex-col items-center px-4 py-10 sm:px-6">
      <section className="flex w-full max-w-sm flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md sm:p-6">
        <h1 className="display text-2xl font-bold">{t("login")}</h1>
        <div className="flex flex-col gap-1">
          <label htmlFor="login-email" className="text-sm opacity-80">
            {t("email")}
          </label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            aria-label={t("email")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-white placeholder:text-white/40"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="login-password" className="text-sm opacity-80">
            {t("password")}
          </label>
          <input
            id="login-password"
            aria-label={t("password")}
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-white placeholder:text-white/40"
          />
        </div>
        {err && (
          <p role="alert" className="text-sm text-red-400">
            {err}
          </p>
        )}
        <div className="mt-1 flex gap-2">
          <button
            onClick={() => go("in")}
            className="pressable flex-1 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-ink"
          >
            {t("signin")}
          </button>
          <button
            onClick={() => go("up")}
            className="pressable flex-1 rounded-full bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/15"
          >
            {t("signup")}
          </button>
        </div>
      </section>
    </main>
  );
}
