/**
 * DocForge 设计 tokens（TypeScript 形式）。
 *
 * 设计原则：跨端消费方（Vue / uni-app / 小程序 / App）拿到的是「语义化常量」，
 * 真正的颜色 / 间距 / 圆角值见 styles/tokens.css（CSS 变量）。
 * 这样小程序 / App 端可以走原生主题，不依赖 CSS 变量。
 *
 * 关系：
 *   - tokens.css  ──<df-bg-base>──>  CSS 变量
 *   - tokens.ts   ──SPACING/TYPE/RADIUS─>  TS 常量（rpx 转换由各 app 决定）
 */

export type ThemeMode = "light" | "dark" | "system";

/* ── 字号（rem；消费方按 viewport 转换） ───────────────── */
export const FONT_SIZE = {
  xs: 0.75,
  sm: 0.8125,
  base: 0.9375,
  lg: 1.0625,
  xl: 1.25,
  "2xl": 1.5,
  "3xl": 2,
  "4xl": 2.25,
} as const;

/* ── 间距（rem，4 倍数） ──────────────────────────────── */
export const SPACING = {
  px: 1,
  0: 0,
  0.5: 0.125,
  1: 0.25,
  1.5: 0.375,
  2: 0.5,
  3: 0.75,
  4: 1,
  5: 1.25,
  6: 1.5,
  8: 2,
  10: 2.5,
  12: 3,
  16: 4,
} as const;

/* ── 圆角（rem） ──────────────────────────────────────── */
export const RADIUS = {
  none: 0,
  sm: 0.25,
  md: 0.5,
  lg: 0.75,
  xl: 1,
  full: 9999,
} as const;

/* ── 工具图标（语义化名） ──────────────────────────────
 * 实际渲染由各 app 决定（lucide / iconfont / unicode）。
 * 仅做 slug → 图标名的映射。                              */
export const ICON_MAP = {
  "json-formatter": "braces",
  "css-formatter": "code-2",
  "html-formatter": "code",
  "sql-formatter": "database",
  "xml-formatter": "file-code",
  "markdown-preview": "file-text",
  "markdown-to-html": "file-type",
  "html-to-markdown": "file-type-2",
  "document-convert": "file-cog",
  base64: "binary",
  "url-codec": "link",
  "jwt-decoder": "key-round",
  "uuid-generator": "hash",
  "json-schema-validator": "shield-check",
  "regex-tester": "regex",
  "qr-generator": "qr-code",
  playground: "play",
  "json-diff": "git-compare",
  "text-diff": "align-left",
  "epoch-converter": "clock",
} as const;

export type IconName = (typeof ICON_MAP)[keyof typeof ICON_MAP];

/* ── 状态点色调 ──────────────────────────────────────── */
export type StatusTone = "on" | "warn" | "off" | "muted";
