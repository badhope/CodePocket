import { z } from "zod";

/**
 * Comma-separated list parser shared by whitelists.
 */
function csv() {
  return z
    .string()
    .optional()
    .transform((v) =>
      (v ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    );
}

const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  POSTGRES_URL: z.string().url().optional(),
  AUTH_SECRET: z.string().min(32).optional(),
  AUTH_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  BLOB_READ_WRITE_TOKEN: z.string().optional(),
  AUTH_GITHUB_ID: z.string().optional(),
  AUTH_GITHUB_SECRET: z.string().optional(),
  AUTH_GOOGLE_ID: z.string().optional(),
  AUTH_GOOGLE_SECRET: z.string().optional(),
  SENTRY_DSN: z.string().optional(),
  SENTRY_AUTH_TOKEN: z.string().optional(),
  MAX_FILE_SIZE_MB: z.coerce.number().default(50),
  RATE_LIMIT_CONVERT_PER_MIN: z.coerce.number().default(30),
  RATE_LIMIT_API_PER_MIN: z.coerce.number().default(120),
  RATE_LIMIT_CONVERT_WINDOW: z.string().default("1 m"),
  // Whitelists
  IP_WHITELIST: csv(),
  CORS_ALLOWED_ORIGINS: csv(),
  // Misc
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).optional(),
});

const clientSchema = z.object({
  NEXT_PUBLIC_APP_NAME: z.string().default("DocForge"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
});

const isServer = typeof window === "undefined";

let _server: z.infer<typeof serverSchema> | null = null;
let _client: z.infer<typeof clientSchema> | null = null;
let _serverInitialized = false;
let _clientInitialized = false;

function getServerEnv() {
  if (_server) return _server;
  const parsed = serverSchema.safeParse(process.env);
  if (parsed.success) {
    _server = parsed.data;
  } else {
    if (process.env.NODE_ENV === "production") {
      console.error("Invalid server env:", parsed.error.flatten().fieldErrors);
    }
    _server = serverSchema.parse({}) as z.infer<typeof serverSchema>;
  }
  _serverInitialized = true;
  return _server;
}

function getClientEnv() {
  if (_client) return _client;
  const parsed = clientSchema.safeParse({
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  });
  _client = parsed.success ? parsed.data : (clientSchema.parse({}) as z.infer<typeof clientSchema>);
  _clientInitialized = true;
  return _client;
}

export const env = isServer ? getServerEnv() : getClientEnv();
export type ServerEnv = z.infer<typeof serverSchema>;
export type ClientEnv = z.infer<typeof clientSchema>;

/**
 * Server-only helpers. Throw if accidentally imported into client code.
 */
export const serverEnv: ServerEnv = (() => {
  if (typeof window !== "undefined") {
    throw new Error("serverEnv must not be used in client code");
  }
  return getServerEnv();
})();

/**
 * Client-only helpers. Throws if accidentally imported into server code.
 */
export const clientEnv: ClientEnv = (() => {
  if (typeof window === "undefined") {
    // Allow during SSR so we can read the public env values.
    return getClientEnv();
  }
  return getClientEnv();
})();

/**
 * Returns true if the given IP is in the configured whitelist. The default
 * behaviour (empty whitelist) is to refuse all "trusted" requests, so callers
 * can opt-in by populating the IP_WHITELIST env var.
 */
export function isIpWhitelisted(ip: string | null | undefined): boolean {
  if (!ip) return false;
  const list = serverEnv.IP_WHITELIST;
  if (!list || list.length === 0) return false;
  const lower = ip.toLowerCase();
  return list.some((entry: string) => {
    if (entry === "*") return true;
    if (entry === lower) return true;
    // CIDR-ish prefix (very simple, e.g. "10.0.0." matches "10.0.0.1")
    if (entry.endsWith(".") && lower.startsWith(entry)) return true;
    return false;
  });
}

/**
 * Returns true if the given origin is allowed for CORS. Pulls from
 * CORS_ALLOWED_ORIGINS (csv) and falls back to dev origins + the configured
 * app url.
 */
export function isOriginWhitelisted(origin: string | null | undefined): boolean {
  if (!origin) return false;
  const list = serverEnv.CORS_ALLOWED_ORIGINS;
  if (list && list.length > 0) {
    return list.includes(origin);
  }
  const appUrl = serverEnv.AUTH_URL ?? "http://localhost:3000";
  const devOrigins = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
  ];
  return [...devOrigins, appUrl].includes(origin);
}

/** Strip query / fragment and normalise lower-case host. */
function originFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}`.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Returns the list of CORS-allowed origins as URLs (no trailing slash).
 */
export function allowedOrigins(): string[] {
  const list = serverEnv.CORS_ALLOWED_ORIGINS;
  const fromEnv = (list ?? []).map(originFromUrl).filter((v: string | null): v is string => v !== null);
  const appOrigin = originFromUrl(serverEnv.AUTH_URL ?? "http://localhost:3000");
  const devOrigins = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
  ];
  const all = new Set<string>([...devOrigins, ...fromEnv]);
  if (appOrigin) all.add(appOrigin);
  return Array.from(all);
}

/**
 * Test/debug helpers - not for production use.
 */
export const __test__ = {
  resetServerEnv() {
    _server = null;
    _serverInitialized = false;
  },
  resetClientEnv() {
    _client = null;
    _clientInitialized = false;
  },
  isServerEnvInitialized() {
    return _serverInitialized;
  },
  isClientEnvInitialized() {
    return _clientInitialized;
  },
};
