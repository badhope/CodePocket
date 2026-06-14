<script setup lang="ts">
/**
 * ToolsIndexPage — 全部工具页。
 * 搜索 + 分类网格 + 空结果。
 */
import { computed, onMounted, ref } from "vue";
import {
  listTools,
  toolLabelFor,
  toolDescriptionFor,
  tFor,
  type Locale,
  type ToolMeta,
  type ToolCategory,
} from "@docforge/shared";
import ToolIcon from "@/components/ToolIcon.vue";

const locale = ref<Locale>((uni.getStorageSync("docforge.locale") as Locale | null) ?? "en");

const query = ref("");
const all = listTools();

const filtered = computed<ToolMeta[]>(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return [...all];
  return all.filter(
    (t) =>
      t.slug.includes(q) ||
      t.keywords.some((k) => k.toLowerCase().includes(q)) ||
      toolLabelFor(locale.value, t.slug).toLowerCase().includes(q),
  );
});

const grouped = computed<Record<ToolCategory, ToolMeta[]>>(() => {
  const out = {} as Record<ToolCategory, ToolMeta[]>;
  for (const t of filtered.value) {
    (out[t.category] ??= []).push(t);
  }
  return out;
});

const hasResults = computed(() => filtered.value.length > 0);

const CATEGORY_ORDER: ToolCategory[] = [
  "formatter",
  "converter",
  "encoder",
  "validator",
  "generator",
  "diff",
  "utility",
  "playground",
];

const CATEGORY_DESCRIPTIONS: Record<ToolCategory, string> = {
  formatter: "Beautify and minify structured text.",
  converter: "Switch between document formats.",
  encoder: "Encode and decode strings.",
  generator: "Generate identifiers and visual codes.",
  validator: "Validate data and patterns.",
  diff: "Compare two pieces of text.",
  utility: "Small helpers that earn their place.",
  playground: "Run code in 19+ languages.",
  extended: "Extended tools for advanced use cases.",
};

/** 根据工具 slug 返回正确的页面 URL */
function getToolUrl(slug: string): string {
  const specialPages: Record<string, string> = {
    "markdown-preview": "/pages/MarkdownPreviewPage",
    "document-convert": "/pages/DocumentConvertPage",
    "qr-generator": "/pages/QrPage",
    "regex-tester": "/pages/RegexPage",
    playground: "/pages/PlaygroundPage",
  };
  return specialPages[slug] ?? `/pages/ToolRunnerPage?slug=${slug}`;
}

onMounted(() => {});
</script>

<template>
  <view>
    <view class="tools-header">
      <view class="p df-eyebrow">{{ tFor(locale, "nav.tools") }}</view>
      <view class="heading df-h1">{{ tFor(locale, "tools.title") }}</view>
      <view class="p df-text-secondary">{{ tFor(locale, "tools.subtitle") }}</view>
    </view>

    <view class="tool-search">
      <input
        v-model="query"
        class="df-input"
        :placeholder="tFor(locale, 'tools.search.placeholder')"
        aria-label="search"
      />
      <text v-if="query" class="df-text-xs df-text-muted" style="margin-left: var(--df-space-3)">
        {{ filtered.length }} / {{ all.length }} matches
      </text>
    </view>

    <view v-if="!hasResults" class="df-empty">
      <view class="p"
        >{{ tFor(locale, "tools.empty") }} <text class="code">{{ query }}"</text></view
      >
    </view>

    <view v-else>
      <view v-for="cat in CATEGORY_ORDER.filter((c) => grouped[c]?.length)" :key="cat" class="tools-group">
        <view class="home-section__head" style="margin-bottom: var(--df-space-3)">
          <view class="heading">
            <text>{{ tFor(locale, `tools.category.${cat}`) }}</text>
            <text class="count">· {{ grouped[cat]?.length ?? 0 }}</text>
          </view>
        </view>
        <view class="p df-text-secondary df-text-sm" style="margin: 0 0 var(--df-space-3)">
          {{ CATEGORY_DESCRIPTIONS[cat] }}
        </view>
        <view class="tool-grid">
          <navigator v-for="t in grouped[cat]" :key="t.slug" :url="getToolUrl(t.slug)" class="tool-card">
            <view class="tool-card__head">
              <view class="tool-card__title">
                <text class="tool-card__icon">
                  <ToolIcon :name="t.icon" />
                </text>
                <text>{{ toolLabelFor(locale, t.slug) }}</text>
              </view>
              <text v-if="t.requiresBackend" class="df-tag df-tag-accent">backend</text>
              <text v-else class="df-tag">offline</text>
            </view>
            <view class="p tool-card__desc">
              {{ toolDescriptionFor(locale, t.slug) }}
            </view>
            <view class="tool-card__meta">
              <text v-for="k in t.keywords.slice(0, 3)" :key="k">#{{ k }}</text>
            </view>
          </navigator>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.tools-header {
  margin-bottom: var(--df-space-6);
}
.tools-header .df-h1 {
  margin: var(--df-space-1) 0 var(--df-space-2);
}
.tools-group {
  margin-bottom: var(--df-space-6);
}
</style>
