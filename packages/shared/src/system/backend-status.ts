/**
 * 后端健康状态 — 框架无关的状态机。
 * React/Vue 适配在各自 app 中实现（useSyncExternalStore / ref / Pinia）。
 */

export type BackendState = "checking" | "online" | "degraded" | "offline" | "unsupported";

export interface BackendSnapshot {
  state: BackendState;
  lastChecked: number;
  latencyMs: number | null;
  error: string | null;
  server: { version?: string; uptime?: number } | null;
  apiReachable: boolean;
}

export const INITIAL_BACKEND_SNAPSHOT: BackendSnapshot = {
  state: "checking",
  lastChecked: 0,
  latencyMs: null,
  error: null,
  server: null,
  apiReachable: true,
};

/** 纯状态机 — 把 /api/health 响应归一化为 BackendSnapshot */
export function parseHealthResponse(
  body: {
    status?: string;
    version?: string;
    uptime?: number;
    checks?: Record<string, { status?: string }>;
  } | null,
  httpStatus: number,
  apiReachable: boolean,
  networkError: string | null,
  latencyMs: number | null,
): BackendSnapshot {
  if (!apiReachable) {
    return {
      state: "unsupported",
      lastChecked: Date.now(),
      latencyMs: null,
      error: "/api/health is not deployed (static export?)",
      server: null,
      apiReachable: false,
    };
  }
  if (networkError) {
    return {
      state: "offline",
      lastChecked: Date.now(),
      latencyMs: null,
      error: networkError,
      server: null,
      apiReachable: navigatorLike().onLine,
    };
  }
  if (httpStatus === 404) {
    return {
      state: "unsupported",
      lastChecked: Date.now(),
      latencyMs: null,
      error: "/api/health is not deployed (static export?)",
      server: null,
      apiReachable: false,
    };
  }
  if (httpStatus >= 500) {
    return {
      state: "offline",
      lastChecked: Date.now(),
      latencyMs: null,
      error: `HTTP ${httpStatus}`,
      server: null,
      apiReachable: true,
    };
  }
  const top = body?.status;
  const allChecksOk = body ? Object.values(body.checks ?? {}).every((c) => c?.status === "ok") : false;
  return {
    state: top === "ok" && allChecksOk ? "online" : "degraded",
    lastChecked: Date.now(),
    latencyMs,
    error: top === "ok" && !allChecksOk ? "one or more sub-systems are degraded" : null,
    server: { version: body?.version, uptime: body?.uptime },
    apiReachable: true,
  };
}

function navigatorLike(): { onLine: boolean } {
  if (typeof navigator !== "undefined") return navigator;
  return { onLine: true };
}

export function isBackendAvailable(s: BackendSnapshot): boolean {
  return s.state === "online" || s.state === "degraded";
}
