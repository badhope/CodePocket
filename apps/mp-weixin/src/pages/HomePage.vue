<script setup lang="ts">
/**
 * HomePage — Hero（带终端插画）+ 统计 + Featured callout + 按分类展示的工具网格 + 最近使用。
 * 用 @docforge/shared 的工具注册表与 i18n；用 @docforge/storage 读最近列表。
 */
import { computed, onMounted, ref } from "vue";
import {
  listTools,
  listSupportedLocales,
  toolLabelFor,
  toolDescriptionFor,
  tFor,
  type Locale,
  type ToolMeta,
  type ToolCategory,
} from "@docforge/shared";
import { useRecentTools } from "@/composables/useRecentTools";
import ToolIcon from "@/components/ToolIcon.vue";

const locale = ref<Locale>((uni.getStorageSync("docforge.locale") as Locale | null) ?? "en");
const allTools = listTools();
const allLangs = listSupportedLocales();
const { list: recent, load } = useRecentTools();

onMounted(async () => {
  await load();
});

const recentTools = computed<ToolMeta[]>(() =>
  recent.value
    .map((slug) => allTools.find((t) => t.slug === slug))
    .filter((t): t is ToolMeta => Boolean(t))
    .slice(0, 4),
);

const offlineCount = computed(() => allTools.filter((t) => !t.requiresBackend).length);
const backendCount = computed(() => allTools.length - offlineCount.value);

/* 提取 <accent> 标记 */
const renderedTitle = computed(() => {
  const raw = tFor(locale.value, "home.title");
  const idx = raw.indexOf("<accent>");
  const end = raw.indexOf("</accent>");
  if (idx < 0 || end < 0) return { before: raw, accent: "", after: "" };
  return {
    before: raw.slice(0, idx),
    accent: raw.slice(idx + 8, end),
    after: raw.slice(end + 9),
  };
});

/* 按分类分组（只显示前 4 个分类，剩下进"more"） */
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
  formatter: "Beautify and minify structured text — JSON, CSS, HTML, SQL, XML, YAML, Markdown.",
  converter: "Switch between formats — Markdown ↔ HTML, CSV ↔ JSON, color formats, number bases.",
  encoder: "Encode and decode strings — Base64, URL percent-encoding, JWT inspection, hashes.",
  generator: "Generate identifiers and visual codes — UUID, Nano ID, QR, Lorem Ipsum.",
  validator: "Validate data — JSON schema, regex live testing, email/URL/IP validation, JSONPath.",
  diff: "Compare two pieces of text — line diff, JSON diff.",
  utility: "Small helpers — epoch / ISO conversion, cron parsing, text utilities.",
  playground: "Run code in 19+ languages — Python via Pyodide, JS/TS in a Worker, Lua.",
  extended: "Additional tools extending the core set.",
};

const grouped = computed<Record<ToolCategory, ToolMeta[]>>(() => {
  const out = {} as Record<ToolCategory, ToolMeta[]>;
  for (const t of allTools) {
    (out[t.category] ??= []).push(t);
  }
  return out;
});

/** 每个分类只看前 4 个，剩下的"more" 链到 /tools */
const groupedPreview = computed<Record<ToolCategory, ToolMeta[]>>(() => {
  const out = {} as Record<ToolCategory, ToolMeta[]>;
  for (const cat of CATEGORY_ORDER) {
    out[cat] = (grouped.value[cat] ?? []).slice(0, 4);
  }
  return out;
});

/** 取第一个 playground 工具（用于 featured callout 跳转） */
const featuredTool = computed<ToolMeta | undefined>(() => allTools.find((t) => t.slug === "playground"));

/** 工具 slug → 图标名（来自 ToolMeta.icon） */
function iconFor(slug: string): string {
  return allTools.find((t) => t.slug === slug)?.icon ?? "code";
}

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
</script>

<template>
  <view>
    <!-- ── Hero ─────────────────────────────────── -->
    <view class="home-hero">
      <view class="home-hero__copy">
        <view class="p home-hero__eyebrow">{{ tFor(locale, "home.eyebrow") }}</view>
        <view class="heading">
          {{ renderedTitle.before }}<text class="accent">{{ renderedTitle.accent }}</text
          >{{ renderedTitle.after }}
        </view>
        <view class="p home-hero__lead">
          {{ tFor(locale, "home.subtitle") }}
        </view>

        <view class="home-stats">
          <view class="home-stat">
            <view class="home-stat__num">{{ allTools.length }}</view>
            <view class="home-stat__label">{{ tFor(locale, "home.stat.tools") }}</view>
          </view>
          <view class="home-stat">
            <view class="home-stat__num">{{ allLangs.length }}</view>
            <view class="home-stat__label">{{ tFor(locale, "home.stat.langs") }}</view>
          </view>
          <view class="home-stat">
            <view class="home-stat__num">{{ offlineCount }}</view>
            <view class="home-stat__label">offline · {{ backendCount }} server</view>
          </view>
        </view>

        <view class="home-hero__cta">
          <navigator url="/pages/ToolsIndexPage" class="df-btn df-btn-primary">
            <text>{{ tFor(locale, "home.start") }}</text>
            <text>→</text>
          </navigator>
          <navigator url="/pages/PlaygroundPage" class="df-btn">
            <text>▶</text>
            <text>{{ tFor(locale, "nav.playground") }}</text>
          </navigator>
        </view>
      </view>

      <!-- 终端插画：纯 CSS + 内联文字，无外部资源 -->
      <view class="home-hero__art" aria-hidden="true">
        <view class="home-terminal">
          <view class="home-terminal__bar">
            <text class="home-terminal__dot home-terminal__dot--red" />
            <text class="home-terminal__dot home-terminal__dot--amber" />
            <text class="home-terminal__dot home-terminal__dot--green" />
            <text class="home-terminal__title">~/docforge · zsh</text>
          </view>
          <view class="home-terminal__body">
            <text class="prompt">$</text> <text class="cmd">docforge tools --filter=offline</text>
            <text class="dim">→ scanning 20 tools…</text>
            <text class="ok">✓</text> <text class="cmd">19</text> <text class="dim">run in your browser</text>
            <text class="ok">✓</text> <text class="cmd"> 1</text>
            <text class="dim">needs the backend (playground)</text> <text class="prompt">$</text>
            <text class="cmd">docforge convert report.md pdf</text>
            <text class="dim">→ piping markdown through</text> <text class="hi">marked</text>
            <text class="ok">✓</text> <text class="cmd">report.pdf</text>
            <text class="dim">· 28 KB · 4 pages</text> <text class="prompt">$</text>
            <text class="cmd">docforge run hello.py</text> <text class="dim">→ spawning</text>
            <text class="hi">pyodide</text> <text class="dim"> worker…</text>
            <text class="cmd">Hello, DocForge!</text>
            <text class="prompt">$</text> <text class="cursor">▌</text>
          </view>
        </view>
      </view>
    </view>

    <!-- ── Featured callout（playground） ──────────── -->
    <view v-if="featuredTool" class="feature-callout">
      <view class="feature-callout__copy">
        <text class="feature-callout__eyebrow">▶ featured · playground</text>
        <view class="heading">{{ toolLabelFor(locale, featuredTool.slug) }}</view>
        <view class="p">{{ toolDescriptionFor(locale, featuredTool.slug) }}</view>
        <view class="p df-text-muted df-text-sm" style="margin: 0">
          Tries <text class="code">Piston</text> first, falls back to <text class="code">Pyodide</text> in a
          worker, then in-process JavaScript / TypeScript. Streamed output, cancellable mid-run.
        </view>
        <view class="feature-callout__cta">
          <navigator url="/pages/PlaygroundPage" class="df-btn df-btn-primary">
            <text>▶</text><text>open playground</text>
          </navigator>
          <navigator url="/pages/ToolsIndexPage?q=play" class="df-btn">all 19 languages →</navigator>
        </view>
      </view>
      <view class="feature-callout__preview" aria-hidden="true">
        <view><text class="ln">1</text><text class="cmt"># hello.py</text></view>
        <view><text class="ln">2</text><text class="kw">import</text> <text class="str">math</text></view>
        <view><text class="ln">3</text></view>
        <view
          ><text class="ln">4</text><text class="kw">for</text> i <text class="kw">in</text>
          <text class="str">range(3)</text>:</view
        >
        <view
          ><text class="ln">5</text> <text class="str">print</text>(<text class="str"
            >f"hi &#123;i&#125;"</text
          >)</view
        >
        <view><text class="ln">6</text></view>
        <view><text class="ln">7</text><text class="cmt"># → streamed via abortable signal</text></view>
        <view style="margin-top: 0.5em; color: var(--df-success)">hi 0 · hi 1 · hi 2</view>
      </view>
    </view>

    <!-- ── 最近使用 ──────────────────────────────── -->
    <view v-if="recentTools.length" class="home-section">
      <view class="home-section__head">
        <view class="heading">
          <text>{{ tFor(locale, "home.recent") }}</text>
          <text class="count">· {{ recentTools.length }}</text>
        </view>
        <navigator url="/pages/ToolsIndexPage" class="more">view all →</navigator>
      </view>
      <view class="tool-grid">
        <navigator v-for="t in recentTools" :key="t.slug" :url="getToolUrl(t.slug)" class="tool-card">
          <view class="tool-card__head">
            <view class="tool-card__title">
              <text class="tool-card__icon">
                <ToolIcon :name="iconFor(t.slug)" />
              </text>
              <text>{{ toolLabelFor(locale, t.slug) }}</text>
            </view>
            <text class="df-tag" :class="t.requiresBackend ? 'df-tag-accent' : ''">
              {{ t.requiresBackend ? "backend" : "offline" }}
            </text>
          </view>
          <view class="p tool-card__desc">
            {{ toolDescriptionFor(locale, t.slug) }}
          </view>
          <view class="tool-card__meta">
            <text>#{{ t.category }}</text>
            <text>·</text>
            <text v-for="k in t.keywords.slice(0, 2)" :key="k">#{{ k }}</text>
          </view>
        </navigator>
      </view>
    </view>

    <!-- ── 按分类展示（首页精简版） ──────────────────── -->
    <view
      v-for="cat in CATEGORY_ORDER.filter((c) => groupedPreview[c]?.length)"
      :key="cat"
      class="home-section"
    >
      <view class="home-section__head">
        <view class="heading">
          <text>{{ tFor(locale, `tools.category.${cat}`) }}</text>
          <text class="count">· {{ grouped[cat]?.length ?? 0 }}</text>
        </view>
        <navigator :url="`/pages/ToolsIndexPage?cat=${cat}`" class="more"
          >see {{ grouped[cat]?.length ?? 0 }} →</navigator
        >
      </view>
      <view class="p df-text-secondary df-text-sm" style="margin: 0 0 var(--df-space-3); max-width: 64ch">
        {{ CATEGORY_DESCRIPTIONS[cat] }}
      </view>
      <view class="tool-grid">
        <navigator v-for="t in groupedPreview[cat]" :key="t.slug" :url="getToolUrl(t.slug)" class="tool-card">
          <view class="tool-card__head">
            <view class="tool-card__title">
              <text class="tool-card__icon">
                <ToolIcon :name="iconFor(t.slug)" />
              </text>
              <text>{{ toolLabelFor(locale, t.slug) }}</text>
            </view>
            <text class="df-tag" :class="t.requiresBackend ? 'df-tag-accent' : ''">
              {{ t.requiresBackend ? "backend" : "offline" }}
            </text>
          </view>
          <view class="p tool-card__desc">
            {{ toolDescriptionFor(locale, t.slug) }}
          </view>
          <view class="tool-card__meta">
            <text>#{{ t.category }}</text>
            <text>·</text>
            <text v-for="k in t.keywords.slice(0, 2)" :key="k">#{{ k }}</text>
          </view>
        </navigator>
      </view>
    </view>
  </view>
</template>

<style scoped>
.cursor {
  display: inline-block;
  color: var(--df-accent);
  animation: blink 1.2s steps(2, start) infinite;
}
@keyframes blink {
  to {
    opacity: 0;
  }
}
</style>
