"use client";

import * as React from "react";

/**
 * Hook that returns `true` when the bundle is being served from a static
 * host (e.g. GitHub Pages) where the server-side API routes are not
 * available. Use this to:
 *
 * - hide the "Sign in" button (auth requires NextAuth server)
 * - show a "static demo" banner on interactive pages
 * - swap server-backed data fetches for local mock data or the
 *   browser-side `frontend-runner` fallback
 *
 * The constant is inlined at build time by Next.js, so there's no runtime
 * cost and the value is stable for SSR.
 */
export function useStaticDemo(): boolean {
  return process.env.NEXT_PUBLIC_STATIC_DEMO === "1";
}

export const IS_STATIC_DEMO = process.env.NEXT_PUBLIC_STATIC_DEMO === "1";
