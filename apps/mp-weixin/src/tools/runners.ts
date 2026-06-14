/**
 * 20 个工具的纯函数 run(input, options) → result。
 * 逻辑都直接复用 @docforge/shared 的纯函数；这里只是做选项解析与错误包装。
 */

import {
  formatJson,
  minifyJson,
  formatCss,
  minifyCss,
  formatHtml,
  minifyHtml,
  formatSql,
  formatXml,
  encodeBase64,
  decodeBase64,
  encodeUrl,
  decodeUrl,
  decodeJwt,
  jwtIsExpired,
  uuid,
  shortId,
  regexTest,
  markdownToHtml,
  htmlToMarkdown,
  buildQrMatrix,
  qrToSvg,
  lineDiff,
  jsonDiff,
  isoToEpoch,
  epochToIso,
  relativeTime,
  // 扩展工具
  formatYaml,
  minifyYaml,
  generateHash,
  hexToRgb,
  rgbToHex,
  csvToJson,
  jsonToCsv,
  sortLines,
  uniqueLines,
  reverseLines,
  shuffleLines,
  toUpperCase,
  toLowerCase,
  toTitleCase,
  wordCount,
  parseCron,
  generateLoremIpsum,
  convertBase,
  queryJsonPath,
  validateEmail,
  validateUrl,
  validateIPv4,
  validateIPv6,
  validateIP,
  type ToolRunner,
  type ToolRunResult,
} from "@docforge/shared";
import { createProjectSchema, signInSchema, checkJsonBasic } from "@docforge/shared";

function jsonOrError(input: string): { ok: true; value: unknown } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(input) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/* ─── Formatter 类 ───────────────────────────────────────── */

export const runJsonFormatter: ToolRunner = (input, opts) => {
  const op = (opts?.op as string) ?? "format";
  if (op === "minify") {
    const r = minifyJson(input);
    return r.ok ? { ok: true, output: r.output } : { ok: false, error: r.error };
  }
  const indent = Number(opts?.indent ?? 2);
  const r = formatJson(input, indent);
  return r.ok ? { ok: true, output: r.output } : { ok: false, error: r.error };
};

export const runCssFormatter: ToolRunner = (input, opts) => {
  if ((opts?.op as string) === "minify") {
    return { ok: true, output: minifyCss(input) };
  }
  return { ok: true, output: formatCss(input) };
};

export const runHtmlFormatter: ToolRunner = (input, opts) => {
  if ((opts?.op as string) === "minify") {
    return { ok: true, output: minifyHtml(input) };
  }
  return { ok: true, output: formatHtml(input) };
};

export const runSqlFormatter: ToolRunner = (input) => ({ ok: true, output: formatSql(input) });

export const runXmlFormatter: ToolRunner = (input) => ({ ok: true, output: formatXml(input) });

export const runMarkdownPreview: ToolRunner = (input) => ({
  ok: true,
  output: markdownToHtml(input),
});

export const runMarkdownToHtml: ToolRunner = (input) => ({
  ok: true,
  output: markdownToHtml(input),
});

export const runHtmlToMarkdown: ToolRunner = (input) => ({
  ok: true,
  output: htmlToMarkdown(input),
});

/* ─── Converter / encoder 类 ─────────────────────────────── */

export const runDocumentConvert: ToolRunner = (input) => ({
  ok: false,
  error:
    "Document conversion requires the backend. POST to /api/convert with the source file. (M1 离线端不支持)",
});

export const runBase64: ToolRunner = (input, opts) => {
  const op = (opts?.op as string) ?? "encode";
  try {
    if (op === "decode") {
      return { ok: true, output: decodeBase64(input) };
    }
    return { ok: true, output: encodeBase64(input) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
};

export const runUrlCodec: ToolRunner = (input, opts) => {
  const op = (opts?.op as string) ?? "encode";
  if (op === "decode") {
    return { ok: true, output: decodeUrl(input) };
  }
  return { ok: true, output: encodeUrl(input) };
};

export const runJwtDecoder: ToolRunner = (input) => {
  if (!input.trim()) return { ok: false, error: "请输入 JWT token" };
  const r = decodeJwt(input.trim());
  if (!r.ok) return { ok: false, error: r.error };
  const expired = jwtIsExpired(r.payload);
  const lines = [
    `// header`,
    JSON.stringify(r.header, null, 2),
    ``,
    `// payload${expired ? "  (expired)" : ""}`,
    JSON.stringify(r.payload, null, 2),
    ``,
    `// signature`,
    r.signature,
  ];
  return { ok: true, output: lines.join("\n"), meta: { expired } };
};

export const runUuidGenerator: ToolRunner = (input, opts) => {
  const count = Math.min(100, Math.max(1, Number(opts?.count ?? 5)));
  const kind = (opts?.kind as string) ?? "uuid";
  const factory = kind === "short" ? () => shortId(7) : () => uuid();
  const out: string[] = [];
  for (let i = 0; i < count; i++) out.push(factory());
  if (input.trim()) out.unshift(`// prefix: ${input.trim()}`);
  return { ok: true, output: out.join("\n") };
};

/* ─── Validator / generator 类 ──────────────────────────── */

export const runJsonSchemaValidator: ToolRunner = (input, opts) => {
  const schemaText = (opts?.schema as string) ?? "";
  if (!schemaText.trim()) {
    // 退而求其次：仅做基本 JSON 校验
    const r = jsonOrError(input);
    if (!r.ok) return { ok: false, error: r.error };
    return { ok: true, output: "✓ 有效 JSON（未提供 schema，仅做语法校验）" };
  }
  // 内置几个常用 schema（轻量；M2 接入 ajv 完整支持）
  const builtin: Record<string, Parameters<typeof checkJsonBasic>[1]> = {
    signin: signInSchema as unknown as Parameters<typeof checkJsonBasic>[1],
    project: createProjectSchema as unknown as Parameters<typeof checkJsonBasic>[1],
  };
  const key = schemaText.trim().toLowerCase();
  const zod = builtin[key];
  if (!zod) {
    return {
      ok: false,
      error: `未识别的 schema: ${key}。可选: ${Object.keys(builtin).join(", ")} 或留空`,
    };
  }
  const r = checkJsonBasic(input, zod);
  if (!r.ok) {
    const lines = r.errors.map((e) => `✗ ${e.path} — ${e.message}`).join("\n");
    return { ok: false, error: lines };
  }
  return { ok: true, output: "✓ 通过校验" };
};

export const runRegexTester: ToolRunner = (input, opts) => {
  const pattern = (opts?.pattern as string) ?? "\\b\\w+\\b";
  const flags = (opts?.flags as string) ?? "g";
  const r = regexTest(pattern, flags, input);
  if (!r.ok) return { ok: false, error: r.error ?? "unknown error" };
  if (r.count === 0) return { ok: true, output: "// no matches" };
  const lines = r.matches.map(
    (m, i) =>
      `[${i + 1}] @${m.start}–${m.end}  ${m.match}` +
      (Object.keys(m.namedGroups).length
        ? `  ${JSON.stringify(m.namedGroups)}`
        : m.groups.length
          ? `  ${JSON.stringify(m.groups)}`
          : ""),
  );
  return { ok: true, output: lines.join("\n"), meta: { count: r.count } };
};

export const runQrGenerator: ToolRunner = (input, opts) => {
  const text = input.trim();
  if (!text) return { ok: false, error: "请输入要生成二维码的内容" };
  const ec = (opts?.ec as "L" | "M" | "Q" | "H") ?? "M";
  const size = Number(opts?.size ?? 256);
  const matrix = buildQrMatrix({ text, ecLevel: ec, size });
  const svg = qrToSvg(matrix);
  // 用 width/height 控制显示尺寸
  const sized = svg.replace("<svg ", `<svg width="${size}" height="${size}" `);
  return { ok: true, output: sized, meta: { size: matrix.size } };
};

/* ─── Playground / Diff / Time 类 ────────────────────────── */

export const runPlayground: ToolRunner = () => ({
  ok: false,
  error: "Playground 需要后端（Piston）。前往 Playground 页面使用。",
});

export const runJsonDiff: ToolRunner = (input) => {
  // 输入以 "---" 分隔左右
  const parts = input.split(/\n---\n/);
  if (parts.length !== 2) {
    return { ok: false, error: '请用 "---" 分隔左右两侧 JSON，例如 {"a":1}\\n---\\n{"a":2}' };
  }
  let l: unknown;
  let r: unknown;
  try {
    l = JSON.parse(parts[0] ?? "");
  } catch (e) {
    return { ok: false, error: `左侧解析失败: ${(e as Error).message}` };
  }
  try {
    r = JSON.parse(parts[1] ?? "");
  } catch (e) {
    return { ok: false, error: `右侧解析失败: ${(e as Error).message}` };
  }
  const diffs = jsonDiff(l, r);
  if (diffs.length === 0) return { ok: true, output: "(empty diff)" };
  const lines = diffs.map((d) => {
    const tag = { added: "+", removed: "-", changed: "~", unchanged: " " }[d.kind];
    return `${tag} ${d.path}${d.kind === "unchanged" ? "" : `  ${JSON.stringify(d[d.kind === "added" ? "right" : "left"])}`}`;
  });
  return { ok: true, output: lines.join("\n") };
};

export const runTextDiff: ToolRunner = (input) => {
  const parts = input.split(/\n---\n/);
  if (parts.length !== 2) {
    return { ok: false, error: '请用 "---" 分隔左右两侧文本' };
  }
  const diff = lineDiff(parts[0] ?? "", parts[1] ?? "");
  if (diff.length === 0) return { ok: true, output: "(no diff)" };
  const lines = diff.map((d) => {
    const tag = { equal: " ", insert: "+", delete: "-" }[d.op];
    const l = d.left?.toString().padStart(4, " ") ?? "    ";
    const r = d.right?.toString().padStart(4, " ") ?? "    ";
    return `${tag} ${l} | ${r} | ${d.value}`;
  });
  return { ok: true, output: lines.join("\n") };
};

export const runEpochConverter: ToolRunner = (input) => {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, error: "请输入 epoch（秒/毫秒）或 ISO 时间" };
  // 尝试 ISO → epoch
  const iso = /^\d{4}-\d{2}-\d{2}T/.test(trimmed);
  if (iso) {
    const sec = isoToEpoch(trimmed);
    const ms = sec * 1000;
    return {
      ok: true,
      output: `epoch (s) : ${sec}\nepoch (ms): ${ms}\nlocal    : ${new Date(ms).toString()}`,
    };
  }
  // 数字
  const n = Number(trimmed);
  if (!Number.isFinite(n)) {
    return { ok: false, error: "无效输入：应为数字或 ISO 时间字符串" };
  }
  // 自动判别秒/毫秒
  const sec = n > 1e12 ? Math.floor(n / 1000) : n;
  const ms = sec * 1000;
  const dt = new Date(ms);
  if (Number.isNaN(dt.getTime())) return { ok: false, error: "无法解析该时间戳" };
  const rel = relativeTime(epochToIso(sec));
  return {
    ok: true,
    output: `ISO        : ${epochToIso(sec)}\nlocal      : ${dt.toString()}\nUTC        : ${dt.toUTCString()}\nrel. now   : ${rel.future ? "+" : "-"}${rel.value} ${rel.unit}`,
  };
};

/* ─── 扩展工具 ──────────────────────────────────────────── */

export const runYamlFormatter: ToolRunner = (input, opts) => {
  const op = (opts?.op as string) ?? "format";
  if (op === "minify") {
    return { ok: true, output: minifyYaml(input) };
  }
  const r = formatYaml(input);
  return r.ok ? { ok: true, output: r.output } : { ok: false, error: r.error };
};

export const runHashGenerator: ToolRunner = async (input, opts) => {
  const algorithm = ((opts?.algorithm as string) ?? "SHA-256").toLowerCase().replace("-", "");
  const r = await generateHash(input, algorithm as any);
  return r.ok ? { ok: true, output: r.hash } : { ok: false, error: r.error };
};

export const runColorConverter: ToolRunner = (input, opts) => {
  const mode = (opts?.mode as string) ?? "hex";
  if (mode === "hex" && input.startsWith("#")) {
    const rgb = hexToRgb(input);
    if (!rgb) return { ok: false, error: "Invalid HEX color" };
    return { ok: true, output: `RGB: rgb(${rgb.r}, ${rgb.g}, ${rgb.b})` };
  }
  if (mode === "rgb") {
    const match = input.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (match) {
      const [, r, g, b] = match;
      const hex = rgbToHex(Number(r), Number(g), Number(b));
      return { ok: true, output: `HEX: ${hex}` };
    }
  }
  return { ok: false, error: "无法解析颜色格式" };
};

export const runCsvJson: ToolRunner = (input, opts) => {
  const op = (opts?.op as string) ?? "csvToJson";
  if (op === "jsonToCsv") {
    const r = jsonToCsv(input);
    return r.ok ? { ok: true, output: r.output } : { ok: false, error: r.error };
  }
  const r = csvToJson(input);
  return r.ok ? { ok: true, output: r.output } : { ok: false, error: r.error };
};

export const runTextUtils: ToolRunner = (input, opts) => {
  const op = (opts?.op as string) ?? "sort";
  switch (op) {
    case "sort":
      return { ok: true, output: sortLines(input, false) };
    case "sortDesc":
      return { ok: true, output: sortLines(input, true) };
    case "unique":
      return { ok: true, output: uniqueLines(input) };
    case "reverse":
      return { ok: true, output: reverseLines(input) };
    case "shuffle":
      return { ok: true, output: shuffleLines(input) };
    case "upper":
      return { ok: true, output: toUpperCase(input) };
    case "lower":
      return { ok: true, output: toLowerCase(input) };
    case "title":
      return { ok: true, output: toTitleCase(input) };
    case "count": {
      const wc = wordCount(input);
      return { ok: true, output: `字符: ${wc.chars}\n单词: ${wc.words}\n行: ${wc.lines}` };
    }
    default:
      return { ok: false, error: `未知操作: ${op}` };
  }
};

export const runCronParser: ToolRunner = (input) => {
  const r = parseCron(input);
  if (r.ok) {
    return { ok: true, output: r.description };
  }
  return { ok: false, error: r.error };
};

export const runLoremIpsum: ToolRunner = (input, opts) => {
  const count = Number(opts?.count ?? 50);
  return { ok: true, output: generateLoremIpsum(count) };
};

export const runNumberBase: ToolRunner = (input, opts) => {
  const fromBase = Number(opts?.fromBase ?? 10);
  const toBase = Number(opts?.toBase ?? 16);
  const r = convertBase(input, fromBase, toBase);
  return r.ok ? { ok: true, output: r.output } : { ok: false, error: r.error };
};

export const runJsonPath: ToolRunner = (input, opts) => {
  const path = (opts?.path as string) ?? "$";
  const r = queryJsonPath(input, path);
  return r.ok ? { ok: true, output: JSON.stringify(r.result, null, 2) } : { ok: false, error: r.error };
};

export const runValidator: ToolRunner = (input, opts) => {
  const type = (opts?.type as string) ?? "email";
  switch (type) {
    case "email":
      return { ok: true, output: validateEmail(input) ? "✓ 有效邮箱" : "✗ 无效邮箱" };
    case "url":
      return { ok: true, output: validateUrl(input) ? "✓ 有效URL" : "✗ 无效URL" };
    case "ipv4":
      return { ok: true, output: validateIPv4(input) ? "✓ 有效IPv4" : "✗ 无效IPv4" };
    case "ipv6":
      return { ok: true, output: validateIPv6(input) ? "✓ 有效IPv6" : "✗ 无效IPv6" };
    case "ip": {
      const result = validateIP(input);
      return { ok: true, output: result.valid ? `✓ 有效IP (${result.type})` : "✗ 无效IP" };
    }
    default:
      return { ok: false, error: `未知类型: ${type}` };
  }
};

/* ─── 工具注册表 → 路由 ──────────────────────────────────── */

import type { ToolMeta } from "@docforge/shared";
import { getTool } from "@docforge/shared";

export const RUNNERS: Record<string, ToolRunner> = {
  "json-formatter": runJsonFormatter,
  "css-formatter": runCssFormatter,
  "html-formatter": runHtmlFormatter,
  "sql-formatter": runSqlFormatter,
  "xml-formatter": runXmlFormatter,
  "markdown-preview": runMarkdownPreview,
  "markdown-to-html": runMarkdownToHtml,
  "html-to-markdown": runHtmlToMarkdown,
  "document-convert": runDocumentConvert,
  base64: runBase64,
  "url-codec": runUrlCodec,
  "jwt-decoder": runJwtDecoder,
  "uuid-generator": runUuidGenerator,
  "json-schema-validator": runJsonSchemaValidator,
  "regex-tester": runRegexTester,
  "qr-generator": runQrGenerator,
  playground: runPlayground,
  "json-diff": runJsonDiff,
  "text-diff": runTextDiff,
  "epoch-converter": runEpochConverter,
  // 新增 10 个工具
  "yaml-formatter": runYamlFormatter,
  "hash-generator": runHashGenerator,
  "color-converter": runColorConverter,
  "csv-json": runCsvJson,
  "text-utils": runTextUtils,
  "cron-parser": runCronParser,
  "lorem-ipsum": runLoremIpsum,
  "number-base": runNumberBase,
  jsonpath: runJsonPath,
  validator: runValidator,
};

export function getRunner(slug: string): ToolRunner | undefined {
  return RUNNERS[slug];
}

/** 兼容之前的命名导出（页面里 import 旧名） */
export { getTool as getToolMeta };
export type { ToolMeta };
