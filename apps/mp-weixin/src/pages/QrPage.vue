<script setup lang="ts">
/**
 * QR 生成页 — 输入文本，右边显示 SVG。
 */
import { ref, computed, watch, onMounted } from "vue";
import { getTool as getToolMeta, tFor, type Locale, type ToolMeta } from "@docforge/shared";
import { getRunner } from "@/tools/runners";
import type { ToolRunResult } from "@docforge/shared";
import { SAMPLES } from "@/tools/samples";
import ToolLayout from "@/components/ToolLayout.vue";
import ErrorBar from "@/components/ErrorBar.vue";
import CopyButton from "@/components/CopyButton.vue";
import { useFeatureGate } from "@/composables/useFeatureGate";
import { useResultCache } from "@/composables/useResultCache";

const slug = "qr-generator";
const tool = computed<ToolMeta | undefined>(() => getToolMeta(slug));
const runner = computed(() => getRunner(slug));
const sample = computed(() => SAMPLES[slug]);

const { snapshot } = useFeatureGate();
const { memo } = useResultCache();
const locale = ref<Locale>((uni.getStorageSync("docforge.locale") as Locale | null) ?? "en");

const input = ref<string>("");
const output = ref<string>("");
const error = ref<string>("");
const options = ref<{ ec: "L" | "M" | "Q" | "H"; size: number }>({ ec: "M", size: 256 });

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
    if (r.ok) output.value = r.output ?? "";
    else error.value = r.error ?? "";
  } catch (e) {
    error.value = (e as Error).message ?? "run failed";
  }
}

function loadSample() {
  if (!sample.value) return;
  input.value = sample.value.input;
  run();
}

watch(input, run);
watch(options, run, { deep: true });

onMounted(() => {});
</script>

<template>
  <ToolLayout v-if="tool" :tool="tool" :locale="locale" :snapshot="snapshot">
    <view class="qr-input">
      <view class="qr-input__label">
        <view class="heading">{{ tFor(locale, "common.input") }}</view>
        <button class="df-btn df-btn-sm" @click="loadSample">{{ tFor(locale, "common.loadSample") }}</button>
      </view>
      <textarea
        v-model="input"
        class="df-textarea"
        rows="6"
        :placeholder="tFor(locale, 'qr.placeholder')"
        spellcheck="false"
      />
      <view class="df-row" style="gap: var(--df-space-2); flex-wrap: wrap; margin-top: var(--df-space-2)">
        <text class="df-eyebrow">ec:</text>
        <button
          v-for="lvl in ['L', 'M', 'Q', 'H'] as const"
          :key="lvl"
          class="df-btn df-btn-sm"
          :class="options.ec === lvl ? 'df-btn-primary' : ''"
          @click="options.ec = lvl"
        >
          {{ lvl }}
        </button>
        <text class="df-eyebrow">size:</text>
        <input
          v-model.number="options.size"
          type="number"
          class="df-input"
          min="64"
          max="1024"
          step="32"
          style="width: 80px"
        />
        <text class="df-text-muted df-text-xs">px</text>
      </view>
    </view>

    <view class="qr-output">
      <view class="qr-output__label">
        <view class="heading">qr code</view>
        <CopyButton v-if="output" :text="output" size="sm" />
      </view>
      <ErrorBar v-if="error" :message="error" />
      <rich-text v-else-if="output" class="qr-output__frame" :nodes="output" />
      <view v-else class="df-empty">— 输入内容后即时生成 —</view>
    </view>
  </ToolLayout>
</template>

<style scoped>
.qr-input,
.qr-output {
  display: flex;
  flex-direction: column;
  gap: var(--df-space-2);
  min-width: 0;
}
.qr-input__label,
.qr-output__label {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.qr-input__label .heading,
.qr-output__label .heading {
  margin: 0;
  font-size: var(--df-text-xs);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--df-text-muted);
}
.qr-output__frame {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--df-space-6);
  background: var(--df-bg-elevated);
  border: 1px solid var(--df-border);
  border-radius: var(--df-radius-md);
  min-height: 320px;
}
.qr-output__frame :deep(svg) {
  max-width: 100%;
  height: auto;
  border-radius: var(--df-radius-sm);
}
</style>
