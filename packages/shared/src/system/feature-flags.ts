/**
 * Feature 标识与是否需要后端的纯数据。
 * 与 [src/lib/system/feature-gate.ts](../../src/lib/system/feature-gate.ts) 一致。
 * 各 app 在此基础上加 hook（React useFeatureGate / Vue composable）。
 */

export type FeatureId =
  | "playground.piston"
  | "playground.python-packages"
  | "convert.local"
  | "convert.server"
  | "auth.sign-in"
  | "auth.sign-up"
  | "snippets.create"
  | "snippets.persist"
  | "projects.create"
  | "projects.persist"
  | "history.view"
  | "dashboard.view"
  | "share.create"
  | "share.resolve";

const REQUIRES_BACKEND: ReadonlySet<FeatureId> = new Set<FeatureId>([
  "playground.piston",
  "playground.python-packages",
  "convert.server",
  "auth.sign-in",
  "auth.sign-up",
  "snippets.create",
  "snippets.persist",
  "projects.create",
  "projects.persist",
  "history.view",
  "dashboard.view",
  "share.create",
  "share.resolve",
]);

/** 该功能是否需要后端（纯函数） */
export function featureRequiresBackend(id: FeatureId): boolean {
  return REQUIRES_BACKEND.has(id);
}

/** 给定后端状态 + feature id 决定是否启用（纯函数） */
export interface BackendAvailability {
  /** 探测状态 */
  state: "checking" | "online" | "degraded" | "offline" | "unsupported";
  /** 是否可视为"可用"（online / degraded 都算） */
  available: boolean;
}

export interface FeatureGate {
  requiresBackend: boolean;
  enabled: boolean;
  reason?: "backend_offline" | "backend_unsupported" | "backend_checking";
  message?: string;
}

const MESSAGES: Record<Exclude<FeatureGate["reason"], undefined>, string> = {
  backend_checking: "Checking backend…",
  backend_offline:
    "Backend is offline. Start the server (Postgres + Redis + Piston-shim) to unlock this feature.",
  backend_unsupported:
    "This feature needs the DocForge backend, but you're viewing the static-export build. Run `pnpm dev` locally to unlock it.",
};

export function evaluateFeatureGate(id: FeatureId, backend: BackendAvailability): FeatureGate {
  if (!featureRequiresBackend(id)) {
    return { requiresBackend: false, enabled: true };
  }
  if (backend.available) {
    return { requiresBackend: true, enabled: true };
  }
  if (backend.state === "checking") {
    return {
      requiresBackend: true,
      enabled: false,
      reason: "backend_checking",
      message: MESSAGES.backend_checking,
    };
  }
  if (backend.state === "unsupported") {
    return {
      requiresBackend: true,
      enabled: false,
      reason: "backend_unsupported",
      message: MESSAGES.backend_unsupported,
    };
  }
  return {
    requiresBackend: true,
    enabled: false,
    reason: "backend_offline",
    message: MESSAGES.backend_offline,
  };
}
