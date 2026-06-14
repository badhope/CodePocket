<script setup lang="ts">
/**
 * CopyButton — 一键复制当前内容。
 * 状态：idle / copied / error。
 */
import { useCopyToClipboard } from "@/composables/useCopyToClipboard";

const props = defineProps<{
  text: string;
  label?: string;
  size?: "sm" | "md";
  disabled?: boolean;
}>();

const { state, copy } = useCopyToClipboard();

async function onClick() {
  await copy(props.text);
}
</script>

<template>
  <button
    class="df-btn"
    :class="[size === 'sm' && 'df-btn-sm', state === 'copied' && 'copy-flash']"
    :disabled="disabled || !text"
    :aria-label="state === 'copied' ? 'copied' : 'copy to clipboard'"
    @click="onClick"
  >
    <text v-if="state === 'idle'">{{ label ?? "copy" }}</text>
    <text v-else-if="state === 'copied'" class="df-text-success">✓ copied</text>
    <text v-else class="df-text-danger">✕ failed</text>
  </button>
</template>
