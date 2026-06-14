<script setup lang="ts">
/**
 * 404 兜底 — 保持与新设计一致。
 */
import { ref, onMounted } from "vue";
import { tFor, type Locale } from "@docforge/shared";

const locale = ref<Locale>(
  (uni.getStorageSync("docforge.locale") as Locale | null) ?? "en",
);

onMounted(() => {
});
</script>

<template>
  <view class="notfound">
    <view class="p df-eyebrow">// 404 · path not found</view>
    <view class="heading df-h1">{{ tFor(locale, "notfound.title") }}</view>
    <view class="p df-text-secondary">{{ tFor(locale, "notfound.subtitle") }}</view>
    <view class="pre df-mono-block notfound__block">$ docforge open &lt;requested_path&gt;
&gt; error: path not found
&gt; hint: try one of these:
  · /              home
  · /tools         all 20 tools
  · /playground    code playground
  · /tools/qr      QR generator
  · /tools/regex   regex tester
  · /tools/markdown  markdown preview
  · /tools/document-convert  document converter
</view>
    <view class="df-row" style="margin-top: var(--df-space-4); justify-content: center">
      <navigator url="/pages/index/index" class="df-btn df-btn-primary">← home</navigator>
      <navigator url="/pages/ToolsIndexPage" class="df-btn">all tools</navigator>
      <navigator url="/pages/playground/index" class="df-btn">playground</navigator>
    </view>
  </view>
</template>

<style scoped>
.notfound {
  padding: var(--df-space-12) 0;
  text-align: center;
  max-width: 64ch;
  margin: 0 auto;
}
.notfound .df-h1 {
  margin: var(--df-space-2) 0;
}
.notfound__block {
  text-align: left;
  font-size: var(--df-text-sm);
  line-height: 1.65;
  color: var(--df-text-secondary);
  max-width: 56ch;
  margin: var(--df-space-5) auto 0;
}
</style>
