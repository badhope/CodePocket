"use client";

/**
 * Global backend-status store (Zustand-style with a tiny in-house
 * implementation to avoid pulling in a dep). Wakes up a single
 * health-checker on mount and broadcasts status changes to every
 * subscriber so every component renders consistently.
 *
 * Why this lives in the browser:
 *  - the whole point of the app is "stay useful without the backend".
 *  - on GitHub-Pages (static export) the backend will literally never
 *    come back during a single session; we have to fail fast and lock
 *    down features gracefully.
 */
import { useSyncExternalStore } from "react";

export type BackendState =
  | "checking" // initial probe in flight
  | "online" // health 200 + db/cache ok
  | "degraded" // health 200 but a sub-check failed
  | "offline" // network error, 5xx, or /api/health missing
  | "unsupported"; // static export (no API at all)

export interface BackendSnapshot {
  state: BackendState;
  /** ms timestamp of last probe */
  lastChecked: number;
  /** round-trip latency in ms (only meaningful when online/degraded) */
  latencyMs: number | null;
  /** human-readable error when offline */
  error: string | null;
  /** what the backend reports (from /api/health body) */
  server: {
    version?: string;
    uptime?: number;
  } | null;
  /** whether /api/health was reachable at all (false on GitHub Pages) */
  apiReachable: boolean;
}

const INITIAL: BackendSnapshot = {
  state: "checking",
  lastChecked: 0,
  latencyMs: null,
  error: null,
  server: null,
  apiReachable: true,
};

const subs = new Set<() => void>();
let snapshot: BackendSnapshot = INITIAL;
let probeTimer: ReturnType<typeof setTimeout> | null = null;
let inFlight: AbortController | null = null;
let mounted = 0;

function emit() {
  for (const cb of subs) cb();
}

function setSnapshot(next: BackendSnapshot) {
  snapshot = next;
  emit();
}

function schedule(delayMs: number) {
  if (probeTimer) clearTimeout(probeTimer);
  probeTimer = setTimeout(() => void probe(), delayMs);
}

async function probe() {
  // If we are statically exported (e.g. on github.io/<user>.github.io/<repo>),
  // /api/health will 404. We treat that as "unsupported" rather than
  // "offline" so the UI can show a static-export message instead of a
  // misleading "server crashed" error.
  inFlight?.abort();
  const ctl = new AbortController();
  inFlight = ctl;
  const t0 = performance.now();
  try {
    const r = await fetch("/api/health", {
      cache: "no-store",
      signal: ctl.signal,
    });
    const dt = Math.round(performance.now() - t0);
    if (r.status === 404) {
      setSnapshot({
        state: "unsupported",
        lastChecked: Date.now(),
        latencyMs: null,
        error: "/api/health is not deployed (static export?)",
        server: null,
        apiReachable: false,
      });
      schedule(60_000); // recheck slowly in case the backend is starting up
      return;
    }
    if (!r.ok) {
      setSnapshot({
        state: "offline",
        lastChecked: Date.now(),
        latencyMs: null,
        error: `HTTP ${r.status}`,
        server: null,
        apiReachable: true,
      });
      schedule(15_000);
      return;
    }
    const body = (await r.json().catch(() => null)) as {
      status?: string;
      version?: string;
      uptime?: number;
      checks?: Record<string, { status?: string }>;
    } | null;
    const top = body?.status;
    const allChecksOk = body ? Object.values(body.checks ?? {}).every((c) => c?.status === "ok") : false;
    const next: BackendSnapshot = {
      state: top === "ok" && allChecksOk ? "online" : "degraded",
      lastChecked: Date.now(),
      latencyMs: dt,
      error: top === "ok" && !allChecksOk ? "one or more sub-systems are degraded" : null,
      server: { version: body?.version, uptime: body?.uptime },
      apiReachable: true,
    };
    setSnapshot(next);
    schedule(top === "ok" && allChecksOk ? 30_000 : 10_000);
  } catch (err) {
    const isAbort = (err as { name?: string } | null)?.name === "AbortError";
    if (isAbort) return; // a newer probe superseded us
    setSnapshot({
      state: "offline",
      lastChecked: Date.now(),
      latencyMs: null,
      error: (err as Error | null)?.message ?? "network error",
      server: null,
      apiReachable: navigator.onLine,
    });
    schedule(15_000);
  }
}

function subscribe(cb: () => void) {
  subs.add(cb);
  if (mounted === 0) {
    mounted = 1;
    if (typeof window !== "undefined") {
      // fire an immediate probe, then let `schedule` take over
      void probe();
      window.addEventListener("online", () => schedule(0));
    }
  } else {
    mounted++;
  }
  return () => {
    subs.delete(cb);
    mounted = Math.max(0, mounted - 1);
  };
}

function getSnapshot() {
  return snapshot;
}

function getServerSnapshot() {
  return INITIAL;
}

export function useBackendStatus(): {
  status: BackendSnapshot;
  recheck: () => void;
  /** true when features that require the backend can be used */
  backendAvailable: boolean;
} {
  const status = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const recheck = () => schedule(0);
  const backendAvailable = status.state === "online" || status.state === "degraded";
  return { status, recheck, backendAvailable };
}
