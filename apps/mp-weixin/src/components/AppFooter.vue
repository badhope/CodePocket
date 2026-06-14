<script setup lang="ts">
/**
 * AppFooter — 页脚。
 */
const year = new Date().getFullYear();
</script>

<template>
  <view class="app-footer">
    <view class="app-footer__col">
      <view class="app-footer__brand">
        <text class="app-footer__mark" aria-hidden="true">
          <svg
            viewBox="0 0 24 24"
            width="14"
            height="14"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polyline points="16 18 22 12 16 6" />
            <polyline points="8 6 2 12 8 18" />
          </svg>
        </text>
        <text>docforge <text class="df-text-muted">v0.1.0</text></text>
      </view>
      <text class="df-text-muted">offline-first developer toolbox · {{ year }}</text>
    </view>
    <view class="app-footer__col">
      <text class="df-text-xs df-text-muted">20 tools · 19 languages · 6 locales</text>
    </view>
    <view class="app-footer__col app-footer__links">
      <navigator url="https://github.com/badhope/OnlineCode" target="_blank" rel="noopener"
        >github ↗</navigator
      >
      <navigator url="/pages/tools/index">all tools</navigator>
      <navigator url="/pages/playground/index">playground</navigator>
    </view>
  </view>
</template>

<style scoped>
.app-footer {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--df-space-3);
  align-items: center;
  padding: var(--df-space-5) var(--df-space-6);
  border-top: 1px solid var(--df-border);
  font-size: var(--df-text-xs);
  color: var(--df-text-muted);
}
@media (min-width: 720px) {
  .app-footer {
    grid-template-columns: 1fr auto 1fr;
  }
  .app-footer__links {
    justify-content: flex-end;
  }
}
.app-footer__col {
  display: flex;
  align-items: center;
  gap: var(--df-space-3);
}
.app-footer__col:nth-child(2) {
  justify-content: center;
}
.app-footer__brand {
  display: inline-flex;
  align-items: center;
  gap: var(--df-space-2);
  color: var(--df-text);
  font-weight: 600;
  font-family: var(--df-font-mono);
}
.app-footer__mark {
  display: inline-grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border-radius: var(--df-radius-sm);
  background: var(--df-text);
  color: var(--df-accent);
}
.app-footer__links {
  display: flex;
  gap: var(--df-space-3);
}
.app-footer__links navigator,
.app-footer__links :deep(navigator) {
  color: var(--df-text-secondary);
  text-decoration: none;
  font-family: var(--df-font-mono);
}
.app-footer__links navigator:hover,
.app-footer__links :deep(navigator):hover {
  color: var(--df-accent);
}
</style>
