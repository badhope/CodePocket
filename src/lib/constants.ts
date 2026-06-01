export const APP_NAME = "OnlineCode";
export const APP_DESCRIPTION = "Cross-platform online code editor and compiler";
export const APP_VERSION = "2.0.0";

export const SUPPORTED_LOCALES = ["en", "zh-CN", "ja", "ko", "es", "fr"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

export const SUPPORTED_LANGUAGES = [
  "python",
  "javascript",
  "typescript",
  "cpp",
  "c",
  "java",
  "rust",
  "go",
  "csharp",
  "php",
  "ruby",
  "kotlin",
  "swift",
  "scala",
  "bash",
  "lua",
  "sql",
  "html",
  "css",
] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

export const DEFAULT_LANGUAGE: Language = "python";

export const FREE_TIER_LIMITS = {
  projects: 5,
  filesPerProject: 20,
  executionsPerHour: 60,
  storageMB: 50,
  executionCpuSec: 10,
  executionMemMB: 256,
} as const;

export const PRO_TIER_LIMITS = {
  projects: 100,
  filesPerProject: 200,
  executionsPerHour: 600,
  storageMB: 1024,
  executionCpuSec: 30,
  executionMemMB: 1024,
} as const;

export const ADMIN_TIER_LIMITS = {
  projects: Infinity,
  filesPerProject: Infinity,
  executionsPerHour: Infinity,
  storageMB: 10_240,
  executionCpuSec: 60,
  executionMemMB: 2048,
} as const;

export const ROLES = {
  USER: "user",
  PRO: "pro",
  ADMIN: "admin",
} as const;
export type Role = (typeof ROLES)[keyof typeof ROLES];

export const PROJECT_VISIBILITY = {
  PRIVATE: "private",
  PUBLIC: "public",
  UNLISTED: "unlisted",
} as const;
export type ProjectVisibility = (typeof PROJECT_VISIBILITY)[keyof typeof PROJECT_VISIBILITY];

export const FILE_LIMITS = {
  maxFileSizeMB: 5,
  maxFileNameLength: 255,
  maxPathLength: 1024,
} as const;

export const SHARE_TTL_OPTIONS = [
  { label: "1 hour", value: 3600 },
  { label: "1 day", value: 86_400 },
  { label: "7 days", value: 604_800 },
  { label: "30 days", value: 2_592_000 },
  { label: "Never", value: 0 },
] as const;
