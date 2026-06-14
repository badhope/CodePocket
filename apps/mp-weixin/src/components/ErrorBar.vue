<script setup lang="ts">
/**
 * ErrorBar — 错误条。
 */
defineProps<{ message: string }>();
</script>

<template>
  <view class="error-bar" role="alert">
    <text class="error-bar__msg">{{ message }}</text>
  </view>
</template>
