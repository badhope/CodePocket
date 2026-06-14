/**
 * mp-weixin 专用 eslint config。
 * 根目录的 eslint.config.mjs 是 Next.js 专用，不支持 .vue。
 * 这里只 lint .ts，.vue 由 vue-tsc + vite-plugin-uni 编译期验证。
 */
import js from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";
import globals from "globals";

export default [
  {
    ignores: ["dist/**", "unpackage/**", "node_modules/**", "**/*.vue"],
  },
  js.configs.recommended,
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        uni: "readonly",
        UniApp: "readonly",
        wx: "readonly",
        WechatMiniprogram: "readonly",
      },
    },
    plugins: { "@typescript-eslint": tseslint },
    rules: {
      ...tseslint.configs.recommended.rules,
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
];
