<script setup lang="ts">
/**
 * StatusBadge — 后端健康状态指示。
 * 显示 dot + 文案。带 tooltip 风格的 state。
 */
import type { BackendSnapshot } from "@docforge/shared";
import { computed } from "vue";

const props = defineProps<{
  snapshot: BackendSnapshot;
  compact?: boolean;
}>();

const tone = computed(() => {
  switch (props.snapshot.state) {
    case "online":
      return { dot: "df-dot-on", label: "online", tag: "success" };
    case "degraded":
      return { dot: "df-dot-warn", label: "degraded", tag: "warn" };
    case "offline":
      return { dot: "df-dot-off", label: "offline", tag: "danger" };
    case "unsupported":
      return { dot: "df-dot-off", label: "static", tag: "" };
    case "checking":
      return { dot: "", label: "checking…", tag: "" };
  }
});

const latencyLabel = computed(() => {
  const ms = props.snapshot.latencyMs;
  return ms == null ? "" : `${ms}ms`;
});
</script>

<template>
  <view class="status-badge" :class="{ 'status-badge--compact': compact }">
    <text class="df-dot" :class="tone.dot" />
    <text class="status-badge__label">{{ tone.label }}</text>
    <text v-if="!compact && latencyLabel" class="status-badge__latency">
      {{ latencyLabel }}
    </text>
  </view>
</template>

<style scoped>
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--df-space-2);
  font-size: var(--df-text-xs);
  font-family: var(--df-font-mono);
  color: var(--df-text-secondary);
  padding: 2px var(--df-space-2);
  border: 1px solid var(--df-border);
  border-radius: var(--df-radius-sm);
  background: var(--df-bg-elevated);
}
.status-badge--compact {
  padding: 0;
  border: none;
  background: transparent;
}
.status-badge__latency {
  color: var(--df-text-muted);
}
</style>
