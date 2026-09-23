// middleware.ts — locale-prefix routing for /[locale]/* (Task 8).
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n";

export default createMiddleware(routing);

export const config = {
  // Skip API routes, Next internals, and static assets.
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
