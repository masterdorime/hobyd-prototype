// app/[locale]/login/page.tsx — localized login/signup (plan-gap fix).
// Browser sessions don't exist without auth UI, so bidding 401s. Reuses the
// Task 2 browser client; a successful sign-in/up lands back on the lobby.
"use client";
import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { browserDb } from "@/lib/supabase/client";

export const loginTarget = (locale: string) => `/${locale}`;

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
    const db = browserDb();
    const { error } =
      mode === "in"
        ? await db.auth.signInWithPassword({ email, password })
        : await db.auth.signUp({ email, password });
    if (error) setErr(error.message);
    else router.push(loginTarget(locale));
  }
  return (
    <main>
      <h1>{t("login")}</h1>
      <input aria-label={t("email")} value={email} onChange={(e) => setEmail(e.target.value)} />
      <input aria-label={t("password")} type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      {err && <p>{err}</p>}
      <button onClick={() => go("in")}>{t("signin")}</button>
      <button onClick={() => go("up")}>{t("signup")}</button>
    </main>
  );
}
