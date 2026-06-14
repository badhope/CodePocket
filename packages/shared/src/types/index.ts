/**
 * DocForge 核心类型定义
 */

export type ToolCategory =
  | "formatter"
  | "converter"
  | "encoder"
  | "generator"
  | "validator"
  | "diff"
  | "utility"
  | "playground"
  | "extended";

export interface ToolMeta {
  slug: string;
  labelKey: string;
  descriptionKey: string;
  category: ToolCategory;
  requiresBackend: boolean;
  offlineFirst: boolean;
  keywords: string[];
  icon: string;
}

export interface ToolRunner {
  (input: string, options?: Record<string, unknown>): ToolRunResult | Promise<ToolRunResult>;
}

export interface ToolRunResult {
  ok: boolean;
  output?: string;
  error?: string;
  meta?: Record<string, unknown>;
}

export type Locale = "en" | "zh-CN" | "zh-TW" | "ja" | "ko" | "es" | "fr";

export interface I18nMessages {
  [key: string]: string | I18nMessages;
}
