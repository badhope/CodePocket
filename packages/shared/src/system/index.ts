/**
 * 系统模块 — 平台检测、后端健康检查、特性门控
 */

export function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function isNode(): boolean {
  return typeof process !== "undefined" && !!process.versions?.node;
}

export function platform(): "browser" | "node" | "unknown" {
  if (isBrowser()) return "browser";
  if (isNode()) return "node";
  return "unknown";
}

// ─── 后端健康检查 ─────────────────────────────────────────

export type BackendState = "online" | "degraded" | "offline" | "unsupported" | "checking";

export interface BackendSnapshot {
  state: BackendState;
  available: boolean;
  checkedAt: number;
  latencyMs?: number;
  error?: string;
}

export const INITIAL_BACKEND_SNAPSHOT: BackendSnapshot = {
  state: "checking",
  available: false,
  checkedAt: 0,
};

export const ENDPOINTS = {
  health: "/api/health",
  execute: "/api/execute",
  convert: "/api/convert",
} as const;

export interface HealthResponse {
  status: "ok" | "degraded" | "down";
  latencyMs?: number;
}

export function parseHealthResponse(
  data: unknown,
  httpStatus?: number,
  isOnline?: boolean,
  errorMsg?: string | null,
  latencyMs?: number | null,
): BackendSnapshot {
  const checkedAt = Date.now();
  
  if (httpStatus === 404) {
    return { state: "unsupported", available: false, checkedAt, error: "Endpoint not found" };
  }
  
  if (!data || typeof data !== "object") {
    return {
      state: "offline",
      available: false,
      checkedAt,
      error: errorMsg ?? "Invalid response",
      latencyMs: latencyMs ?? undefined,
    };
  }
  
  const obj = data as Record<string, unknown>;
  const status = obj.status as string | undefined;
  
  if (status === "ok") {
    return {
      state: "online",
      available: true,
      checkedAt,
      latencyMs: latencyMs ?? (typeof obj.latencyMs === "number" ? obj.latencyMs : undefined),
    };
  }
  
  if (status === "degraded") {
    return {
      state: "degraded",
      available: true,
      checkedAt,
      latencyMs: latencyMs ?? (typeof obj.latencyMs === "number" ? obj.latencyMs : undefined),
    };
  }
  
  return {
    state: "offline",
    available: false,
    checkedAt,
    error: errorMsg ?? (typeof obj.error === "string" ? obj.error : undefined),
    latencyMs: latencyMs ?? undefined,
  };
}

export function isBackendAvailable(snapshot: BackendSnapshot): boolean {
  return snapshot.available;
}

// ─── API 客户端 ───────────────────────────────────────────

export interface ApiClientOptions {
  baseURL?: string;
  timeout?: number;
}

export class ApiClient {
  private baseURL: string;
  private timeout: number;

  constructor(options: ApiClientOptions = {}) {
    this.baseURL = options.baseURL ?? "";
    this.timeout = options.timeout ?? 30000;
  }

  async get<T>(path: string, options?: { raw?: boolean }): Promise<T | Response> {
    const url = `${this.baseURL}${path}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);
    
    try {
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      
      if (options?.raw) {
        return res;
      }
      
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      
      return await res.json();
    } catch (e) {
      clearTimeout(timeoutId);
      throw e;
    }
  }

  async checkHealth(): Promise<BackendSnapshot> {
    try {
      const start = Date.now();
      const res = await this.get<{ status?: string; latencyMs?: number }>(ENDPOINTS.health, { raw: true });
      const latencyMs = Date.now() - start;
      
      if (res instanceof Response) {
        if (res.status === 404) {
          return parseHealthResponse(null, 404, false, null, null);
        }
        const data = await res.json();
        return parseHealthResponse(data, res.status, true, null, Math.round(latencyMs));
      }
      
      return parseHealthResponse(res, 200, true, null, Math.round(latencyMs));
    } catch (e) {
      return parseHealthResponse(null, 0, true, (e as Error).message ?? "network error", null);
    }
  }

  async execute(code: string, language: string): Promise<{ ok: boolean; output?: string; error?: string }> {
    try {
      const res = await fetch(`${this.baseURL}${ENDPOINTS.execute}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, language }),
      });
      const data = await res.json();
      return data;
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }
}

// ─── 特性门控 ─────────────────────────────────────────────

export type FeatureId = "playground" | "playground.piston" | "document-convert" | "backend-only";

export interface FeatureGate {
  enabled: boolean;
  requiresBackend: boolean;
  message?: string;
  reason?: string;
}

export interface FeatureGateContext {
  state: BackendState;
  available: boolean;
}

export function evaluateFeatureGate(
  featureId: FeatureId,
  context: FeatureGateContext,
): FeatureGate {
  if (context.available) {
    return { enabled: true, requiresBackend: true };
  }
  
  return {
    enabled: false,
    requiresBackend: true,
    reason: context.state === "unsupported" ? "backend_unsupported" : "backend_offline",
    message: context.state === "unsupported"
      ? "此功能在此环境中不可用"
      : "此功能需要后端支持，当前后端不可用",
  };
}
