/**
 * 工具注册表 — 框架无关的元数据层。
 * 20 个工具的清单：分类、是否离线、是否需要后端、图标名。
 * 各 app 据此渲染 UI。
 */

import type { ToolMeta } from "../types/index.js";

const META: readonly ToolMeta[] = [
  // ── 格式化 ──────────────────────────────────────────────
  {
    slug: "json-formatter",
    labelKey: "tools.json-formatter.label",
    descriptionKey: "tools.json-formatter.description",
    category: "formatter",
    requiresBackend: false,
    offlineFirst: true,
    keywords: ["json", "format", "pretty", "tree", "minify"],
    icon: "braces",
  },
  {
    slug: "css-formatter",
    labelKey: "tools.css-formatter.label",
    descriptionKey: "tools.css-formatter.description",
    category: "formatter",
    requiresBackend: false,
    offlineFirst: true,
    keywords: ["css", "minify", "pretty", "prettier"],
    icon: "code-2",
  },
  {
    slug: "html-formatter",
    labelKey: "tools.html-formatter.label",
    descriptionKey: "tools.html-formatter.description",
    category: "formatter",
    requiresBackend: false,
    offlineFirst: true,
    keywords: ["html", "minify", "pretty", "prettier"],
    icon: "code",
  },
  {
    slug: "sql-formatter",
    labelKey: "tools.sql-formatter.label",
    descriptionKey: "tools.sql-formatter.description",
    category: "formatter",
    requiresBackend: false,
    offlineFirst: true,
    keywords: ["sql", "format", "prettier", "query"],
    icon: "database",
  },
  {
    slug: "xml-formatter",
    labelKey: "tools.xml-formatter.label",
    descriptionKey: "tools.xml-formatter.description",
    category: "formatter",
    requiresBackend: false,
    offlineFirst: true,
    keywords: ["xml", "format", "pretty"],
    icon: "file-code",
  },
  {
    slug: "markdown-preview",
    labelKey: "tools.markdown-preview.label",
    descriptionKey: "tools.markdown-preview.description",
    category: "formatter",
    requiresBackend: false,
    offlineFirst: true,
    keywords: ["markdown", "md", "preview", "render"],
    icon: "file-text",
  },
  // ── 转换器 ──────────────────────────────────────────────
  {
    slug: "markdown-to-html",
    labelKey: "tools.markdown-to-html.label",
    descriptionKey: "tools.markdown-to-html.description",
    category: "converter",
    requiresBackend: false,
    offlineFirst: true,
    keywords: ["markdown", "html", "convert"],
    icon: "file-type",
  },
  {
    slug: "html-to-markdown",
    labelKey: "tools.html-to-markdown.label",
    descriptionKey: "tools.html-to-markdown.description",
    category: "converter",
    requiresBackend: false,
    offlineFirst: true,
    keywords: ["html", "markdown", "convert", "turndown"],
    icon: "file-type-2",
  },
  {
    slug: "document-convert",
    labelKey: "tools.document-convert.label",
    descriptionKey: "tools.document-convert.description",
    category: "converter",
    requiresBackend: true,
    offlineFirst: false,
    keywords: ["docx", "pdf", "xlsx", "convert", "server"],
    icon: "file-cog",
  },
  // ── 编码 / 解码 ────────────────────────────────────────
  {
    slug: "base64",
    labelKey: "tools.base64.label",
    descriptionKey: "tools.base64.description",
    category: "encoder",
    requiresBackend: false,
    offlineFirst: true,
    keywords: ["base64", "encode", "decode"],
    icon: "binary",
  },
  {
    slug: "url-codec",
    labelKey: "tools.url-codec.label",
    descriptionKey: "tools.url-codec.description",
    category: "encoder",
    requiresBackend: false,
    offlineFirst: true,
    keywords: ["url", "encode", "decode", "percent"],
    icon: "link",
  },
  {
    slug: "jwt-decoder",
    labelKey: "tools.jwt-decoder.label",
    descriptionKey: "tools.jwt-decoder.description",
    category: "encoder",
    requiresBackend: false,
    offlineFirst: true,
    keywords: ["jwt", "token", "decode", "header", "payload"],
    icon: "key-round",
  },
  {
    slug: "uuid-generator",
    labelKey: "tools.uuid-generator.label",
    descriptionKey: "tools.uuid-generator.description",
    category: "generator",
    requiresBackend: false,
    offlineFirst: true,
    keywords: ["uuid", "guid", "generate", "nanoid"],
    icon: "hash",
  },
  // ── 校验 / 生成 ─────────────────────────────────────────
  {
    slug: "json-schema-validator",
    labelKey: "tools.json-schema-validator.label",
    descriptionKey: "tools.json-schema-validator.description",
    category: "validator",
    requiresBackend: false,
    offlineFirst: true,
    keywords: ["json", "schema", "validate", "ajv"],
    icon: "shield-check",
  },
  {
    slug: "regex-tester",
    labelKey: "tools.regex-tester.label",
    descriptionKey: "tools.regex-tester.description",
    category: "validator",
    requiresBackend: false,
    offlineFirst: true,
    keywords: ["regex", "regexp", "test", "match"],
    icon: "regex",
  },
  {
    slug: "qr-generator",
    labelKey: "tools.qr-generator.label",
    descriptionKey: "tools.qr-generator.description",
    category: "generator",
    requiresBackend: false,
    offlineFirst: true,
    keywords: ["qr", "qrcode", "generate", "barcode"],
    icon: "qr-code",
  },
  // ── Playground ───────────────────────────────────────────
  {
    slug: "playground",
    labelKey: "tools.playground.label",
    descriptionKey: "tools.playground.description",
    category: "playground",
    requiresBackend: true,
    offlineFirst: false,
    keywords: ["playground", "piston", "python", "javascript", "rust"],
    icon: "play",
  },
  // ── 差异 / 工具 ─────────────────────────────────────────
  {
    slug: "json-diff",
    labelKey: "tools.json-diff.label",
    descriptionKey: "tools.json-diff.description",
    category: "diff",
    requiresBackend: false,
    offlineFirst: true,
    keywords: ["json", "diff", "compare"],
    icon: "git-compare",
  },
  {
    slug: "text-diff",
    labelKey: "tools.text-diff.label",
    descriptionKey: "tools.text-diff.description",
    category: "diff",
    requiresBackend: false,
    offlineFirst: true,
    keywords: ["text", "diff", "compare", "unified"],
    icon: "align-left",
  },
  {
    slug: "epoch-converter",
    labelKey: "tools.epoch-converter.label",
    descriptionKey: "tools.epoch-converter.description",
    category: "utility",
    requiresBackend: false,
    offlineFirst: true,
    keywords: ["epoch", "timestamp", "date", "time", "unix"],
    icon: "clock",
  },
  // ── 扩展工具 ──────────────────────────────────────────────
  {
    slug: "yaml-formatter",
    labelKey: "tools.yaml-formatter.label",
    descriptionKey: "tools.yaml-formatter.description",
    category: "formatter",
    requiresBackend: false,
    offlineFirst: true,
    keywords: ["yaml", "yml", "format", "pretty"],
    icon: "file-code",
  },
  {
    slug: "hash-generator",
    labelKey: "tools.hash-generator.label",
    descriptionKey: "tools.hash-generator.description",
    category: "encoder",
    requiresBackend: false,
    offlineFirst: true,
    keywords: ["hash", "md5", "sha", "sha256", "sha512"],
    icon: "hash",
  },
  {
    slug: "color-converter",
    labelKey: "tools.color-converter.label",
    descriptionKey: "tools.color-converter.description",
    category: "converter",
    requiresBackend: false,
    offlineFirst: true,
    keywords: ["color", "hex", "rgb", "hsl", "convert"],
    icon: "palette",
  },
  {
    slug: "csv-json",
    labelKey: "tools.csv-json.label",
    descriptionKey: "tools.csv-json.description",
    category: "converter",
    requiresBackend: false,
    offlineFirst: true,
    keywords: ["csv", "json", "convert", "table"],
    icon: "table",
  },
  {
    slug: "text-utils",
    labelKey: "tools.text-utils.label",
    descriptionKey: "tools.text-utils.description",
    category: "utility",
    requiresBackend: false,
    offlineFirst: true,
    keywords: ["text", "sort", "unique", "reverse", "shuffle", "uppercase", "lowercase", "word count"],
    icon: "align-left",
  },
  {
    slug: "cron-parser",
    labelKey: "tools.cron-parser.label",
    descriptionKey: "tools.cron-parser.description",
    category: "utility",
    requiresBackend: false,
    offlineFirst: true,
    keywords: ["cron", "schedule", "parse", "timer"],
    icon: "clock",
  },
  {
    slug: "lorem-ipsum",
    labelKey: "tools.lorem-ipsum.label",
    descriptionKey: "tools.lorem-ipsum.description",
    category: "generator",
    requiresBackend: false,
    offlineFirst: true,
    keywords: ["lorem", "ipsum", "placeholder", "text", "generate"],
    icon: "file-text",
  },
  {
    slug: "number-base",
    labelKey: "tools.number-base.label",
    descriptionKey: "tools.number-base.description",
    category: "converter",
    requiresBackend: false,
    offlineFirst: true,
    keywords: ["number", "base", "binary", "octal", "hex", "decimal", "convert"],
    icon: "hash",
  },
  {
    slug: "jsonpath",
    labelKey: "tools.jsonpath.label",
    descriptionKey: "tools.jsonpath.description",
    category: "validator",
    requiresBackend: false,
    offlineFirst: true,
    keywords: ["jsonpath", "json", "query", "path"],
    icon: "search",
  },
  {
    slug: "validator",
    labelKey: "tools.validator.label",
    descriptionKey: "tools.validator.description",
    category: "validator",
    requiresBackend: false,
    offlineFirst: true,
    keywords: ["validate", "email", "url", "ip", "ipv4", "ipv6"],
    icon: "check-circle",
  },
] as const;

const BY_SLUG = new Map<string, ToolMeta>(META.map((m) => [m.slug, m]));

/** 列出所有工具元数据 */
export function listTools(): readonly ToolMeta[] {
  return META;
}

/** 查一个工具 */
export function getTool(slug: string): ToolMeta | undefined {
  return BY_SLUG.get(slug);
}

/** 关键词模糊搜索 */
export function searchTools(query: string): readonly ToolMeta[] {
  const q = query.trim().toLowerCase();
  if (!q) return META;
  return META.filter(
    (m) =>
      m.slug.toLowerCase().includes(q) ||
      m.keywords.some((k) => k.toLowerCase().includes(q)) ||
      m.labelKey.toLowerCase().includes(q),
  );
}
