/**
 * uni-app x 入口。
 * Vue 3 createSSRApp 而非 createApp（小程序端必须 SSR 模式）。
 * Pinia 在此安装。i18n 复用 @docforge/shared 的 tFor。
 */
import { createSSRApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";

export function createApp() {
  const app = createSSRApp(App);
  app.use(createPinia());
  return { app };
}
