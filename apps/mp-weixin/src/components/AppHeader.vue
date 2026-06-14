<script setup lang="ts">
/**
 * AppHeader — 顶栏（导航 + 状态点 + 语言切换）。
 * 移动端 (<720px)：汉堡按钮 + 抽屉式菜单。
 */
import { ref, watch, onMounted, onUnmounted } from "vue";
import { negotiateLocale, tFor, type Locale } from "@docforge/shared";
import StatusBadge from "./StatusBadge.vue";
import { useFeatureGate } from "@/composables/useFeatureGate";

const { snapshot } = useFeatureGate();
const locale = ref<Locale>("en");
const menuOpen = ref(false);

function setLocale(next: Locale) {
  locale.value = next;
  try {
    localStorage.setItem("docforge.locale", next);
  } catch {
    /* SSR / 隐私模式 */
  }
  window.dispatchEvent(new CustomEvent("docforge:locale-change", { detail: next }));
  menuOpen.value = false;
}

function closeMenu() {
  menuOpen.value = false;
}

onMounted(() => {
  const stored = (() => {
    try {
      return localStorage.getItem("docforge.locale");
    } catch {
      return null;
    }
  })();
  locale.value = (stored as Locale | null) ?? negotiateLocale(navigator.language);

  window.addEventListener("docforge:locale-change", ((e: CustomEvent) => {
    locale.value = e.detail;
  }) as EventListener);
});

watch(menuOpen, (open) => {
  if (typeof document === "undefined") return;
  // 锁滚动
  document.body.style.overflow = open ? "hidden" : "";
});

onUnmounted(() => {
  if (typeof document !== "undefined") document.body.style.overflow = "";
});
</script>

<template>
  <view class="app-header">
    <navigator url="/pages/index/index" class="app-brand" @click="closeMenu">
      <text class="app-brand__mark" aria-hidden="true">
        <svg
          viewBox="0 0 24 24"
          width="18"
          height="18"
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
      <text class="app-brand__name">docforge</text>
    </navigator>

    <!-- 桌面端导航 -->
    <view class="app-nav app-nav--desktop" aria-label="primary">
      <navigator url="/pages/index/index">{{ tFor(locale, "nav.home") }}</navigator>
      <navigator url="/pages/tools/index">{{ tFor(locale, "nav.tools") }}</navigator>
      <navigator url="/pages/playground/index">{{ tFor(locale, "nav.playground") }}</navigator>
    </view>

    <view class="app-header__right">
      <StatusBadge :snapshot="snapshot" compact class="app-header__status--desktop" />
      <select
        class="df-select app-header__lang--desktop"
        :value="locale"
        aria-label="language"
        @change="setLocale(($event.target as HTMLSelectElement).value as Locale)"
      >
        <option v-for="l in ['en', 'es', 'fr', 'ja', 'ko', 'zh-CN']" :key="l" :value="l">{{ l }}</option>
      </select>

      <!-- 移动端汉堡 -->
      <button
        class="app-header__burger"
        :aria-expanded="menuOpen"
        aria-label="menu"
        @click="menuOpen = !menuOpen"
      >
        <svg
          v-if="!menuOpen"
          viewBox="0 0 24 24"
          width="20"
          height="20"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
        <svg
          v-else
          viewBox="0 0 24 24"
          width="20"
          height="20"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <line x1="6" y1="6" x2="18" y2="18" />
          <line x1="6" y1="18" x2="18" y2="6" />
        </svg>
      </button>
    </view>
  </view>

  <!-- 移动端抽屉 -->
  <Transition name="drawer">
    <view v-if="menuOpen" class="app-drawer" @click.self="closeMenu">
      <view class="app-drawer__panel" role="dialog" aria-label="menu">
        <view class="app-drawer__nav" @click="closeMenu">
          <navigator url="/pages/index/index" class="app-drawer__link">{{
            tFor(locale, "nav.home")
          }}</navigator>
          <navigator url="/pages/tools/index" class="app-drawer__link">{{
            tFor(locale, "nav.tools")
          }}</navigator>
          <navigator url="/pages/playground/index" class="app-drawer__link">{{
            tFor(locale, "nav.playground")
          }}</navigator>
        </view>

        <view class="app-drawer__meta">
          <StatusBadge :snapshot="snapshot" />
          <view class="app-drawer__lang">
            <text class="df-text-xs df-text-muted">language</text>
            <select
              class="df-select"
              :value="locale"
              @change="setLocale(($event.target as HTMLSelectElement).value as Locale)"
            >
              <option v-for="l in ['en', 'es', 'fr', 'ja', 'ko', 'zh-CN']" :key="l" :value="l">
                {{ l }}
              </option>
            </select>
          </view>
        </view>
      </view>
    </view>
  </Transition>
</template>

<style scoped>
.app-header__status--desktop,
.app-header__lang--desktop {
  display: none;
}
.app-header__burger {
  display: inline-grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border: 1px solid var(--df-border);
  background: transparent;
  border-radius: var(--df-radius-sm);
  color: var(--df-text-secondary);
  cursor: pointer;
  padding: 0;
}
.app-header__burger:hover {
  color: var(--df-text);
  background: var(--df-bg-subtle);
}

.app-nav--desktop {
  display: none;
}

@media (min-width: 720px) {
  .app-header__burger {
    display: none;
  }
  .app-header__status--desktop,
  .app-header__lang--desktop {
    display: inline-flex;
  }
  .app-nav--desktop {
    display: flex;
  }
}

/* ── Drawer ─────────────────────────────────── */
.app-drawer {
  position: fixed;
  inset: 0;
  z-index: 20;
  background: color-mix(in srgb, var(--df-bg) 80%, transparent);
  backdrop-filter: blur(2px);
  display: flex;
  justify-content: flex-end;
  padding-top: env(safe-area-inset-top, 0);
}
.app-drawer__panel {
  width: min(320px, 86vw);
  height: 100%;
  background: var(--df-bg-elevated);
  border-left: 1px solid var(--df-border);
  display: flex;
  flex-direction: column;
  padding: calc(56px + var(--df-space-3)) var(--df-space-4) var(--df-space-5) var(--df-space-4);
  padding-bottom: calc(var(--df-space-5) + env(safe-area-inset-bottom, 0));
  gap: var(--df-space-4);
  overflow-y: auto;
}
.app-drawer__nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.app-drawer__link {
  padding: var(--df-space-3) var(--df-space-3);
  border-radius: var(--df-radius-sm);
  color: var(--df-text-secondary);
  text-decoration: none;
  font-size: var(--df-text-base);
  font-weight: 500;
}
.app-drawer__link:hover,
.app-drawer__link.router-link-active {
  background: var(--df-bg-subtle);
  color: var(--df-text);
}
.app-drawer__meta {
  margin-top: auto;
  display: flex;
  flex-direction: column;
  gap: var(--df-space-3);
  padding-top: var(--df-space-4);
  border-top: 1px solid var(--df-border);
}
.app-drawer__lang {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.app-drawer__lang .df-select {
  width: 100%;
}

.drawer-enter-active,
.drawer-leave-active {
  transition: opacity 0.18s var(--df-ease);
}
.drawer-enter-active .app-drawer__panel,
.drawer-leave-active .app-drawer__panel {
  transition: transform 0.22s var(--df-ease);
}
.drawer-enter-from,
.drawer-leave-to {
  opacity: 0;
}
.drawer-enter-from .app-drawer__panel,
.drawer-leave-to .app-drawer__panel {
  transform: translateX(100%);
}
</style>
