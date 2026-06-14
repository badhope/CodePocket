/**
 * 纯函数工具集合 — 框架无关。
 * 20 个工具中的格式化、编码、解码、比较等纯逻辑。
 * 重逻辑（如 PDF/Excel 转换）由 convert/ 子包承担。
 */

export * from "./format.js";
export * from "./codec.js";
export * from "./id.js";
export * from "./diff.js";
export * from "./time.js";
export * from "./regex.js";
export * from "./markdown.js";
export * from "./schema.js";
export * from "./qr.js";
export * from "./extended.js";
