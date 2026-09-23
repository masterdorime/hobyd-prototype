// components/LocaleToggle.tsx — ID/EN switch preserving the current path.
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function LocaleToggle({ locale }: { locale: string }) {
  const pathname = usePathname() ?? "/";
  const other = locale === "id" ? "en" : "id";
  const href = pathname.replace(/^\/(id|en)(?=\/|$)/, `/${other}`);
  return (
    <nav aria-label="Language" className="flex items-center gap-2 text-sm">
      <span aria-current={locale === "id" ? "true" : undefined} className={locale === "id" ? "font-bold" : "opacity-60"}>
        ID
      </span>
      <span aria-hidden="true" className="opacity-40">|</span>
      <span aria-current={locale === "en" ? "true" : undefined} className={locale === "en" ? "font-bold" : "opacity-60"}>
        EN
      </span>
      <Link href={href} className="ml-1 rounded border px-2 py-1" aria-label={`Switch to ${other}`}>
        {other.toUpperCase()}
      </Link>
    </nav>
  );
}
