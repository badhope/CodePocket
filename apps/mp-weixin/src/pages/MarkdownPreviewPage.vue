<script setup lang="ts">
/**
 * Markdown 预览页 — 左编辑，右渲染。
 */
import { ref, computed, watch, onMounted } from "vue";
import { getTool as getToolMeta, tFor, type Locale, type ToolMeta } from "@docforge/shared";
import { getRunner } from "@/tools/runners";
import type { ToolRunResult } from "@docforge/shared";
import { SAMPLES } from "@/tools/samples";
import ToolLayout from "@/components/ToolLayout.vue";
import { useFeatureGate } from "@/composables/useFeatureGate";
import { useResultCache } from "@/composables/useResultCache";
import ErrorBar from "@/components/ErrorBar.vue";

const slug = "markdown-preview";
const tool = computed<ToolMeta | undefined>(() => getToolMeta(slug));
const runner = computed(() => getRunner(slug));
const sample = computed(() => SAMPLES[slug]);

const { snapshot } = useFeatureGate();
const { memo } = useResultCache();
const locale = ref<Locale>((uni.getStorageSync("docforge.locale") as Locale | null) ?? "en");

const input = ref<string>("");
const output = ref<string>("");
const error = ref<string>("");
const placeholderHtml = '<p class="df-text-muted">— preview —</p>';

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
async function run() {
  error.value = "";
  if (!runner.value) return;
  try {
    const r = (await memo(slug, input.value, () =>
      Promise.resolve(runner.value!(input.value)),
    )) as ToolRunResult;
    if (r.ok) output.value = r.output ?? "";
    else error.value = r.error ?? "";
  } catch (e) {
    error.value = (e as Error).message ?? "run failed";
  }
}
function scheduleRun() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(run, 200);
}

function loadSample() {
  if (!sample.value) return;
  input.value = sample.value.input;
  run();
}

watch(input, scheduleRun);

onMounted(() => {
  if (sample.value) {
    input.value = sample.value.input;
    run();
  }
});
</script>

<template>
  <ToolLayout v-if="tool" :tool="tool" :locale="locale" :snapshot="snapshot">
    <view class="md-editor">
      <view class="md-editor__label">
        <view class="heading">{{ tFor(locale, "markdown.label") }}</view>
        <button class="df-btn df-btn-sm" @click="loadSample" :disabled="!sample">
          {{ tFor(locale, "common.loadSample") }}
        </button>
      </view>
      <textarea
        v-model="input"
        class="df-textarea df-textarea-tall"
        :placeholder="tFor(locale, 'markdown.placeholder')"
        spellcheck="false"
      />
    </view>

    <view class="md-preview">
      <view class="md-preview__label">
        <view class="heading">{{ tFor(locale, "common.preview") }}</view>
        <text class="df-text-xs df-text-muted">{{ output.length }} {{ tFor(locale, "common.chars") }}</text>
      </view>
      <ErrorBar v-if="error" :message="error" />
      <rich-text v-else class="md-preview__body" :nodes="output || placeholderHtml" />
    </view>
  </ToolLayout>
</template>

<style scoped>
.md-editor,
.md-preview {
  display: flex;
  flex-direction: column;
  gap: var(--df-space-2);
  min-width: 0;
}
.md-editor__label,
.md-preview__label {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.md-editor__label .heading,
.md-preview__label .heading {
  margin: 0;
  font-size: var(--df-text-xs);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--df-text-muted);
}
.md-preview__body {
  background: var(--df-bg-elevated);
  border: 1px solid var(--df-border);
  border-radius: var(--df-radius-md);
  padding: var(--df-space-5);
  font-size: var(--df-text-base);
  line-height: 1.65;
  overflow: auto;
  max-height: 36rem;
}
.md-preview__body :deep(h1),
.md-preview__body :deep(h2),
.md-preview__body :deep(h3) {
  font-weight: 700;
  margin: 1.2em 0 0.5em;
  line-height: 1.25;
}
.md-preview__body :deep(h1) {
  font-size: 1.6em;
  border-bottom: 1px solid var(--df-border);
  padding-bottom: 0.3em;
}
.md-preview__body :deep(h2) {
  font-size: 1.3em;
}
.md-preview__body :deep(code) {
  font-family: var(--df-font-mono);
  font-size: 0.875em;
  background: var(--df-bg-subtle);
  padding: 0.1em 0.4em;
  border-radius: var(--df-radius-sm);
}
.md-preview__body :deep(pre) {
  background: var(--df-bg-inset);
  border: 1px solid var(--df-border);
  border-radius: var(--df-radius-sm);
  padding: var(--df-space-3);
  overflow: auto;
}
.md-preview__body :deep(pre code) {
  background: transparent;
  padding: 0;
}
.md-preview__body :deep(a) {
  color: var(--df-accent);
  text-decoration: underline;
  text-underline-offset: 2px;
}
.md-preview__body :deep(blockquote) {
  margin: 1em 0;
  padding: 0.5em 1em;
  border-left: 3px solid var(--df-accent);
  background: var(--df-bg-subtle);
  color: var(--df-text-secondary);
}
.md-preview__body :deep(ul),
.md-preview__body :deep(ol) {
  padding-left: 1.5em;
}
.md-preview__body :deep(table) {
  border-collapse: collapse;
  width: 100%;
}
.md-preview__body :deep(th),
.md-preview__body :deep(td) {
  border: 1px solid var(--df-border);
  padding: 0.4em 0.8em;
  text-align: left;
}
</style>
