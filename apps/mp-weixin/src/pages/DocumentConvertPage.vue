<script setup lang="ts">
/**
 * 文档转换页 — 上传文件 → 选目标格式 → 真转换（前端 / 后端）。
 * 大文件格式（DOCX / XLSX）走后端 /api/convert；其余走纯前端 @docforge/shared/convert。
 */
import { computed, ref, onMounted } from "vue";
import {
  getTool as getToolMeta,
  tFor,
  convert,
  listSupportedPairs,
  type Locale,
  type ToolMeta,
  type DocumentFormat,
  type ProgressFn,
  type ConvertResult,
  type BackendConverter,
  type ConversionPair,
  AbortError,
} from "@docforge/shared";
import ToolLayout from "@/components/ToolLayout.vue";
import ErrorBar from "@/components/ErrorBar.vue";
import { useFeatureGate } from "@/composables/useFeatureGate";
import { useCancelable } from "@/composables/useCancelable";

const slug = "document-convert";
const tool = computed<ToolMeta | undefined>(() => getToolMeta(slug));

const { snapshot } = useFeatureGate();
const locale = ref<Locale>(
  (uni.getStorageSync("docforge.locale") as Locale | null) ?? "en",
);

const file = ref<File | null>(null);
const sourceFormat = ref<DocumentFormat>("md");
const targetFormat = ref<DocumentFormat>("html");
const dragOver = ref(false);
const stage = ref("");
const progress = ref(0);
const error = ref("");
const result = ref<ConvertResult | null>(null);
const { run, cancel, running } = useCancelable();

const PAIRS = listSupportedPairs();

/** 推断上传文件的格式（按扩展名） */
function detectFormat(name: string): DocumentFormat | null {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  if (ext === "md" || ext === "markdown") return "md";
  if (ext === "html" || ext === "htm") return "html";
  if (ext === "txt") return "txt";
  if (ext === "json") return "json";
  if (ext === "xml") return "xml";
  if (ext === "pdf") return "pdf";
  if (ext === "docx") return "docx";
  if (ext === "xlsx") return "xlsx";
  return null;
}

function onPick(e: Event) {
  const input = e.target as HTMLInputElement;
  const f = input.files?.[0] ?? null;
  if (f) acceptFile(f);
}
function onDrop(e: DragEvent) {
  e.preventDefault();
  dragOver.value = false;
  const f = e.dataTransfer?.files?.[0] ?? null;
  if (f) acceptFile(f);
}
function acceptFile(f: File) {
  const fmt = detectFormat(f.name);
  if (!fmt) {
    error.value = `unsupported file type: ${f.name}`;
    return;
  }
  file.value = f;
  sourceFormat.value = fmt;
  // 默认目标格式：第一个本地能做且 != source 的
  const first = PAIRS.find((p: ConversionPair) => p.from === fmt);
  if (first) targetFormat.value = first.to;
  error.value = "";
  result.value = null;
}

/** 找当前 (source, target) 对的元数据 */
const currentPair = computed<ConversionPair | undefined>(() =>
  PAIRS.find((p) => p.from === sourceFormat.value && p.to === targetFormat.value),
);

/** 当前 source 格式所有支持的目标格式 */
const availableTargets = computed<readonly ConversionPair[]>(() =>
  PAIRS.filter((p) => p.from === sourceFormat.value),
);

/** 后端 converter：真接 /api/convert（通过 Vite proxy → :3000）。
 *  失败/超时/不支持的格式会回退到友好错误，前端 convert() 拿到 ok:false。
 *  也保留前端纯函数转换路径（marked / pdf-lib / fast-xml-parser）。 */
const backend: BackendConverter = {
  async convert(from, to, input, onProgress, signal): Promise<ConvertResult> {
    onProgress?.("uploading", 0.2);
    try {
      const res = await fetch("/api/convert", {
        method: "POST",
        body: (() => {
          // 1) 如果是文本类（md / html / txt / json / xml）— 直接以 text 形式发送
          if (from === "md" || from === "html" || from === "txt" || from === "json" || from === "xml") {
            // input 是 string | Uint8Array — 强制为 BlobPart
            const blob = new Blob([input as BlobPart], { type: "text/plain" });
            const fd = new FormData();
            fd.append("file", blob, `source.${from}`);
            fd.append("outputFormat", to);
            return fd;
          }
          // 2) 二进制类 — 实际不会走到 backend converter（前端会自己做），
          //    但保留路径以防以后需要
          const u8 = input instanceof Uint8Array ? input : new TextEncoder().encode(input);
          // 转成 ArrayBuffer 视图，避开 TS5 的 ArrayBufferLike vs ArrayBuffer 不兼容
          const ab = new Uint8Array(u8).buffer as ArrayBuffer;
          const blob = new Blob([ab], { type: "application/octet-stream" });
          const fd = new FormData();
          fd.append("file", blob, `source.${from}`);
          fd.append("outputFormat", to);
          return fd;
        })(),
        signal,
      });
      onProgress?.("processing", 0.6);
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const errBody = (await res.json()) as {
            error?: { code?: string; message?: string } | string;
            message?: string;
          };
          if (typeof errBody.error === "string") msg = errBody.error;
          else if (errBody.error && typeof errBody.error === "object")
            msg = errBody.error.message ?? errBody.error.code ?? msg;
          else if (errBody.message) msg = errBody.message;
        } catch {
          /* ignore */
        }
        return { ok: false, error: `server: ${msg}` };
      }
      onProgress?.("downloading", 0.85);
      const buf = new Uint8Array(await res.arrayBuffer());
      const mime = res.headers.get("content-type") ?? "application/octet-stream";
      onProgress?.("done", 1);
      // 构造一个 pair 壳（仅 mime 区分）
      return { ok: true, output: buf, mime, pair: { from, to, label: `${from} → ${to}`, local: false, hint: "backend" } };
    } catch (e) {
      if ((e as Error).name === "AbortError") {
        return { ok: false, aborted: true, error: "aborted" };
      }
      return {
        ok: false,
        error: `network: ${(e as Error).message ?? "fetch failed"}`,
      };
    }
  },
};

/** 文本类源格式（前端可直接 .text() 读出） */
const TEXT_SOURCES: ReadonlySet<DocumentFormat> = new Set(["md", "html", "txt", "json", "xml"]);

async function submit() {
  if (!file.value) return;
  error.value = "";
  result.value = null;
  progress.value = 0;
  stage.value = "starting";
  try {
    const onProgress: ProgressFn = (s, r) => {
      stage.value = s;
      progress.value = Math.min(1, Math.max(0, r));
    };
    await run(async (signal) => {
      // 文本源：读字符串；二进制源：读 ArrayBuffer
      let input: string | Uint8Array;
      if (TEXT_SOURCES.has(sourceFormat.value)) {
        input = await file.value!.text();
      } else {
        const buf = new Uint8Array(await file.value!.arrayBuffer());
        input = buf;
      }
      const res = await convert(input, sourceFormat.value, targetFormat.value, {
        onProgress,
        backend,
        signal,
      });
      result.value = res;
      if (!res.ok) {
        if (res.aborted) {
          error.value = "cancelled by user";
        } else {
          error.value = res.error ?? "";
        }
      }
    });
  } catch (e) {
    if (e instanceof AbortError) {
      error.value = "cancelled by user";
    } else {
      error.value = (e as Error).message ?? "convert failed";
    }
  }
}

function onCancel() {
  cancel("user clicked cancel");
}

function downloadResult() {
  if (!result.value?.ok || !file.value) return;
  const out = result.value.output;
  const ext = targetFormat.value;
  const baseName = file.value.name.replace(/\.[^.]+$/, "");
  const filename = `${baseName}.${ext}`;
  const mime = result.value.mime;
  if (out instanceof Uint8Array) {
    // PDF / DOCX / XLSX 二进制
    const u8 = out.slice() as Uint8Array<ArrayBuffer>;
    triggerDownload(new Blob([u8], { type: mime }), filename);
  } else {
    triggerDownload(new Blob([out as string], { type: mime }), filename);
  }
}

function triggerDownload(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const previewText = computed<string>(() => {
  const r = result.value;
  if (!r || !r.ok) return "";
  if (typeof r.output !== "string") return "";
  return r.output;
});

/** 当前结果是二进制（PDF / DOCX / XLSX）时显示字节数 */
const binarySize = computed<number>(() => {
  const r = result.value;
  if (!r || !r.ok) return 0;
  if (typeof r.output === "string") return 0;
  return r.output?.byteLength ?? 0;
});

const isBinary = computed<boolean>(() => binarySize.value > 0);

onMounted(() => {
});
</script>

<template>
  <ToolLayout v-if="tool" :tool="tool" :locale="locale" :snapshot="snapshot">
    <view class="convert">
      <view
        class="convert__drop"
        :class="{ 'convert__drop--over': dragOver }"
        @dragover.prevent="dragOver = true"
        @dragleave="dragOver = false"
        @drop="onDrop"
      >
        <input
          id="file"
          type="file"
          accept=".md,.markdown,.html,.htm,.txt,.json,.xml,.pdf,.docx,.xlsx"
          @change="onPick"
          hidden
        />
        <label for="file" class="convert__pick df-btn df-btn-primary">
          {{ tFor(locale, "convert.pick") }}
        </label>
        <view class="p convert__name df-text-secondary" v-if="file">
          {{ file.name }}
          <text class="df-text-muted"
            >({{ (file.size / 1024).toFixed(1) }} KB · .{{ sourceFormat }})</text
          >
        </view>
        <view class="p df-text-muted df-text-sm" v-else>
          {{ tFor(locale, "convert.dropHint") }}
        </view>
      </view>

      <view class="convert__opts">
        <view class="df-col">
          <text class="df-eyebrow">{{ tFor(locale, "convert.target") }}</text>
          <view class="df-row" style="flex-wrap: wrap">
            <button
              v-for="pair in availableTargets"
              :key="pair.to"
              class="df-btn df-btn-sm"
              :class="targetFormat === pair.to ? 'df-btn-primary' : ''"
              @click="targetFormat = pair.to"
            >
              → .{{ pair.to }}
            </button>
          </view>
        </view>

        <button
          class="df-btn df-btn-primary"
          :disabled="!file || running || !currentPair"
          @click="submit"
        >
          {{
            running
              ? tFor(locale, "convert.converting")
              : tFor(locale, "convert.run")
          }}
        </button>

        <button
          v-if="running"
          class="df-btn df-btn-danger"
          @click="onCancel"
        >
          {{ tFor(locale, "common.cancel") }}
        </button>

        <view v-if="running" class="convert__progress">
          <view class="convert__progress-bar" :style="{ width: (progress * 100).toFixed(1) + '%' }" />
          <text class="df-text-xs df-text-muted">{{ stage }}</text>
        </view>

        <view class="p df-text-muted df-text-xs" v-if="currentPair && !running">
          {{ tFor(locale, "convert.via") }}: <text class="code">{{ currentPair.hint }}</text>
          <text v-if="!currentPair.local"> · {{ tFor(locale, "convert.needsBackend") }}</text>
        </view>
      </view>

      <ErrorBar v-if="error" :message="error" />

      <view v-if="result?.ok" class="convert__result">
        <view class="convert__result-head">
          <view class="heading">{{ tFor(locale, "convert.preview") }}</view>
          <button class="df-btn df-btn-sm" @click="downloadResult">
            {{ tFor(locale, "convert.download") }} ({{ file?.name.replace(/\.[^.]+$/, "") }}.{{ targetFormat }})
          </button>
        </view>
        <view v-if="previewText" class="pre df-mono-block">{{ previewText.slice(0, 4000) }}</view>
        <view v-else-if="isBinary" class="p df-text-muted df-text-sm">
          {{ tFor(locale, "convert.binaryReady") }} ({{ binarySize }} bytes)
        </view>
      </view>
    </view>
  </ToolLayout>
</template>

<style scoped>
.convert {
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  gap: var(--df-space-4);
}
@media (max-width: 720px) {
  .convert__opts {
    flex-direction: column;
    align-items: stretch !important;
  }
  .convert__result-head {
    flex-direction: column;
    align-items: flex-start !important;
    gap: var(--df-space-2);
  }
  .convert__result-head .df-btn {
    align-self: stretch;
  }
  .convert__progress {
    flex-direction: column;
    align-items: stretch !important;
    gap: 4px;
  }
  .convert__drop {
    padding: var(--df-space-4) !important;
  }
}
.convert__drop {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--df-space-3);
  padding: var(--df-space-10);
  border: 2px dashed var(--df-border);
  border-radius: var(--df-radius-md);
  background: var(--df-bg-elevated);
  transition:
    border-color var(--df-duration-base) var(--df-ease),
    background var(--df-duration-base) var(--df-ease);
}
.convert__drop--over {
  border-color: var(--df-accent);
  background: var(--df-accent-soft);
}
.convert__pick {
  cursor: pointer;
}
.convert__name {
  font-family: var(--df-font-mono);
  font-size: var(--df-text-sm);
}
.convert__opts {
  display: flex;
  flex-direction: column;
  gap: var(--df-space-3);
  padding: var(--df-space-4);
  background: var(--df-bg-elevated);
  border: 1px solid var(--df-border);
  border-radius: var(--df-radius-md);
}
.convert__progress {
  display: flex;
  flex-direction: column;
  gap: var(--df-space-1);
}
.convert__progress-bar {
  height: 4px;
  background: var(--df-accent);
  border-radius: var(--df-radius-full);
  transition: width var(--df-duration-base) var(--df-ease);
}
.convert__result {
  display: flex;
  flex-direction: column;
  gap: var(--df-space-2);
  padding: var(--df-space-4);
  background: var(--df-bg-elevated);
  border: 1px solid var(--df-border);
  border-radius: var(--df-radius-md);
}
.convert__result-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--df-space-2);
}
.convert__result-head .heading {
  margin: 0;
  font-size: var(--df-text-xs);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--df-text-muted);
}
</style>
