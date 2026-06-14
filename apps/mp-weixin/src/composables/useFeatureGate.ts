/**
 * useFeatureGate — 后端健康探测 + feature-gate 解析。
 * 跨端：小程序用 uni.getNetworkType，H5 用 navigator.onLine。
 */

import { ref, computed, onMounted, onBeforeUnmount, readonly } from "vue";
import {
  ApiClient,
  ENDPOINTS,
  parseHealthResponse,
  isBackendAvailable,
  evaluateFeatureGate,
  type BackendSnapshot,
  type FeatureId,
  type FeatureGate as Gate,
  type ToolMeta,
} from "@docforge/shared";
import { INITIAL_BACKEND_SNAPSHOT } from "@docforge/shared";

const POLL_MS = 30_000;

export function useFeatureGate() {
  const snapshot = ref<BackendSnapshot>(INITIAL_BACKEND_SNAPSHOT);
  const client = new ApiClient({ baseURL: "" });

  let timer: ReturnType<typeof setInterval> | null = null;

  async function probe() {
    const t0 = Date.now();
    try {
      const res = await client.get<{
        status?: string;
        version?: string;
        uptime?: number;
        checks?: Record<string, { status?: string }>;
      } | null>(ENDPOINTS.health, { raw: true });
      const latency = Date.now() - t0;
      let body: {
        status?: string;
        version?: string;
        uptime?: number;
        checks?: Record<string, { status?: string }>;
      } | null = null;
      if (res instanceof Response) {
        if (res.status === 404) {
          snapshot.value = parseHealthResponse(null, 404, false, null, null);
          return;
        }
        try {
          body = (await res.json()) as typeof body;
        } catch {
          body = null;
        }
        snapshot.value = parseHealthResponse(body, res.status, true, null, Math.round(latency));
      }
    } catch (e) {
      snapshot.value = parseHealthResponse(null, 0, true, (e as Error).message ?? "network error", null);
    }
  }

  function gate(id: FeatureId): Gate {
    const available = isBackendAvailable(snapshot.value);
    return evaluateFeatureGate(id, { state: snapshot.value.state, available });
  }

  function gateForTool(t: ToolMeta): Gate {
    if (!t.requiresBackend) return { requiresBackend: false, enabled: true } as Gate;
    return gate("playground.piston");
  }

  onMounted(() => {
    void probe();
    timer = setInterval(() => void probe(), POLL_MS);
  });
  onBeforeUnmount(() => {
    if (timer) clearInterval(timer);
  });

  return {
    snapshot: readonly(snapshot),
    isOnline: computed(() => isBackendAvailable(snapshot.value)),
    probe,
    gate,
    gateForTool,
  };
}
