import { defineConfig } from "vite";
import uniPkg from "@dcloudio/vite-plugin-uni";

// @dcloudio/vite-plugin-uni 是 CJS 包，import default 拿到的是 module wrapper。
// 真实 default export 是 .default；直接 plugin 调用
const uni = (uniPkg as unknown as { default: typeof uniPkg }).default ?? uniPkg;

// pdf-lib 是 shared 包静态依赖，引入链上有 tslib/pako/... 等多个子依赖。
// 在 uni-app x 小程序端这些子依赖解析路径与 H5 略有差异，
// 这里统一 external，由运行时按需加载（uni-app 的 commonjs 兼容层处理）。
const externalDeps = [
  "pdf-lib",
  "tslib",
  "pako",
  "strnum",
  "pdf-lib/cjs/core/errors",
];

// DocForge mp-weixin 编译入口
// - h5 端：把 <view>/<text> 编译成 <div>/<span>
// - mp-weixin 端：编译成 wxml/wxss/wxs
// 业务代码全部从 @docforge/shared 复用
// 平台差异用 /* #ifdef MP-WEIXIN */ /* #endif */ 条件编译
export default defineConfig({
  plugins: [uni()],
  // 全局 esbuild target：解决 fast-xml-parser 的 chrome87 不兼容
  esbuild: {
    target: "esnext",
  },
  server: {
    host: "0.0.0.0",
    port: 5174,
    strictPort: false,
    cors: true,
    hmr: {
      clientPort: 5174,
    },
    headers: {
      "Access-Control-Allow-Origin": "*",
    },
  },
  // 预构建 pdf-lib 相关依赖
  optimizeDeps: {
    include: [
      "pdf-lib",
      "@pdf-lib/upng",
      "@pdf-lib/standard-fonts",
      "fast-xml-parser",
    ],
    esbuildOptions: {
      target: "esnext",
    },
  },
  build: {
    target: "esnext",
    rollupOptions: {
      external: externalDeps,
    },
  },
});
