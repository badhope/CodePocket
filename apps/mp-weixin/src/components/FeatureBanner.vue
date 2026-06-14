<script setup lang="ts">
/**
 * FeatureBanner — 在需要后端的页面顶部显示离线 / unsupported 提示。
 */
import type { FeatureGate } from "@docforge/shared";
import { computed } from "vue";

const props = defineProps<{
  gate: FeatureGate;
  toolName: string;
}>();

const show = computed(() => props.gate.requiresBackend && !props.gate.enabled);
const tone = computed(() =>
  show.value ? (props.gate.reason === "backend_unsupported" ? "danger" : "warn") : "ok",
);
</script>

<template>
  <view v-if="show" class="feature-banner" :class="`feature-banner--${tone}`">
    <text class="feature-banner__icon">⚠</text>
    <view class="feature-banner__body">
      <text class="strong">{{ toolName }}</text>
      <text>需要后端。</text>
      <view class="feature-banner__msg">
        <text>{{ gate.message ?? "" }}</text>
      </view>
    </view>
  </view>
</template>

<style scoped>
.feature-banner--warn {
  background: var(--df-accent-soft);
  border-color: var(--df-accent);
  color: var(--df-accent-text);
}
.feature-banner--danger {
  background: var(--df-danger-soft);
  border-color: var(--df-danger);
  color: var(--df-danger);
}
.feature-banner__body {
  display: flex;
  flex-direction: column;
  gap: var(--df-space-1);
}
.feature-banner__msg {
  margin: 0;
  font-size: var(--df-text-xs);
  opacity: 0.85;
}
.strong {
  font-weight: 700;
}
</style>
