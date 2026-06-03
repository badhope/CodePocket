import { NextResponse, type NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "@/lib/i18n/routing";
import { auth } from "@/lib/auth";

const intlMiddleware = createMiddleware(routing);

// ---------------------------------------------------------------------------
// Route classification
// ---------------------------------------------------------------------------

/** Paths that require an authenticated user. */
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/history",
  "/settings",
  "/convert",
  "/projects",
  "/snippets",
  "/playground",
] as const;

/** Paths accessible to anonymous users. */
const PUBLIC_PREFIXES = [
  "/sign-in",
  "/sign-up",
  "/verify",
  "/api/auth",
  "/api/health",
  "/api/convert/formats",
  "/_next",
  "/icons",
  "/manifest",
  "/sw.js",
  "/robots.txt",
  "/sitemap.xml",
  "/favicon.ico",
] as const;

/** Paths that serve file downloads. */
const DOWNLOAD_PREFIXES = ["/api/convert"] as const;

const PUBLIC_EXACT = new Set<string>(["/"]);

// ---------------------------------------------------------------------------
// Security headers
// ---------------------------------------------------------------------------

const PERMISSIONS_POLICY = [
  "camera=()",
  "microphone=()",
  "geolocation=()",
  "payment=()",
  "usb=()",
  "magnetometer=()",
  "gyroscope=()",
  "accelerometer=()",
  "ambient-light-sensor=()",
  "interest-cohort=()",
].join(", ");

/**
 * Build a strict CSP for the main HTML documents. We intentionally keep
 * `unsafe-inline` for styles and the dev-time Next.js hot-reload shim, and
 * allow self + Vercel blob storage for images.
 */
function buildCsp(nonce: string, isDev: boolean): string {
  const scriptSrc = isDev
    ? `'self' 'nonce-${nonce}' 'unsafe-eval' 'unsafe-inline'`
    : `'self' 'nonce-${nonce}' 'strict-dynamic'`;
  const styleSrc = `'self' 'unsafe-inline'`;
  const directives: Record<string, string> = {
    "default-src": "'self'",
    "script-src": scriptSrc,
    "style-src": styleSrc,
    "img-src": "'self' data: blob: https://*.public.blob.vercel-storage.com https://avatars.githubusercontent.com https://lh3.googleusercontent.com",
    "font-src": "'self' data:",
    "connect-src": isDev
      ? "'self' ws: wss: https://*.sentry.io"
      : "'self' https://*.sentry.io https://*.upstash.io",
    "frame-ancestors": "'none'",
    "form-action": "'self'",
    "base-uri": "'self'",
    "object-src": "'none'",
    "media-src": "'self' blob:",
    "worker-src": "'self' blob:",
    "manifest-src": "'self'",
  };
  return Object.entries(directives)
    .map(([k, v]) => `${k} ${v}`)
    .join("; ");
}

function applySecurityHeaders(headers: Headers, nonce: string, isDev: boolean): void {
  // Some platforms (Vercel) inject a fixed set, so we set safe defaults and
  // never *remove* an existing header.
  headers.set("Content-Security-Policy", buildCsp(nonce, isDev));
  headers.set("X-Frame-Options", "DENY");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", PERMISSIONS_POLICY);
  headers.set("X-DNS-Prefetch-Control", "off");
  headers.set("X-Download-Options", "noopen");
  headers.set("Cross-Origin-Opener-Policy", "same-origin");
  headers.set("Cross-Origin-Resource-Policy", "same-origin");
  // HSTS only in production.
  if (!isDev) {
    headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload",
    );
  }
}

function applyDownloadHeaders(headers: Headers): void {
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Content-Disposition", headers.get("Content-Disposition") ?? "attachment");
  headers.set("X-Frame-Options", "DENY");
}

function generateNonce(): string {
  const g = globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } };
  if (g.crypto?.getRandomValues) {
    const arr = new Uint8Array(16);
    g.crypto.getRandomValues(arr);
    return Buffer.from(arr).toString("base64");
  }
  return Math.random().toString(36).slice(2, 18);
}

// ---------------------------------------------------------------------------
// Route matching
// ---------------------------------------------------------------------------

function stripLocale(pathname: string): { locale: string | null; rest: string } {
  const segments = pathname.split("/").filter(Boolean);
  const locale = segments[0] ?? null;
  const locales = routing.locales as readonly string[];
  if (locale && locales.includes(locale)) {
    return { locale, rest: "/" + segments.slice(1).join("/") };
  }
  return { locale: null, rest: pathname };
}

function isExactPublic(rest: string): boolean {
  return PUBLIC_EXACT.has(rest);
}

function startsWithAny(path: string, prefixes: readonly string[]): boolean {
  for (const p of prefixes) {
    if (path === p || path.startsWith(p + "/") || path.startsWith(p)) {
      return true;
    }
  }
  return false;
}

function isProtectedPath(rest: string): boolean {
  return startsWithAny(rest, PROTECTED_PREFIXES);
}

function isPublicPath(rest: string): boolean {
  return isExactPublic(rest) || startsWithAny(rest, PUBLIC_PREFIXES);
}

function isDownloadPath(pathname: string): boolean {
  return startsWithAny(pathname, DOWNLOAD_PREFIXES);
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isDev = process.env.NODE_ENV !== "production";
  const nonce = generateNonce();

  // Run the intl middleware first so locale redirects are applied uniformly.
  const intlResponse = intlMiddleware(req);

  // Some intl versions return undefined - guard for that.
  const response = intlResponse ?? NextResponse.next();

  // Pass the nonce to downstream server components via a request header.
  // Server components can read it via headers().get("x-nonce").
  response.headers.set("x-nonce", nonce);

  // Apply standard security headers.
  applySecurityHeaders(response.headers, nonce, isDev);

  // Download paths get a few extra hardening headers.
  if (isDownloadPath(pathname)) {
    applyDownloadHeaders(response.headers);
  }

  const { locale, rest } = stripLocale(pathname);
  const activeLocale = locale ?? routing.defaultLocale;

  // Public paths never require auth.
  if (isPublicPath(rest) || isPublicPath(pathname)) {
    return response;
  }

  // Protected paths require an active session. We check both the full
  // pathname (e.g. "/en/dashboard") and the locale-stripped path
  // (e.g. "/dashboard") so the matcher works regardless of the locale
  // segment placement.
  if (isProtectedPath(rest) || isProtectedPath(pathname)) {
    const session = await auth();
    if (!session?.user) {
      const signInUrl = new URL(`/${activeLocale}/sign-in`, req.url);
      signInUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(signInUrl, {
        headers: response.headers,
      });
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};

// Internal helpers exported for testing.
export const __test__ = {
  buildCsp,
  isProtectedPath,
  isPublicPath,
  isDownloadPath,
  stripLocale,
  generateNonce,
  PROTECTED_PREFIXES,
  PUBLIC_PREFIXES,
  DOWNLOAD_PREFIXES,
};
