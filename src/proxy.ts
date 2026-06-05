// @ts-nocheck -- third-party types are incomplete
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "@/lib/i18n/routing";

export default createIntlMiddleware(routing);

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
