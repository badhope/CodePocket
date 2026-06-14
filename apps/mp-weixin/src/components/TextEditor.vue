<script setup lang="ts">
/**
 * TextEditor — 受控文本编辑区。
 * 支持只读模式（用于输出）、错误高亮、复制按钮。
 */
import { computed } from "vue";
import CopyButton from "./CopyButton.vue";

const props = withDefaults(
  defineProps<{
    modelValue: string;
    readonly?: boolean;
    label: string;
    placeholder?: string;
    rows?: number;
    showCopy?: boolean;
    monospace?: boolean;
    error?: boolean;
  }>(),
  {
    readonly: false,
    rows: 10,
    showCopy: false,
    monospace: true,
    error: false,
  },
);

const emit = defineEmits<{
  "update:modelValue": [v: string];
}>();

const text = computed({
  get: () => props.modelValue,
  set: (v) => emit("update:modelValue", v),
});

const onInput = (e: Event) => {
  text.value = (e.target as HTMLTextAreaElement).value;
};
</script>

<template>
  <view class="text-editor">
    <view class="text-editor__label">
      <view class="heading">
        <text>{{ label }}</text>
      </view>
      <CopyButton v-if="showCopy" :text="modelValue" :size="'sm'" />
    </view>
    <textarea
      v-if="!readonly"
      :value="modelValue"
      :placeholder="placeholder"
      :rows="rows"
      :class="['df-textarea', error && 'df-textarea--error']"
      spellcheck="false"
      autocapitalize="off"
      autocorrect="off"
      @input="onInput"
    />
    <view v-else class="pre" :class="['df-mono-block', error && 'text-editor__pre--error']">
      <text>{{ modelValue || placeholder || "—" }}</text>
    </view>
  </view>
</template>

<style scoped>
.text-editor {
  display: flex;
  flex-direction: column;
  gap: var(--df-space-2);
  min-width: 0;
}
.text-editor__label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--df-space-2);
}
.text-editor__label .heading {
  margin: 0;
  font-size: var(--df-text-xs);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--df-text-muted);
}
.df-textarea--error,
.text-editor__pre--error {
  border-color: var(--df-danger);
  background: var(--df-danger-soft);
  color: var(--df-danger);
}
</style>
