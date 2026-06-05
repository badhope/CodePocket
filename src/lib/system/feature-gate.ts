"use client";

/**
 * Per-feature gating. A "feature" is anything that has a clear backend
 * requirement (e.g. "convert DOCX to PDF"). Features that work entirely
 * in the browser MUST NOT be in this list — they should be always-on.
 */
import { useBackendStatus } from "./backend-status"

export type FeatureId =
  // playground
  | "playground.piston"
  | "playground.python-packages"
  // converters
  | "convert.docx"
  | "convert.pdf"
  | "convert.xlsx"
  | "convert.pptx"
  | "convert.image-ocr"
  | "convert.batch-upload"
  // user data
  | "auth.sign-in"
  | "auth.sign-up"
  | "snippets.create"
  | "snippets.persist"
  | "projects.create"
  | "projects.persist"
  | "history.view"
  | "dashboard.view"
  // collab
  | "collab.live"
  | "share.create"
  | "share.resolve"

/**
 * A feature is "requires backend" if it has to hit any `/api/*`
 * endpoint that does not have a browser-side fallback.
 */
const REQUIRES_BACKEND: ReadonlySet<FeatureId> = new Set<FeatureId>([
  "playground.piston",
  "playground.python-packages",
  "convert.docx",
  "convert.pdf",
  "convert.xlsx",
  "convert.pptx",
  "convert.image-ocr",
  "convert.batch-upload",
  "auth.sign-in",
  "auth.sign-up",
  "snippets.create",
  "snippets.persist",
  "projects.create",
  "projects.persist",
  "history.view",
  "dashboard.view",
  "collab.live",
  "share.create",
  "share.resolve",
])

export interface FeatureGate {
  /** Does the feature need a live backend? */
  requiresBackend: boolean
  /** Can the user click it right now? */
  enabled: boolean
  /** If locked, the reason */
  reason?: "backend_offline" | "backend_unsupported" | "backend_checking"
  /** Human-readable explanation, suitable for tooltips/banners */
  message?: string
}

export function useFeatureGate(id: FeatureId): FeatureGate {
  const { status, backendAvailable } = useBackendStatus()
  const requiresBackend = REQUIRES_BACKEND.has(id)
  if (!requiresBackend) {
    return { requiresBackend: false, enabled: true }
  }
  if (status.state === "online" || status.state === "degraded") {
    return { requiresBackend: true, enabled: true }
  }
  if (status.state === "checking") {
    return {
      requiresBackend: true,
      enabled: false,
      reason: "backend_checking",
      message: "Checking backend…",
    }
  }
  if (status.state === "unsupported") {
    return {
      requiresBackend: true,
      enabled: false,
      reason: "backend_unsupported",
      message:
        "This feature needs the DocForge backend, but you're viewing the static-export build. To unlock it, run the project locally: `git clone … && pnpm install && make up && make dev`.",
    }
  }
  return {
    requiresBackend: true,
    enabled: false,
    reason: "backend_offline",
    message:
      "Backend is offline. Start the server with `make up` (or `pnpm dev` with Postgres + Redis + Piston-shim running).",
  }
}
