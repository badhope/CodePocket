<script setup lang="ts">
/**
 * ToolLayout — 工具页面统一框架。
 * 标题、描述、状态栏、操作栏；左 / 右两栏布局。
 */
import { computed } from "vue";
import type { ToolMeta } from "@docforge/shared";
import { toolLabelFor, toolDescriptionFor } from "@docforge/shared";
import StatusBadge from "./StatusBadge.vue";
import ToolIcon from "./ToolIcon.vue";
import type { BackendSnapshot } from "@docforge/shared";

const props = defineProps<{
  tool: ToolMeta;
  locale: string;
  snapshot?: BackendSnapshot | null;
  back?: boolean;
}>();

const title = computed(() => toolLabelFor(props.locale as never, props.tool.slug));
const desc = computed(() => toolDescriptionFor(props.locale as never, props.tool.slug));
</script>

<template>
  <view class="tool-page" :class="{ 'tool-page--two-col': true }">
    <view class="tool-page__header" style="grid-column: 1 / -1">
      <view class="tool-page__title">
        <view class="tool-page__title-head">
          <text class="tool-page__title-icon">
            <ToolIcon :name="tool.icon" :size="22" />
          </text>
          <view class="heading">
            <text>{{ title }}</text>
            <text v-if="tool.requiresBackend" class="df-tag df-tag-accent" style="font-size: 10px">
              backend
            </text>
            <text v-else class="df-tag" style="font-size: 10px">offline</text>
          </view>
        </view>
        <view class="p">
          <text>{{ desc }}</text>
        </view>
        <view class="p df-text-xs df-text-muted" style="margin: 0; font-family: var(--df-font-mono)">
          <text>#{{ tool.category }} · slug: </text>
          <text class="code">{{ tool.slug }}</text>
          <text> · keywords: {{ tool.keywords.join(", ") }}</text>
        </view>
      </view>
      <view class="tool-page__actions">
        <StatusBadge v-if="snapshot" :snapshot="snapshot" compact />
        <navigator url="/pages/tools/index" class="df-btn df-btn-ghost df-btn-sm">
          <text>←</text>
          <text>all tools</text>
        </navigator>
      </view>
    </view>

    <slot />
  </view>
</template>
