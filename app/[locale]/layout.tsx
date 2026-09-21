// app/[locale]/layout.tsx — server layout: validates the locale segment,
// sets the request locale, and provides messages to client pages (Task 8).
import type { ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n";
import { LocaleToggle } from "@/components/LocaleToggle";

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
      <header className="mx-auto flex w-full max-w-6xl items-center justify-end px-4 py-3 sm:px-6">
        <LocaleToggle locale={locale} />
      </header>
      {children}
    </NextIntlClientProvider>
  );
}
