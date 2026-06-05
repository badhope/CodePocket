import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/lib/i18n/request.ts");

/**
 * Multi-target Next.js config.
 *
 * Default (dev / server deploy): full Next.js with API routes, Sentry, etc.
 * DEPLOY_TARGET=gh-pages: static export for GitHub Pages — only the
 *   marketing surface (landing, pricing, docs, sign-in/sign-up) is
 *   pre-rendered; interactive pages degrade to the browser-runner
 *   fallback. See [static-demo.ts](src/lib/static-demo.ts).
 */
const isGhPages = process.env.DEPLOY_TARGET === "gh-pages";
const REPO_NAME = "OnlineCode";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Static export only when building for GitHub Pages
  ...(isGhPages ? { output: "export" as const, basePath: `/${REPO_NAME}`, trailingSlash: true } : {}),
  experimental: {
    serverActions: {
      bodySizeLimit: isGhPages ? "1mb" : "10mb",
      ...(isGhPages
        ? { allowedOrigins: ["localhost:3000", "127.0.0.1:3000"] }
        : {}),
    },
  },
  serverExternalPackages: isGhPages
    ? ["isomorphic-git"]
    : ["@sentry/nextjs", "isomorphic-git"],
  images: isGhPages
    ? { unoptimized: true }
    : {
        remotePatterns: [
          { protocol: "https", hostname: "**.public.blob.vercel-storage.com" },
          { protocol: "https", hostname: "avatars.githubusercontent.com" },
          { protocol: "https", hostname: "lh3.googleusercontent.com" },
        ],
      },
  // Public env is inlined at build time so the static bundle knows it's
  // running in demo mode.
  env: isGhPages ? { NEXT_PUBLIC_STATIC_DEMO: "1" } : {},
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: isGhPages ? "SAMEORIGIN" : "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: isGhPages ? "no-cache, no-store, must-revalidate" : "public, max-age=0, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
  webpack: (config) => {
    config.resolve.fallback = { ...config.resolve.fallback, fs: false, net: false, tls: false };
    return config;
  },
};

export default withNextIntl(nextConfig);
