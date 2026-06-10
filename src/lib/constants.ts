export const APP_NAME = "DocForge";
export const APP_DESCRIPTION =
  "Universal document conversion platform — convert between DOCX, PDF, Markdown, HTML, XLSX, CSV, JSON, and more";
export const APP_VERSION = "3.0.0";

export const SUPPORTED_LOCALES = ["en", "zh-CN", "ja", "ko", "es", "fr"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

export const MAX_FILE_SIZE_MB = 50;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
export const MAX_FILES_PER_UPLOAD = 10;

export const FREE_TIER_LIMITS = {
  conversionsPerDay: 10,
  maxFileSizeMB: 10,
  storageMB: 100,
  executionCpuSec: 5,
  executionMemMB: 128,
  executionWallSec: 10,
} as const;

export const PRO_TIER_LIMITS = {
  conversionsPerDay: 500,
  maxFileSizeMB: 50,
  storageMB: 1024,
  executionCpuSec: 30,
  executionMemMB: 512,
  executionWallSec: 60,
} as const;

export const ADMIN_TIER_LIMITS = {
  conversionsPerDay: Infinity,
  maxFileSizeMB: 200,
  storageMB: 10_240,
  executionCpuSec: 120,
  executionMemMB: 2048,
  executionWallSec: 300,
} as const;

export const ROLES = {
  USER: "user",
  PRO: "pro",
  ADMIN: "admin",
} as const;
export type Role = (typeof ROLES)[keyof typeof ROLES];

export const CONVERSION_STATUS = {
  PENDING: "pending",
  PROCESSING: "processing",
  COMPLETED: "completed",
  FAILED: "failed",
} as const;
export type ConversionStatus = (typeof CONVERSION_STATUS)[keyof typeof CONVERSION_STATUS];
