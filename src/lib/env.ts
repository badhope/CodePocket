import { z } from "zod";

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
  PISTON_API_URL: z.string().url().default("https://emkc.org/api/v2/piston"),
  PISTON_API_KEY: z.string().optional(),
  SENTRY_DSN: z.string().optional(),
  SENTRY_AUTH_TOKEN: z.string().optional(),
  RATE_LIMIT_EXECUTE_PER_MIN: z.coerce.number().default(30),
  RATE_LIMIT_API_PER_MIN: z.coerce.number().default(120),
});

const clientSchema = z.object({
  NEXT_PUBLIC_APP_NAME: z.string().default("OnlineCode"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
  NEXT_PUBLIC_PISTON_URL: z.string().url().default("https://emkc.org/api/v2/piston"),
});

const isServer = typeof window === "undefined";

let _server: z.infer<typeof serverSchema> | null = null;
let _client: z.infer<typeof clientSchema> | null = null;

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
  return _server;
}

function getClientEnv() {
  if (_client) return _client;
  const parsed = clientSchema.safeParse({
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    NEXT_PUBLIC_PISTON_URL: process.env.NEXT_PUBLIC_PISTON_URL,
  });
  _client = parsed.success ? parsed.data : (clientSchema.parse({}) as z.infer<typeof clientSchema>);
  return _client;
}

export const env = isServer ? getServerEnv() : getClientEnv();
export type ServerEnv = z.infer<typeof serverSchema>;
export type ClientEnv = z.infer<typeof clientSchema>;
