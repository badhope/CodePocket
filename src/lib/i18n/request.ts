import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
    timeZone: "UTC",
    now: new Date(),
    formats: {
      dateTime: {
        short: { day: "numeric", month: "short", year: "numeric" },
        medium: { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" },
        long: {
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        },
      },
    },
  };
});
