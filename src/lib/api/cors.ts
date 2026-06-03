import { NextResponse } from "next/server";

/**
 * Minimal CORS helper. We intentionally allow only a small set of origins:
 *  - the configured app url
 *  - localhost dev origins
 *  - anything in {@link ALLOWED_ORIGINS}
 *
 * In production we refuse to echo back arbitrary origins (no wildcard).
 */

const DEV_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3001",
];

function envOrigins(): string[] {
  const raw = process.env.CORS_ALLOWED_ORIGINS ?? process.env.NEXT_PUBLIC_APP_URL ?? "";
  return raw
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
}

function buildAllowedSet(): Set<string> {
  const set = new Set<string>();
  for (const o of DEV_ORIGINS) set.add(o);
  for (const o of envOrigins()) set.add(o);
  return set;
}

const ALLOWED_ORIGINS = buildAllowedSet();

const DEFAULT_HEADERS = {
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Requested-With, X-Request-Id, Accept",
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Max-Age": "86400",
  Vary: "Origin",
} as const;

export function isOriginAllowed(origin: string | null | undefined): boolean {
  if (!origin) return false;
  return ALLOWED_ORIGINS.has(origin);
}

export function getAllowedOrigin(origin: string | null | undefined): string | null {
  if (!origin) return null;
  return ALLOWED_ORIGINS.has(origin) ? origin : null;
}

/**
 * Apply CORS headers to an existing response. If the request origin is not
 * allowed, the headers are omitted (effectively denying CORS).
 */
export function applyCors(headers: Headers, origin: string | null | undefined): void {
  const allowed = getAllowedOrigin(origin);
  if (!allowed) return;
  headers.set("Access-Control-Allow-Origin", allowed);
  for (const [k, v] of Object.entries(DEFAULT_HEADERS)) {
    if (k === "Vary") continue;
    headers.set(k, v);
  }
  headers.append("Vary", "Origin");
}

/**
 * Build a CORS preflight response.
 */
export function preflight(origin: string | null | undefined, options: { allowedMethods?: string[] } = {}): NextResponse {
  const allowed = getAllowedOrigin(origin);
  const headers = new Headers();
  if (allowed) {
    headers.set("Access-Control-Allow-Origin", allowed);
    headers.set(
      "Access-Control-Allow-Methods",
      options.allowedMethods?.join(", ") ?? DEFAULT_HEADERS["Access-Control-Allow-Methods"],
    );
    headers.set("Access-Control-Allow-Headers", DEFAULT_HEADERS["Access-Control-Allow-Headers"]);
    headers.set("Access-Control-Allow-Credentials", DEFAULT_HEADERS["Access-Control-Allow-Credentials"]);
    headers.set("Access-Control-Max-Age", DEFAULT_HEADERS["Access-Control-Max-Age"]);
  }
  headers.set("Vary", "Origin");
  return new NextResponse(null, { status: allowed ? 204 : 403, headers });
}

/**
 * Wrap a Response with CORS headers. Returns the same response.
 */
export function withCors<T extends Response>(response: T, origin: string | null | undefined): T {
  applyCors(response.headers, origin);
  return response;
}

export const __test__ = { ALLOWED_ORIGINS, DEV_ORIGINS };
