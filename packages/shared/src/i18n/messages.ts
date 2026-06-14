/**
 * DocForge i18n 消息定义
 * 支持 en / zh-CN / zh-TW / ja / ko / es
 */

import type { I18nMessages, Locale } from "../types/index.js";

const en: I18nMessages = {
  common: {
    tagline: "Developer Toolbox — 30 tools, all offline-first",
    format: "Operation",
    minify: "Minify",
    encode: "Encode",
    decode: "Decode",
    indent: "Indent",
    spaces: "spaces",
    count: "Count",
    kind: "Kind",
    input: "Input",
    output: "Output",
    run: "Run",
    loadSample: "Load Sample",
    reset: "Reset",
    copy: "Copy",
    copied: "Copied!",
    ranAt: "Ran at",
    placeholder: {
      input: "Enter text here...",
      empty: "Output will appear here",
    },
  },
  home: {
    eyebrow: "Developer Toolbox",
    title: "Build <accent>faster</accent> with 30 tools",
    subtitle:
      "Format, convert, encode, validate — all in one place. 28 tools run offline, 2 need the server.",
    stat: {
      tools: "Tools",
      langs: "Languages",
    },
    start: "Get Started",
    recent: "Recently Used",
  },
  nav: {
    playground: "Playground",
  },
  "tools.category.formatter": "Formatter",
  "tools.category.converter": "Converter",
  "tools.category.encoder": "Encoder / Decoder",
  "tools.category.validator": "Validator",
  "tools.category.generator": "Generator",
  "tools.category.diff": "Diff",
  "tools.category.utility": "Utility",
  "tools.category.playground": "Playground",
  "tools.category.extended": "Extended",
  "tools.json-formatter": {
    label: "JSON Formatter",
    description: "Format and minify JSON with syntax highlighting",
  },
  "tools.css-formatter": { label: "CSS Formatter", description: "Beautify and minify CSS stylesheets" },
  "tools.html-formatter": { label: "HTML Formatter", description: "Format and minify HTML documents" },
  "tools.sql-formatter": { label: "SQL Formatter", description: "Beautify SQL queries" },
  "tools.xml-formatter": { label: "XML Formatter", description: "Format XML documents" },
  "tools.markdown-preview": {
    label: "Markdown Preview",
    description: "Render Markdown to HTML in real-time",
  },
  "tools.markdown-to-html": { label: "Markdown → HTML", description: "Convert Markdown to HTML" },
  "tools.html-to-markdown": { label: "HTML → Markdown", description: "Convert HTML back to Markdown" },
  "tools.document-convert": {
    label: "Document Convert",
    description: "Convert between DOCX, PDF, XLSX (requires server)",
  },
  "tools.base64": { label: "Base64", description: "Encode and decode Base64 strings" },
  "tools.url-codec": { label: "URL Codec", description: "Encode and decode URL percent-encoding" },
  "tools.jwt-decoder": {
    label: "JWT Decoder",
    description: "Decode JWT tokens — header, payload, signature",
  },
  "tools.uuid-generator": { label: "UUID Generator", description: "Generate UUID v4 and short IDs" },
  "tools.json-schema-validator": {
    label: "JSON Schema Validator",
    description: "Validate JSON against schemas",
  },
  "tools.regex-tester": { label: "Regex Tester", description: "Test regular expressions with live matching" },
  "tools.qr-generator": { label: "QR Generator", description: "Generate QR codes as SVG" },
  "tools.playground": {
    label: "Code Playground",
    description: "Run code in 19+ languages (requires server)",
  },
  "tools.json-diff": { label: "JSON Diff", description: "Compare two JSON objects side by side" },
  "tools.text-diff": { label: "Text Diff", description: "Line-by-line text comparison" },
  "tools.epoch-converter": {
    label: "Epoch Converter",
    description: "Convert between Unix timestamps and dates",
  },
  "tools.yaml-formatter": { label: "YAML Formatter", description: "Format and minify YAML documents" },
  "tools.hash-generator": {
    label: "Hash Generator",
    description: "Generate MD5, SHA-1, SHA-256, SHA-512 hashes",
  },
  "tools.color-converter": {
    label: "Color Converter",
    description: "Convert between HEX, RGB, HSL color formats",
  },
  "tools.csv-json": { label: "CSV ↔ JSON", description: "Convert between CSV and JSON formats" },
  "tools.text-utils": {
    label: "Text Utils",
    description: "Sort, unique, reverse, case conversion, word count",
  },
  "tools.cron-parser": {
    label: "Cron Parser",
    description: "Parse cron expressions into human-readable descriptions",
  },
  "tools.lorem-ipsum": { label: "Lorem Ipsum", description: "Generate placeholder text" },
  "tools.number-base": { label: "Number Base", description: "Convert between binary, octal, decimal, hex" },
  "tools.jsonpath": { label: "JSONPath", description: "Query JSON data with JSONPath expressions" },
  "tools.validator": { label: "Validator", description: "Validate email, URL, IPv4, IPv6 addresses" },
};

const zhCN: I18nMessages = {
  common: {
    tagline: "开发者工具箱 — 30 个工具，离线优先",
    format: "操作",
    minify: "压缩",
    encode: "编码",
    decode: "解码",
    indent: "缩进",
    spaces: "空格",
    count: "数量",
    kind: "类型",
    input: "输入",
    output: "输出",
    run: "运行",
    loadSample: "加载示例",
    reset: "重置",
    copy: "复制",
    copied: "已复制！",
    ranAt: "运行于",
    placeholder: {
      input: "在此输入文本...",
      empty: "输出将显示在这里",
    },
  },
  home: {
    eyebrow: "开发者工具箱",
    title: "用 30 个工具<accent>加速</accent>开发",
    subtitle: "格式化、转换、编码、校验 — 一站式解决。28 个工具离线运行，2 个需要服务器。",
    stat: {
      tools: "工具",
      langs: "语言",
    },
    start: "开始使用",
    recent: "最近使用",
  },
  nav: {
    playground: "演练场",
  },
  "tools.category.formatter": "格式化",
  "tools.category.converter": "转换",
  "tools.category.encoder": "编解码",
  "tools.category.validator": "校验",
  "tools.category.generator": "生成",
  "tools.category.diff": "差异对比",
  "tools.category.utility": "实用工具",
  "tools.category.playground": "演练场",
  "tools.category.extended": "扩展",
  "tools.json-formatter": { label: "JSON 格式化", description: "格式化和压缩 JSON，语法高亮" },
  "tools.css-formatter": { label: "CSS 格式化", description: "美化和压缩 CSS 样式表" },
  "tools.html-formatter": { label: "HTML 格式化", description: "格式化和压缩 HTML 文档" },
  "tools.sql-formatter": { label: "SQL 格式化", description: "美化 SQL 查询语句" },
  "tools.xml-formatter": { label: "XML 格式化", description: "格式化 XML 文档" },
  "tools.markdown-preview": { label: "Markdown 预览", description: "实时渲染 Markdown 为 HTML" },
  "tools.markdown-to-html": { label: "Markdown → HTML", description: "将 Markdown 转换为 HTML" },
  "tools.html-to-markdown": { label: "HTML → Markdown", description: "将 HTML 转换回 Markdown" },
  "tools.document-convert": { label: "文档转换", description: "在 DOCX、PDF、XLSX 之间转换（需要服务器）" },
  "tools.base64": { label: "Base64", description: "编码和解码 Base64 字符串" },
  "tools.url-codec": { label: "URL 编解码", description: "编码和解码 URL 百分号编码" },
  "tools.jwt-decoder": { label: "JWT 解码器", description: "解码 JWT 令牌 — 头部、载荷、签名" },
  "tools.uuid-generator": { label: "UUID 生成器", description: "生成 UUID v4 和短 ID" },
  "tools.json-schema-validator": { label: "JSON Schema 校验", description: "根据 Schema 校验 JSON" },
  "tools.regex-tester": { label: "正则测试器", description: "测试正则表达式，实时匹配" },
  "tools.qr-generator": { label: "二维码生成", description: "生成 SVG 格式的二维码" },
  "tools.playground": { label: "代码演练场", description: "运行 19+ 种语言的代码（需要服务器）" },
  "tools.json-diff": { label: "JSON 差异", description: "并排比较两个 JSON 对象" },
  "tools.text-diff": { label: "文本差异", description: "逐行文本比较" },
  "tools.epoch-converter": { label: "时间戳转换", description: "在 Unix 时间戳和日期之间转换" },
  "tools.yaml-formatter": { label: "YAML 格式化", description: "格式化和压缩 YAML 文档" },
  "tools.hash-generator": { label: "哈希生成器", description: "生成 MD5、SHA-1、SHA-256、SHA-512 哈希" },
  "tools.color-converter": { label: "颜色转换", description: "在 HEX、RGB、HSL 颜色格式之间转换" },
  "tools.csv-json": { label: "CSV ↔ JSON", description: "在 CSV 和 JSON 格式之间转换" },
  "tools.text-utils": { label: "文本工具", description: "排序、去重、反转、大小写转换、字数统计" },
  "tools.cron-parser": { label: "Cron 解析器", description: "将 cron 表达式解析为可读描述" },
  "tools.lorem-ipsum": { label: "Lorem Ipsum", description: "生成占位符文本" },
  "tools.number-base": { label: "进制转换", description: "在二进制、八进制、十进制、十六进制之间转换" },
  "tools.jsonpath": { label: "JSONPath", description: "使用 JSONPath 表达式查询 JSON 数据" },
  "tools.validator": { label: "格式校验器", description: "校验邮箱、URL、IPv4、IPv6 地址" },
};

const MESSAGES: Record<Locale, I18nMessages> = {
  en,
  "zh-CN": zhCN,
  "zh-TW": zhCN, // fallback
  ja: zhCN, // fallback
  ko: zhCN, // fallback
  es: zhCN, // fallback
};

/** 获取本地化字符串，支持点号路径和 <accent> 标签替换 */
export function tFor(locale: Locale, key: string): string {
  const msgs = MESSAGES[locale] ?? MESSAGES.en;
  const parts = key.split(".");
  let cur: unknown = msgs;
  for (const p of parts) {
    if (cur && typeof cur === "object" && p in cur) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      // fallback to en
      let fallback: unknown = MESSAGES.en;
      for (const fp of parts) {
        if (fallback && typeof fallback === "object" && fp in fallback) {
          fallback = (fallback as Record<string, unknown>)[fp];
        } else {
          return key; // key not found
        }
      }
      cur = fallback;
      break;
    }
  }
  if (typeof cur === "string") {
    // 支持 <accent>xxx</accent> 标签（前端替换为高亮）
    return cur;
  }
  return key;
}

/** 工具标签 */
export function toolLabelFor(locale: Locale, slug: string): string {
  return tFor(locale, `tools.${slug}.label`);
}

/** 工具描述 */
export function toolDescriptionFor(locale: Locale, slug: string): string {
  return tFor(locale, `tools.${slug}.description`);
}

/** 列出支持的界面语言 */
export function listSupportedLocales(): { slug: Locale; label: string }[] {
  return [
    { slug: "en", label: "English" },
    { slug: "zh-CN", label: "简体中文" },
    { slug: "zh-TW", label: "繁體中文" },
    { slug: "ja", label: "日本語" },
    { slug: "ko", label: "한국어" },
    { slug: "es", label: "Español" },
  ];
}

/** 协商语言环境 */
export function negotiateLocale(preferred?: string): Locale {
  if (!preferred) return "en";

  // 解析 Accept-Language 头，提取 locale list（按 q 值排序）
  const locales = preferred
    .split(",")
    .map((part) => {
      const [lang, quality = "q=1"] = part.trim().split(";");
      const q = parseFloat((quality.split("=")[1] ?? "1").trim()) || 1;
      return { locale: lang.trim().toLowerCase(), q };
    })
    .sort((a, b) => b.q - a.q);

  for (const { locale } of locales) {
    const normalized = locale.toLowerCase();
    if (normalized === "zh-cn" || normalized === "zh") return "zh-CN";
    if (normalized === "zh-tw" || normalized === "zh-hk") return "zh-TW";
    if (normalized === "ja" || normalized.startsWith("ja-")) return "ja";
    if (normalized === "ko" || normalized.startsWith("ko-")) return "ko";
    if (normalized === "es" || normalized.startsWith("es-")) return "es";
    if (normalized === "fr" || normalized.startsWith("fr-")) return "fr";
    if (normalized === "en" || normalized.startsWith("en-")) return "en";
  }
  return "en";
}
