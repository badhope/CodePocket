<script setup lang="ts">
/**
 * 正则测试页 — pattern + flags + input + matches。
 */
import { ref, computed, watch, onMounted } from "vue";
import { getTool as getToolMeta, tFor, type Locale, type ToolMeta } from "@docforge/shared";
import { getRunner } from "@/tools/runners";
import type { ToolRunResult } from "@docforge/shared";
import { SAMPLES } from "@/tools/samples";
import ToolLayout from "@/components/ToolLayout.vue";
import ErrorBar from "@/components/ErrorBar.vue";
import { useFeatureGate } from "@/composables/useFeatureGate";
import { useResultCache } from "@/composables/useResultCache";

const slug = "regex-tester";
const tool = computed<ToolMeta | undefined>(() => getToolMeta(slug));
const runner = computed(() => getRunner(slug));
const sample = computed(() => SAMPLES[slug]);

const { snapshot } = useFeatureGate();
const { memo } = useResultCache();
const locale = ref<Locale>(
  (uni.getStorageSync("docforge.locale") as Locale | null) ?? "en",
);

const input = ref<string>("");
const output = ref<string>("");
const error = ref<string>("");
const meta = ref<{ count?: number } | null>(null);
const options = ref<{ pattern: string; flags: string }>({
  pattern: "\\b\\w+\\b",
  flags: "g",
});

async function run() {
  error.value = "";
  if (!runner.value) return;
  try {
    const r = (await memo(
      slug,
      input.value,
      () => Promise.resolve(runner.value!(input.value, { ...options.value })),
      { options: options.value },
    )) as ToolRunResult;
    if (r.ok) {
      output.value = r.output ?? "";
      meta.value = (r.meta as { count?: number } | undefined) ?? null;
    } else error.value = r.error ?? "";
  } catch (e) {
    error.value = (e as Error).message ?? "run failed";
  }
}

function loadSample() {
  if (!sample.value) return;
  input.value = sample.value.input;
  options.value = { ...(sample.value.options as { pattern: string; flags: string }) };
  run();
}

watch(input, run);
watch(options, run, { deep: true });

onMounted(() => {
});
</script>

<template>
  <ToolLayout v-if="tool" :tool="tool" :locale="locale" :snapshot="snapshot">
    <view class="regex-options">
      <view class="df-row" style="gap: var(--df-space-2); flex-wrap: wrap">
        <text class="df-eyebrow">/</text>
        <input
          v-model="options.pattern"
          class="df-input regex-pattern"
          placeholder="\\d+"
          spellcheck="false"
        />
        <text class="df-eyebrow">/</text>
        <input
          v-model="options.flags"
          class="df-input regex-flags"
          placeholder="g"
          maxlength="6"
          spellcheck="false"
        />
        <button class="df-btn df-btn-sm" @click="loadSample">{{ tFor(locale, "common.loadSample") }}</button>
      </view>
    </view>

    <view class="regex-input">
      <view class="regex-input__label">
        <view class="heading">{{ tFor(locale, "common.input") }}</view>
        <text class="df-text-xs df-text-muted" v-if="meta?.count != null">{{ meta.count }} {{ tFor(locale, "regex.matches") }}</text>
      </view>
      <textarea
        v-model="input"
        class="df-textarea df-textarea-tall"
        rows="14"
        :placeholder="tFor(locale, 'regex.placeholder')"
        spellcheck="false"
      />
    </view>

    <view class="regex-output">
      <view class="regex-output__label">
        <view class="heading">{{ tFor(locale, "regex.matches") }}</view>
      </view>
      <ErrorBar v-if="error" :message="error" />
      <view v-else class="pre df-mono-block">{{ output || tFor(locale, 'regex.noMatches') }}</view>
    </view>
  </ToolLayout>
</template>

<style scoped>
.regex-options {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  gap: var(--df-space-2);
  padding: var(--df-space-3);
  background: var(--df-bg-elevated);
  border: 1px solid var(--df-border);
  border-radius: var(--df-radius-md);
}
.regex-pattern {
  flex: 1;
  font-family: var(--df-font-mono);
}
.regex-flags {
  width: 80px;
  font-family: var(--df-font-mono);
  text-align: center;
}
.regex-input,
.regex-output {
  display: flex;
  flex-direction: column;
  gap: var(--df-space-2);
  min-width: 0;
}
.regex-input__label,
.regex-output__label {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.regex-input__label .heading,
.regex-output__label .heading {
  margin: 0;
  font-size: var(--df-text-xs);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--df-text-muted);
}
</style>
