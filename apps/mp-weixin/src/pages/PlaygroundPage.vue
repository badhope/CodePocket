<script setup lang="ts">
/**
 * Playground — 代码演练场。
 * M2.1 真接：selectBackend → 优先 Piston → 离线/失败 → Pyodide → Worker
 * M2.3 增强：useCancelable 流式 + 取消按钮 + 实时阶段进度
 */
import { ref, computed, onMounted } from "vue";
import {
  listLanguages,
  getLanguage,
  tFor,
  selectBackend,
  PistonBackend,
  PyodideBackend,
  WorkerBackend,
  type Locale,
  type LanguageMeta,
  type ExecutionEvent,
  AbortError,
} from "@docforge/shared";
import { useFeatureGate } from "@/composables/useFeatureGate";
import { useCancelable } from "@/composables/useCancelable";
import StatusBadge from "@/components/StatusBadge.vue";

const langs = listLanguages();
const selected = ref("python");
const meta = computed<LanguageMeta | undefined>(() => getLanguage(selected.value));
const code = ref(meta.value?.defaultCode ?? "");

const locale = ref<Locale>(
  (uni.getStorageSync("docforge.locale") as Locale | null) ?? "en",
);
const { snapshot } = useFeatureGate();
const { run, cancel, running } = useCancelable();

const stdout = ref<string>("");
const stderr = ref<string>("");
const exitCode = ref<number | null>(null);
const backendLabel = ref<string>("");
const lastError = ref<string>("");
const stage = ref<string>("");
const runtimeMs = ref<number>(0);
let startTs = 0;

function onSelect(e: Event) {
  const id = (e.target as HTMLSelectElement).value;
  selected.value = id;
  code.value = getLanguage(id)?.defaultCode ?? "";
}

async function onRun() {
  if (running.value) return;
  stdout.value = "";
  stderr.value = "";
  exitCode.value = null;
  lastError.value = "";
  stage.value = "selecting backend";

  try {
    await run(async (signal) => {
      const backend = selectBackend({
        language: selected.value,
        snapshot: snapshot.value,
        piston: new PistonBackend(),
        pyodide: new PyodideBackend(),
        worker: new WorkerBackend({ workerUrl: new URL("../sandbox/worker.js", import.meta.url) }),
      });
      if (!backend) {
        lastError.value = `No backend available for ${selected.value}`;
        return;
      }
      backendLabel.value = backend.id;
      stage.value = "starting";
      startTs = performance.now();

      const stream = backend.stream(
        {
          language: selected.value,
          files: [{ name: inferFilename(selected.value), content: code.value }],
          stdin: "",
        },
        signal,
      );
      let gotFirstOutput = false;
      for await (const ev of stream) {
        if (signal.aborted) break;
        handleEvent(ev);
        if (ev.type === "run-output" && !gotFirstOutput) {
          gotFirstOutput = true;
          stage.value = "running";
        }
      }
      runtimeMs.value = Math.round(performance.now() - startTs);
      stage.value = "done";
    });
  } catch (e) {
    if (e instanceof AbortError) {
      lastError.value = "cancelled by user";
      stage.value = "cancelled";
    } else {
      lastError.value = (e as Error).message;
    }
  } finally {
    if (runtimeMs.value === 0) {
      runtimeMs.value = Math.round(performance.now() - startTs);
    }
  }
}

function onCancel() {
  cancel("user clicked cancel");
}

function handleEvent(ev: ExecutionEvent) {
  if (ev.type === "run-output") {
    if (ev.stream === "stdout") stdout.value += ev.chunk ?? "";
    else stderr.value += ev.chunk ?? "";
  } else if (ev.type === "run-end") {
    exitCode.value = ev.result?.code ?? 0;
  } else if (ev.type === "error") {
    lastError.value = ev.message ?? "unknown error";
  }
}

function inferFilename(lang: string): string {
  const m = getLanguage(lang);
  return m ? `code.${m.extensions[0]?.replace(/^\./, "") ?? "txt"}` : "code.txt";
}

function reset() {
  code.value = meta.value?.defaultCode ?? "";
  stdout.value = "";
  stderr.value = "";
  exitCode.value = null;
  lastError.value = "";
  stage.value = "";
  runtimeMs.value = 0;
}

onMounted(() => {
});
</script>

<template>
  <view class="playground">
    <view class="playground__header">
      <view>
        <view class="p df-eyebrow">{{ tFor(locale, "nav.playground") }}</view>
        <view class="heading df-h1">{{ tFor(locale, "playground.title") }}</view>
        <view class="p df-text-secondary">{{ tFor(locale, "playground.subtitle") }}</view>
      </view>
      <StatusBadge :snapshot="snapshot" />
    </view>

    <view class="playground__bar">
      <label class="df-eyebrow">{{ tFor(locale, "playground.lang") }}</label>
      <select
        :value="selected"
        @change="onSelect"
        class="df-select"
        style="max-width: 240px"
      >
        <option v-for="l in langs" :key="l.id" :value="l.id">{{ l.label }}</option>
      </select>
      <text class="df-text-muted df-text-xs" v-if="meta">
        backend: Piston · fallback: Pyodide / Worker · meta: {{ meta.label }}
      </text>
      <text class="df-spacer" />
      <text v-if="running" class="df-text-muted df-text-xs">{{ stage }}</text>
      <button
        v-if="!running"
        class="df-btn df-btn-primary"
        @click="onRun"
      >
        <text>▶</text>
        <text>{{ tFor(locale, "playground.run") }}</text>
      </button>
      <button v-else class="df-btn df-btn-danger" @click="onCancel">
        <text>■</text>
        <text>{{ tFor(locale, "common.cancel") }}</text>
      </button>
      <button class="df-btn df-btn-ghost" @click="reset">{{ tFor(locale, "common.reset") }}</button>
    </view>

    <view v-if="lastError" class="error-bar" role="alert">
      <text class="error-bar__msg">{{ lastError }}</text>
    </view>

    <view class="playground__editor">
      <view class="playground__label">
        <view class="heading">{{ meta?.label ?? "code" }} ({{ backendLabel || "—" }})</view>
        <text class="df-text-xs df-text-muted">
          {{ code.length }} {{ tFor(locale, "common.chars") }}
        </text>
      </view>
      <textarea
        v-model="code"
        class="df-textarea df-textarea-tall"
        spellcheck="false"
      />
    </view>

    <view class="playground__dual">
      <view class="playground__output">
        <view class="playground__label">
          <view class="heading">{{ tFor(locale, "playground.stdout") }}</view>
          <text class="df-text-xs df-text-muted">
            {{ stdout.length }} {{ tFor(locale, "common.chars") }} · {{ runtimeMs }}ms
          </text>
        </view>
        <view class="pre df-mono-block" data-stream="stdout">{{ stdout || `// ${tFor(locale, "playground.stdout")}` }}</view>
      </view>

      <view class="playground__output">
        <view class="playground__label">
          <view class="heading">{{ tFor(locale, "playground.stderr") }}</view>
          <text class="df-text-xs df-text-muted" v-if="exitCode !== null">
            {{ tFor(locale, "playground.exit") }}: {{ exitCode }}
          </text>
        </view>
        <view class="pre df-mono-block" data-stream="stderr">{{ stderr || `// ${tFor(locale, "playground.stderr")}` }}</view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.playground {
  display: flex;
  flex-direction: column;
  gap: var(--df-space-4);
}
.playground__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--df-space-4);
  flex-wrap: wrap;
}
.playground__bar {
  display: flex;
  align-items: center;
  gap: var(--df-space-3);
  flex-wrap: wrap;
  padding: var(--df-space-3);
  background: var(--df-bg-elevated);
  border: 1px solid var(--df-border);
  border-radius: var(--df-radius-md);
}
.playground__editor,
.playground__output {
  display: flex;
  flex-direction: column;
  gap: var(--df-space-2);
}
.playground__dual {
  display: grid;
  gap: var(--df-space-3);
  grid-template-columns: 1fr;
}
@media (min-width: 900px) {
  .playground__dual {
    grid-template-columns: 1fr 1fr;
  }
}
.playground__label {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.playground__label .heading {
  margin: 0;
  font-size: var(--df-text-xs);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--df-text-muted);
}
</style>
