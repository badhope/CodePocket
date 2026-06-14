<script setup lang="ts">
/**
 * 通用文本工具页面 — input + run + output。
 * 通过 slug 从 runners.ts 拿 runner；通过 samples.ts 拿示例。
 * 支持自动运行（debounce 300ms）、复制、重置、加载示例。
 */
import { ref, computed, watch, onMounted } from "vue";
import {
  getTool as getToolMeta,
  type ToolMeta,
} from "@docforge/shared";
import { getRunner } from "@/tools/runners";
import type { ToolRunResult } from "@docforge/shared";
import { SAMPLES } from "@/tools/samples";
import { useRecentTools } from "@/composables/useRecentTools";
import { useResultCache } from "@/composables/useResultCache";
import { useFeatureGate } from "@/composables/useFeatureGate";
import ToolLayout from "@/components/ToolLayout.vue";
import TextEditor from "@/components/TextEditor.vue";
import FeatureBanner from "@/components/FeatureBanner.vue";
import ErrorBar from "@/components/ErrorBar.vue";
import { tFor, type Locale } from "@docforge/shared";

const slug = ref<string>("");
const tool = computed<ToolMeta | undefined>(() => getToolMeta(slug.value));
const runner = computed(() => getRunner(slug.value));
const sample = computed(() => SAMPLES[slug.value]);

const { snapshot, gate, gateForTool } = useFeatureGate();
const { add: addRecent } = useRecentTools();
const { memo: memoTool } = useResultCache();
const locale = ref<Locale>(
  (uni.getStorageSync("docforge.locale") as Locale | null) ?? "en",
);

const input = ref<string>("");
const output = ref<string>("");
const error = ref<string>("");
const meta = ref<Record<string, unknown> | null>(null);
const options = ref<Record<string, unknown>>({});
const ranAt = ref<number>(0);

// debounce auto-run
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleRun(delay = 300) {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(runNow, delay);
}

async function runNow() {
  error.value = "";
  if (!runner.value) {
    output.value = "";
    error.value = `未实现的工具: ${slug.value}`;
    return;
  }
  try {
    // 缓存：相同 (slug, options, input) 第二次不重算
    const result = await memoTool(
      slug.value,
      input.value,
      () => Promise.resolve(runner.value!(input.value, { ...options.value })),
      { options: options.value },
    );
    ranAt.value = Date.now();
    if (result.ok) {
      output.value = result.output ?? "";
      meta.value = result.meta ?? null;
      void addRecent(slug.value);
    } else {
      output.value = "";
      error.value = result.error ?? "";
      meta.value = null;
    }
  } catch (e) {
    error.value = (e as Error).message ?? "run failed";
  }
}

function reset() {
  input.value = "";
  output.value = "";
  error.value = "";
  meta.value = null;
}

function loadSample() {
  if (!sample.value) return;
  input.value = sample.value.input;
  options.value = { ...(sample.value.options ?? {}) };
  runNow();
}

// option controls per tool
const indentOptions = [2, 4];
const opOptions: Record<string, { label: string; value: string }[]> = {
  "json-formatter": [
    { label: "format", value: "format" },
    { label: "minify", value: "minify" },
  ],
  "css-formatter": [
    { label: "format", value: "format" },
    { label: "minify", value: "minify" },
  ],
  "html-formatter": [
    { label: "format", value: "format" },
    { label: "minify", value: "minify" },
  ],
  "yaml-formatter": [
    { label: "format", value: "format" },
    { label: "minify", value: "minify" },
  ],
  base64: [
    { label: "encode", value: "encode" },
    { label: "decode", value: "decode" },
  ],
  "url-codec": [
    { label: "encode", value: "encode" },
    { label: "decode", value: "decode" },
  ],
  "csv-json": [
    { label: "CSV → JSON", value: "csvToJson" },
    { label: "JSON → CSV", value: "jsonToCsv" },
  ],
  "text-utils": [
    { label: "Sort", value: "sort" },
    { label: "Sort ↓", value: "sortDesc" },
    { label: "Unique", value: "unique" },
    { label: "Reverse", value: "reverse" },
    { label: "Shuffle", value: "shuffle" },
    { label: "UPPER", value: "upper" },
    { label: "lower", value: "lower" },
    { label: "Title", value: "title" },
    { label: "Count", value: "count" },
  ],
};

// hash algorithm options
const hashAlgorithms = ["MD5", "SHA-1", "SHA-256", "SHA-512"];

// color converter mode options
const colorModes = [
  { label: "HEX → RGB", value: "hex" },
  { label: "RGB → HEX", value: "rgb" },
];

// number base options
const numberBases = [
  { label: "Bin", value: 2 },
  { label: "Oct", value: 8 },
  { label: "Dec", value: 10 },
  { label: "Hex", value: 16 },
];

// validator type options
const validatorTypes = [
  { label: "Email", value: "email" },
  { label: "URL", value: "url" },
  { label: "IPv4", value: "ipv4" },
  { label: "IPv6", value: "ipv6" },
  { label: "IP", value: "ip" },
];

function setOp(v: string) {
  options.value = { ...options.value, op: v };
}

// 判断当前工具是否有选项面板
const hasOptions = computed(() => {
  if (!tool.value) return false;
  const s = tool.value.slug;
  return !!(
    opOptions[s] ||
    s === "uuid-generator" ||
    s === "hash-generator" ||
    s === "color-converter" ||
    s === "number-base" ||
    s === "validator" ||
    s === "lorem-ipsum" ||
    s === "jsonpath"
  );
});

watch(
  () => slug.value,
  () => {
    reset();
    if (sample.value) {
      input.value = sample.value.input;
      options.value = { ...(sample.value.options ?? {}) };
    }
    runNow();
  },
  { immediate: true },
);

watch(input, () => scheduleRun());
watch(
  () => ({ ...options.value }),
  () => scheduleRun(100),
  { deep: true },
);

onMounted(() => {
});

const gateForThis = computed(() =>
  tool.value ? gateForTool(tool.value) : ({ requiresBackend: false, enabled: true } as const),
);

function onLoad(options: Record<string, any>) {
  if (options.slug) {
    slug.value = String(options.slug);
  }
}
</script>

<template>
  <ToolLayout v-if="tool" :tool="tool" :locale="locale" :snapshot="snapshot">
    <FeatureBanner
      v-if="!gateForThis.enabled"
      :gate="gateForThis"
      :tool-name="tFor(locale, `tools.${tool.slug}.label`)"
    />

    <FeatureBanner
      v-if="!runner"
      :gate="{ requiresBackend: false, enabled: false, message: '此工具未在 M1 中实现' }"
      :tool-name="tool.slug"
    />

    <!-- options strip -->
    <view v-if="hasOptions" class="tool-options">
      <!-- op-based tools (format/minify, encode/decode, etc.) -->
      <template v-if="opOptions[tool.slug]">
        <view class="df-row" style="gap: var(--df-space-2); flex-wrap: wrap">
          <text class="df-eyebrow">{{ tFor(locale, "common.format") }}:</text>
          <button
            v-for="o in opOptions[tool.slug]"
            :key="o.value"
            class="df-btn df-btn-sm"
            :class="options.op === o.value || (!options.op && o.value === 'format') ? 'df-btn-primary' : ''"
            @click="setOp(o.value)"
          >
            {{ o.label }}
          </button>
        </view>
        <view v-if="tool.slug === 'json-formatter' && options.op !== 'minify'" class="df-row">
          <text class="df-eyebrow">{{ tFor(locale, "common.indent") }}:</text>
          <button
            v-for="i in indentOptions"
            :key="i"
            class="df-btn df-btn-sm"
            :class="(options.indent ?? 2) === i ? 'df-btn-primary' : ''"
            @click="options.indent = i"
          >
            {{ i }} {{ tFor(locale, "common.spaces") }}
          </button>
        </view>
      </template>

      <!-- uuid-generator -->
      <template v-else-if="tool.slug === 'uuid-generator'">
        <view class="df-row" style="gap: var(--df-space-2)">
          <text class="df-eyebrow">{{ tFor(locale, "common.count") }}:</text>
          <input
            class="df-input"
            type="number"
            min="1"
            max="100"
            :value="options.count ?? 5"
            style="width: 80px"
            @input="options.count = Number(($event.target as HTMLInputElement).value)"
          />
          <text class="df-eyebrow">{{ tFor(locale, "common.kind") }}:</text>
          <button
            class="df-btn df-btn-sm"
            :class="(options.kind ?? 'uuid') === 'uuid' ? 'df-btn-primary' : ''"
            @click="options.kind = 'uuid'"
          >
            uuid v4
          </button>
          <button
            class="df-btn df-btn-sm"
            :class="options.kind === 'short' ? 'df-btn-primary' : ''"
            @click="options.kind = 'short'"
          >
            short id
          </button>
        </view>
      </template>

      <!-- hash-generator -->
      <template v-else-if="tool.slug === 'hash-generator'">
        <view class="df-row" style="gap: var(--df-space-2); flex-wrap: wrap">
          <text class="df-eyebrow">Algorithm:</text>
          <button
            v-for="alg in hashAlgorithms"
            :key="alg"
            class="df-btn df-btn-sm"
            :class="(options.algorithm ?? 'SHA-256') === alg ? 'df-btn-primary' : ''"
            @click="options.algorithm = alg"
          >
            {{ alg }}
          </button>
        </view>
      </template>

      <!-- color-converter -->
      <template v-else-if="tool.slug === 'color-converter'">
        <view class="df-row" style="gap: var(--df-space-2); flex-wrap: wrap">
          <text class="df-eyebrow">Mode:</text>
          <button
            v-for="m in colorModes"
            :key="m.value"
            class="df-btn df-btn-sm"
            :class="(options.mode ?? 'hex') === m.value ? 'df-btn-primary' : ''"
            @click="options.mode = m.value"
          >
            {{ m.label }}
          </button>
        </view>
      </template>

      <!-- number-base -->
      <template v-else-if="tool.slug === 'number-base'">
        <view class="df-row" style="gap: var(--df-space-2); flex-wrap: wrap">
          <text class="df-eyebrow">From:</text>
          <button
            v-for="b in numberBases"
            :key="'from-' + b.value"
            class="df-btn df-btn-sm"
            :class="(options.fromBase ?? 10) === b.value ? 'df-btn-primary' : ''"
            @click="options.fromBase = b.value"
          >
            {{ b.label }}
          </button>
        </view>
        <view class="df-row" style="gap: var(--df-space-2); flex-wrap: wrap">
          <text class="df-eyebrow">To:</text>
          <button
            v-for="b in numberBases"
            :key="'to-' + b.value"
            class="df-btn df-btn-sm"
            :class="(options.toBase ?? 16) === b.value ? 'df-btn-primary' : ''"
            @click="options.toBase = b.value"
          >
            {{ b.label }}
          </button>
        </view>
      </template>

      <!-- validator -->
      <template v-else-if="tool.slug === 'validator'">
        <view class="df-row" style="gap: var(--df-space-2); flex-wrap: wrap">
          <text class="df-eyebrow">Type:</text>
          <button
            v-for="vt in validatorTypes"
            :key="vt.value"
            class="df-btn df-btn-sm"
            :class="(options.type ?? 'email') === vt.value ? 'df-btn-primary' : ''"
            @click="options.type = vt.value"
          >
            {{ vt.label }}
          </button>
        </view>
      </template>

      <!-- lorem-ipsum -->
      <template v-else-if="tool.slug === 'lorem-ipsum'">
        <view class="df-row" style="gap: var(--df-space-2)">
          <text class="df-eyebrow">{{ tFor(locale, "common.count") }}:</text>
          <input
            class="df-input"
            type="number"
            min="1"
            max="500"
            :value="options.count ?? 50"
            style="width: 80px"
            @input="options.count = Number(($event.target as HTMLInputElement).value)"
          />
          <text class="df-text-muted df-text-xs">words</text>
        </view>
      </template>

      <!-- jsonpath -->
      <template v-else-if="tool.slug === 'jsonpath'">
        <view class="df-row" style="gap: var(--df-space-2); flex: 1">
          <text class="df-eyebrow">Path:</text>
          <input
            class="df-input"
            type="text"
            placeholder="$.store.book[*].title"
            :value="options.path ?? '$'"
            style="flex: 1"
            @input="options.path = ($event.target as HTMLInputElement).value"
          />
        </view>
      </template>
    </view>

    <!-- main grid -->
    <TextEditor
      v-model="input"
      :label="tFor(locale, 'common.input')"
      :placeholder="tFor(locale, 'common.placeholder.input')"
      :rows="12"
    />

    <view class="tool-actions">
      <button class="df-btn df-btn-primary" @click="runNow">{{ tFor(locale, "common.run") }}</button>
      <button class="df-btn" @click="loadSample" :disabled="!sample">{{ tFor(locale, "common.loadSample") }}</button>
      <button class="df-btn df-btn-ghost" @click="reset">{{ tFor(locale, "common.reset") }}</button>
      <text class="df-text-muted df-text-xs" v-if="meta">
        <text v-for="(v, k) in meta" :key="String(k)">{{ k }}: {{ v }} · </text>
        {{ tFor(locale, "common.ranAt") }} {{ new Date(ranAt).toLocaleTimeString() }}
      </text>
    </view>

    <ErrorBar v-if="error" :message="error" />

    <TextEditor
      :model-value="output"
      :label="tFor(locale, 'common.output')"
      :placeholder="tFor(locale, 'common.placeholder.empty')"
      :rows="12"
      readonly
      show-copy
    />
  </ToolLayout>
  <view v-else>
    <view class="heading">未找到工具：{{ slug }}</view>
    <navigator url="/pages/ToolsIndexPage">返回工具列表</navigator>
  </view>
</template>

<style scoped>
.tool-options {
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  gap: var(--df-space-2);
  padding: var(--df-space-3);
  background: var(--df-bg-elevated);
  border: 1px solid var(--df-border);
  border-radius: var(--df-radius-md);
}
.tool-actions {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  gap: var(--df-space-2);
  flex-wrap: wrap;
}
</style>
