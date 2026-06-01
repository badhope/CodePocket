import { defineRouting } from "next-intl/routing";
import { SUPPORTED_LOCALES, DEFAULT_LOCALE } from "@/lib/constants";

export const routing = defineRouting({
  locales: [...SUPPORTED_LOCALES],
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: "always",
});

export type AppLocale = (typeof routing.locales)[number];
