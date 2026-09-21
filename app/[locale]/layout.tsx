// app/[locale]/layout.tsx — server layout: validates the locale segment,
// sets the request locale, and provides messages to client pages (Task 8).
// Task 11 wraps the page in the translucent Chrome shell (visual-only).
import type { ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n";
import { Chrome } from "@/components/Chrome";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!(routing.locales as readonly string[]).includes(locale)) notFound();
  setRequestLocale(locale);
  const messages = await getMessages();
  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <Chrome locale={locale}>{children}</Chrome>
    </NextIntlClientProvider>
  );
}
