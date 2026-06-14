<script setup lang="ts">
/**
 * ToolIcon — 20 个工具的 inline SVG 图标（Lucide 风格，24x24）。
 * 没用外部依赖，stroke="currentColor" 由父容器控制颜色。
 *
 * 接受 icon 名（来自 @docforge/ui ICON_MAP 语义化命名）。
 */
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    name: string;
    size?: number;
    strokeWidth?: number;
  }>(),
  { size: 18, strokeWidth: 1.75 },
);

const wh = computed(() => `${props.size}px`);
</script>

<template>
  <svg
    :width="wh"
    :height="wh"
    viewBox="0 0 24 24"
    fill="none"
    :stroke-width="strokeWidth"
    stroke="currentColor"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <!-- json-formatter / braces -->
    <template v-if="name === 'braces'">
      <path d="M8 3H7a2 2 0 0 0-2 2v4a2 2 0 0 1-1.5 1.9M8 21H7a2 2 0 0 1-2-2v-4a2 2 0 0 0-1.5-1.9" />
      <path d="M16 3h1a2 2 0 0 1 2 2v4a2 2 0 0 0 1.5 1.9M16 21h1a2 2 0 0 0 2-2v-4a2 2 0 0 1 1.5-1.9" />
    </template>

    <!-- css-formatter / code-2 -->
    <template v-else-if="name === 'code-2'">
      <path d="m18 16 4-4-4-4" />
      <path d="m6 8-4 4 4 4" />
      <path d="m14.5 4-5 16" />
    </template>

    <!-- html-formatter / code -->
    <template v-else-if="name === 'code'">
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </template>

    <!-- sql-formatter / database -->
    <template v-else-if="name === 'database'">
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M3 5v6c0 1.7 4 3 9 3s9-1.3 9-3V5" />
      <path d="M3 11v6c0 1.7 4 3 9 3s9-1.3 9-3v-6" />
    </template>

    <!-- xml-formatter / file-code -->
    <template v-else-if="name === 'file-code'">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <path d="m9 18 3-3-3-3" />
      <path d="m15 12-3 3 3 3" />
    </template>

    <!-- markdown-preview / file-text -->
    <template v-else-if="name === 'file-text'">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="16" y2="17" />
      <line x1="8" y1="9" x2="10" y2="9" />
    </template>

    <!-- markdown-to-html / file-type -->
    <template v-else-if="name === 'file-type'">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <path d="M9 13v6" />
      <path d="M9 16h2a1 1 0 0 0 0-2H9" />
      <path d="M14 13h2a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1" />
    </template>

    <!-- html-to-markdown / file-type-2 -->
    <template v-else-if="name === 'file-type-2'">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <path d="M8 13h-2" />
      <path d="M8 18h-2" />
      <path d="M11 13v5h2" />
      <path d="M16 13l-2 5" />
      <path d="m18 18-2-5" />
    </template>

    <!-- document-convert / file-cog -->
    <template v-else-if="name === 'file-cog'">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h8" />
      <polyline points="14 2 14 8 20 8" />
      <circle cx="17" cy="17" r="2" />
      <path
        d="M17 13v1M17 20v1M14.5 14.5l.7.7M18.8 18.8l.7.7M14 17h1M19 17h1M14.5 19.5l.7-.7M18.8 15.2l.7-.7"
      />
    </template>

    <!-- base64 / binary -->
    <template v-else-if="name === 'binary'">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M8 7v10M16 7v10" />
      <path d="M8 7h.01M8 12h.01M8 17h.01M16 7h.01M16 12h.01M16 17h.01" />
    </template>

    <!-- url-codec / link -->
    <template v-else-if="name === 'link'">
      <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" />
      <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
    </template>

    <!-- jwt-decoder / key-round -->
    <template v-else-if="name === 'key-round'">
      <path d="M2 18v3c0 .6.4 1 1 1h1v-3h3v3h1c.6 0 1-.4 1-1v-3" />
      <path d="M5 13V9a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v4" />
      <path d="M13 18H7" />
      <circle cx="17" cy="18" r="3" />
    </template>

    <!-- uuid-generator / hash -->
    <template v-else-if="name === 'hash'">
      <line x1="4" y1="9" x2="20" y2="9" />
      <line x1="4" y1="15" x2="20" y2="15" />
      <line x1="10" y1="3" x2="8" y2="21" />
      <line x1="16" y1="3" x2="14" y2="21" />
    </template>

    <!-- json-schema-validator / shield-check -->
    <template v-else-if="name === 'shield-check'">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <polyline points="9 12 11 14 15 10" />
    </template>

    <!-- regex-tester / regex -->
    <template v-else-if="name === 'regex'">
      <path d="M17 3v10" />
      <path d="m12.67 5.5 8.66 5" />
      <path d="m12.67 10.5 8.66-5" />
      <path d="M9 17a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2z" />
    </template>

    <!-- qr-generator / qr-code -->
    <template v-else-if="name === 'qr-code'">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <line x1="14" y1="14" x2="14" y2="21" />
      <line x1="14" y1="14" x2="21" y2="14" />
      <line x1="17" y1="17" x2="21" y2="17" />
      <line x1="17" y1="21" x2="21" y2="21" />
    </template>

    <!-- playground / play -->
    <template v-else-if="name === 'play'">
      <polygon points="6 4 20 12 6 20 6 4" />
    </template>

    <!-- json-diff / git-compare -->
    <template v-else-if="name === 'git-compare'">
      <circle cx="5" cy="6" r="2" />
      <circle cx="5" cy="18" r="2" />
      <circle cx="19" cy="6" r="2" />
      <path d="M5 8v8" />
      <path d="M19 8v2a4 4 0 0 1-4 4H8" />
    </template>

    <!-- text-diff / align-left -->
    <template v-else-if="name === 'align-left'">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="15" y2="12" />
      <line x1="3" y1="18" x2="18" y2="18" />
    </template>

    <!-- epoch-converter / clock -->
    <template v-else-if="name === 'clock'">
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15 14" />
    </template>

    <!-- 兜底 -->
    <template v-else>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
    </template>
  </svg>
</template>

<style scoped>
svg {
  display: block;
  flex-shrink: 0;
}
</style>
