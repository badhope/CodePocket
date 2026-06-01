import * as Sentry from "@sentry/nextjs";

const SENTRY_DSN = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;
const TRACES_SAMPLE_RATE = Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1);

Sentry.init({
  dsn: SENTRY_DSN,
  tracesSampleRate: TRACES_SAMPLE_RATE,
  debug: false,
});

export {};
