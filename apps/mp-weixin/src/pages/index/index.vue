<script setup lang="ts">
/**
 * DocForge mp-weixin 首页（冒烟）。
 * 目标：验证 uni-app x 集成 + @docforge/shared 业务核心跨端可用。
 *
 * 仅做一个最小演示：
 * 1. 调 @docforge/shared 的 listTools() 拿工具清单
 * 2. 调 @docforge/shared 的 cache 模块验证基础路径
 * 3. 调 mpAdapter 验证 uni.storage 走得通
 */
import { ref, onMounted } from "vue";
import { listTools, tFor, type Locale } from "@docforge/shared";
import { mpAdapter } from "@docforge/storage/mp";

const locale = ref<Locale>("en");
const toolCount = ref(0);
const storageStatus = ref("未检测");
const cacheStats = ref({ hits: 0, misses: 0, size: 0 });

onMounted(async () => {
  // 1. 业务核心：listTools 在所有端都能跑（无平台依赖）
  toolCount.value = listTools().length;

  // 2. storage 适配：在小程序端走 uni.storage，浏览器/Node 走 memory
  try {
    const store = await mpAdapter.open();
    await store.set("docforge.smoke", { ts: Date.now() });
    const v = await store.get<{ ts: number }>("docforge.smoke");
    storageStatus.value = v?.ts ? "ok" : "empty";
  } catch (e) {
    storageStatus.value = (e as Error).message;
  }
});
</script>

<template>
  <view class="df-app">
    <view class="df-hero">
      <text class="df-hero__title">DocForge</text>
      <text class="df-hero__sub">{{ tFor(locale, "common.tagline") }}</text>
    </view>

    <view class="df-card">
      <text class="df-card__label">业务核心冒烟</text>
      <text class="df-card__value">工具数：{{ toolCount }}</text>
    </view>

    <view class="df-card">
      <text class="df-card__label">存储适配</text>
      <text class="df-card__value">uni.storage → {{ storageStatus }}</text>
    </view>

    <view class="df-card">
      <text class="df-card__label">缓存层（M2.4）</text>
      <text class="df-card__value">
        hits {{ cacheStats.hits }} / misses {{ cacheStats.misses }} / size {{ cacheStats.size }}
      </text>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.df-hero {
  padding: 48rpx 32rpx 24rpx;

  &__title {
    display: block;
    font-size: 56rpx;
    font-weight: 800;
    letter-spacing: -0.02em;
    color: var(--df-text);
  }

  &__sub {
    display: block;
    margin-top: 8rpx;
    font-size: 28rpx;
    color: var(--df-text-muted);
  }
}

.df-card {
  margin: 16rpx 32rpx;
  padding: 24rpx;
  background: var(--df-bg-elevated);
  border: 1px solid var(--df-border);
  border-radius: var(--df-radius-md);

  &__label {
    display: block;
    font-size: 24rpx;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--df-text-muted);
  }

  &__value {
    display: block;
    margin-top: 8rpx;
    font-size: 32rpx;
    font-weight: 600;
    color: var(--df-text);
    font-family: var(--df-font-mono);
  }
}
</style>
