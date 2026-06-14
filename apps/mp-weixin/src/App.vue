<script setup lang="ts">
/**
 * uni-app x 根组件。
 * 没有 vue-router — 路由由 pages.json 声明，uni-app 编译期生成。
 * 平台差异在 onLaunch 里根据 uni.getSystemInfoSync 走分支。
 */
import { onLaunch, onShow, onHide } from "@dcloudio/uni-app";

onLaunch(() => {
  // 初始化 storage 适配（mpAdapter 自动选 uni.storage，h5 走 localStorage）
  // 此处只打日志
  console.log("[docforge] launched on", process.env.UNI_PLATFORM);
});

onShow(() => {
  console.log("[docforge] show");
});

onHide(() => {
  console.log("[docforge] hide");
});
</script>

<style lang="scss">
/* 全局样式：导入 design tokens + 基础样式（uni-app 编译期会按平台拆分） */
@import "@docforge/ui/tokens.css";
@import "@docforge/ui/base.css";

page {
  background: var(--df-bg);
  color: var(--df-text);
  font-family: var(--df-font-sans);
}

.df-app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}
</style>
