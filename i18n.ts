// i18n.ts — next-intl routing + request config (Task 8).
// Locales: id (default) + en. Request config loads the matching
// messages/*.json; unknown locales fall back to the default.
import { defineRouting } from "next-intl/routing";
import { getRequestConfig } from "next-intl/server";

export const routing = defineRouting({
  locales: ["id", "en"],
  defaultLocale: "id",
});

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale =
    requested &&
    (routing.locales as readonly string[]).includes(requested)
      ? (requested as (typeof routing.locales)[number])
      : routing.defaultLocale;
  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
  };
});
