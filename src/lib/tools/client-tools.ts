/**
 * Pure-JS utility implementations for the /tools page.
 *
 * Everything here MUST be safe to import in a client component and run
 * entirely in the browser — no fetch, no /api/* calls. The /tools page
 * is meant to keep being useful even when the backend is offline.
 *
 * If a feature genuinely needs the server (e.g. PDF rendering for a
 * large file), it lives elsewhere — this file is the "100% offline" kit.
 */

import QRCode from "qrcode";

// ─── JSON ────────────────────────────────────────────────────────────

export function formatJson(
  input: string,
  indent = 2,
): { ok: true; output: string } | { ok: false; error: string } {
  try {
    const parsed = JSON.parse(input);
    return { ok: true, output: JSON.stringify(parsed, null, indent) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export function minifyJson(input: string): { ok: true; output: string } | { ok: false; error: string } {
  try {
    return { ok: true, output: JSON.stringify(JSON.parse(input)) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export function jsonToTree(input: string): { ok: true; root: JsonNode } | { ok: false; error: string } {
  try {
    return { ok: true, root: buildNode(JSON.parse(input), "$") };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export type JsonNode = {
  key: string;
  path: string;
  kind: "object" | "array" | "string" | "number" | "boolean" | "null";
  value?: unknown;
  children?: JsonNode[];
};

function buildNode(value: unknown, key: string, path = "$"): JsonNode {
  if (Array.isArray(value)) {
    return {
      key,
      path,
      kind: "array",
      children: value.map((v, i) => buildNode(v, String(i), `${path}[${i}]`)),
    };
  }
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    return {
      key,
      path,
      kind: "object",
      children: entries.map(([k, v]) => buildNode(v, k, `${path}.${k}`)),
    };
  }
  if (value === null) return { key, path, kind: "null", value: "null" };
  if (typeof value === "string") return { key, path, kind: "string", value: JSON.stringify(value) };
  if (typeof value === "number") return { key, path, kind: "number", value: String(value) };
  if (typeof value === "boolean") return { key, path, kind: "boolean", value: String(value) };
  return { key, path, kind: "string", value: String(value) };
}

// ─── CSS / HTML / SQL formatters ────────────────────────────────────

export function formatCss(input: string): string {
  return simplePretty(input, "{", "}", "/*", "*/");
}

export function minifyCss(input: string): string {
  return input
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\s*([{}:;,])\s*/g, "$1")
    .replace(/;}/g, "}")
    .trim();
}

export function formatHtml(input: string): string {
  // Tiny tag-based indenter. Skips <pre>/<code> blocks.
  const stripped = input.replace(/\s+/g, " ").trim();
  const tokens = stripped.match(/<!--[\s\S]*?-->|<\/?[a-zA-Z][^>]*>|[^<]+/g) ?? [];
  const out: string[] = [];
  let depth = 0;
  const inlineTags = new Set([
    "a",
    "b",
    "i",
    "em",
    "strong",
    "span",
    "u",
    "img",
    "br",
    "code",
    "small",
    "sub",
    "sup",
    "kbd",
  ]);
  for (const tok of tokens) {
    if (tok.startsWith("</")) {
      depth = Math.max(0, depth - 1);
      out.push("  ".repeat(depth) + tok);
    } else if (tok.startsWith("<") && !tok.startsWith("<!") && !tok.endsWith("/>")) {
      const m = /^<([a-zA-Z][a-zA-Z0-9]*)/.exec(tok);
      const tag = m?.[1]?.toLowerCase() ?? "";
      if (inlineTags.has(tag)) {
        out.push("  ".repeat(depth) + tok);
      } else {
        out.push("  ".repeat(depth) + tok);
        depth++;
      }
    } else {
      out.push("  ".repeat(depth) + tok);
    }
  }
  return out.join("\n");
}

export function minifyHtml(input: string): string {
  return input.replace(/>\s+</g, "><").replace(/\s+/g, " ").trim();
}

const SQL_KEYWORDS = new Set([
  "select",
  "from",
  "where",
  "group by",
  "order by",
  "having",
  "limit",
  "offset",
  "insert into",
  "values",
  "update",
  "set",
  "delete from",
  "join",
  "left join",
  "right join",
  "inner join",
  "outer join",
  "on",
  "as",
  "and",
  "or",
  "not",
  "in",
  "is",
  "null",
  "like",
  "create table",
  "drop table",
  "alter table",
  "primary key",
  "foreign key",
  "references",
  "begin",
  "commit",
  "rollback",
  "case",
  "when",
  "then",
  "else",
  "end",
  "union",
  "all",
  "distinct",
  "with",
  "exists",
  "between",
  "asc",
  "desc",
  "true",
  "false",
  "into",
  "or replace",
  "if",
  "create index",
  "drop index",
  "returning",
  "using",
  "natural",
  "cross",
]);

export function formatSql(input: string): string {
  const upper = input.replace(/\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g, (m) =>
    SQL_KEYWORDS.has(m.toLowerCase()) ? m.toUpperCase() : m,
  );
  const upperList = [
    "SELECT",
    "FROM",
    "WHERE",
    "GROUP BY",
    "ORDER BY",
    "HAVING",
    "LIMIT",
    "OFFSET",
    "INNER JOIN",
    "LEFT JOIN",
    "RIGHT JOIN",
    "OUTER JOIN",
    "JOIN",
    "ON",
    "UNION ALL",
    "UNION",
    "INSERT INTO",
    "VALUES",
    "UPDATE",
    "SET",
    "DELETE FROM",
    "RETURNING",
  ];
  let out = upper;
  for (const kw of upperList) {
    const re = new RegExp(`\\b${kw.replace(/ /g, "\\s+")}\\b`, "g");
    out = out.replace(re, `\n${kw}`);
  }
  return out
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l, _i, arr) => (l.startsWith(arr[0]?.split(" ")[0] ?? "") ? "  ".repeat(0) + l : "  " + l))
    .join("\n")
    .replace(/^  /, "");
}

export function minifySql(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

function simplePretty(
  input: string,
  open: string,
  close: string,
  commentOpen: string,
  commentClose: string,
): string {
  const stripped = input.replace(
    new RegExp(`${escapeRe(commentOpen)}[\\s\\S]*?${escapeRe(commentClose)}`, "g"),
    "",
  );
  const out: string[] = [];
  let depth = 0;
  let buf = "";
  for (const ch of stripped) {
    if (ch === open) {
      const head = buf.trim();
      if (head) out.push("  ".repeat(depth) + head + " " + open);
      else out.push("  ".repeat(depth) + open);
      depth++;
      buf = "";
    } else if (ch === close) {
      const decls = buf
        .split(";")
        .map((d) => d.trim())
        .filter(Boolean);
      for (const d of decls) out.push("  ".repeat(depth) + d + ";");
      depth = Math.max(0, depth - 1);
      out.push("  ".repeat(depth) + close);
      buf = "";
    } else {
      buf += ch;
    }
  }
  if (buf.trim()) out.push("  ".repeat(depth) + buf.trim());
  return out.join("\n");
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ─── YAML / TOML / CSV / MD ↔ JSON / HTML ──────────────────────────

export function jsonToYaml(input: string): { ok: true; output: string } | { ok: false; error: string } {
  try {
    return { ok: true, output: dumpYaml(JSON.parse(input)) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export function yamlToJson(
  input: string,
  indent = 2,
): { ok: true; output: string } | { ok: false; error: string } {
  try {
    return { ok: true, output: JSON.stringify(parseYaml(input), null, indent) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

function dumpYaml(value: unknown, indent = 0): string {
  const pad = "  ".repeat(indent);
  if (value === null) return "null";
  if (typeof value === "boolean" || typeof value === "number") return String(value);
  if (typeof value === "string") {
    if (/[:\-?{}\[\],&*#|!%@`>"\n]/.test(value) || value === "" || /^\s|\s$/.test(value)) {
      return JSON.stringify(value);
    }
    return value;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    return value
      .map((v) => {
        const inner = dumpYaml(v, indent + 1);
        if (Array.isArray(v) || (v !== null && typeof v === "object"))
          return `${pad}- ${inner.startsWith("  ") ? inner.slice(2) : inner}`;
        return `${pad}- ${inner}`;
      })
      .join("\n");
  }
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return "{}";
    return entries
      .map(([k, v]) => {
        const inner = dumpYaml(v, indent + 1);
        if (Array.isArray(v) || (v !== null && typeof v === "object")) {
          return `${pad}${k}:\n${inner}`;
        }
        return `${pad}${k}: ${inner}`;
      })
      .join("\n");
  }
  return String(value);
}

export function parseYaml(src: string): unknown {
  // Very small YAML subset: scalars, mappings, block sequences, quoted strings.
  const lines = src
    .replace(/\r\n/g, "\n")
    .split("\n")
    .filter((l) => !/^\s*#/.test(l));
  let i = 0;
  const indentOf = (l: string) => l.match(/^ */)?.[0].length ?? 0;

  function readBlock(indent: number): unknown {
    if (i >= lines.length) return null;
    const line = lines[i]!;
    const ind = indentOf(line);
    if (ind < indent) return null;
    const trimmed = line.slice(ind);
    if (trimmed.startsWith("- ")) return readArray(ind);
    return readObject(ind);
  }

  function readObject(indent: number): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    while (i < lines.length) {
      const line = lines[i]!;
      const ind = indentOf(line);
      if (ind < indent) break;
      if (ind > indent) break;
      if (line.startsWith(" ".repeat(indent + 1))) break;
      const m = /^([A-Za-z_][\w-]*)\s*:\s*(.*)$/.exec(line.slice(ind));
      if (!m) break;
      const [, key, rest] = m;
      const r = rest ?? "";
      i++;
      if (r === "" || r === "|" || r === ">") {
        out[key!] = readBlock(indent + 2);
      } else if (r.startsWith("[") && r.endsWith("]")) {
        out[key!] = parseInline(
          r
            .slice(1, -1)
            .split(",")
            .map((s) => parseScalar(s.trim())),
        );
      } else {
        out[key!] = parseScalar(r);
      }
    }
    return out;
  }

  function readArray(indent: number): unknown[] {
    const out: unknown[] = [];
    while (i < lines.length) {
      const line = lines[i]!;
      const ind = indentOf(line);
      if (ind < indent) break;
      if (!line.slice(ind).startsWith("- ")) break;
      const rest = line.slice(ind + 2);
      i++;
      if (rest === "") {
        out.push(readBlock(indent + 2));
      } else if (rest.includes(":")) {
        // inline object inside array entry
        const obj: Record<string, unknown> = {};
        const m = /^([A-Za-z_][\w-]*)\s*:\s*(.*)$/.exec(rest);
        if (m) {
          const [, k, v] = m;
          obj[k!] = v ? parseScalar(v) : readBlock(indent + 2);
        }
        out.push(obj);
      } else {
        out.push(parseScalar(rest));
      }
    }
    return out;
  }

  function parseScalar(s: string): unknown {
    const t = s.trim();
    if (t === "" || t === "~" || t === "null") return null;
    if (t === "true" || t === "True" || t === "TRUE") return true;
    if (t === "false" || t === "False" || t === "FALSE") return false;
    if (/^-?\d+$/.test(t)) return Number(t);
    if (/^-?\d+\.\d+$/.test(t)) return Number(t);
    if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
      return t.slice(1, -1);
    }
    return t;
  }

  function parseInline(arr: unknown[]): unknown {
    return arr;
  }

  return readBlock(0);
}

export function jsonToToml(input: string): { ok: true; output: string } | { ok: false; error: string } {
  try {
    const data = JSON.parse(input);
    return { ok: true, output: dumpToml(data, "") };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export function tomlToJson(
  input: string,
  indent = 2,
): { ok: true; output: string } | { ok: false; error: string } {
  try {
    return { ok: true, output: JSON.stringify(parseToml(input), null, indent) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

function dumpToml(value: unknown, key: string): string {
  if (value === null) return `${key} = ""`;
  if (typeof value === "boolean" || typeof value === "number") return `${key} = ${value}`;
  if (typeof value === "string") return `${key} = ${tomlString(value)}`;
  if (Array.isArray(value)) {
    return `${key} = [${value.map(tomlInline).join(", ")}]`;
  }
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    const lines: string[] = [];
    const subObjects: string[] = [];
    for (const [k, v] of entries) {
      if (v !== null && typeof v === "object" && !Array.isArray(v)) {
        subObjects.push(dumpToml(v, k));
      } else {
        lines.push(dumpToml(v, k));
      }
    }
    return `[${key}]\n` + lines.join("\n") + (subObjects.length ? "\n" + subObjects.join("\n") : "");
  }
  return `${key} = ${tomlString(String(value))}`;
}

function tomlString(s: string): string {
  return JSON.stringify(s);
}

function tomlInline(v: unknown): string {
  if (typeof v === "string") return JSON.stringify(v);
  return String(v);
}

export function parseToml(src: string): Record<string, unknown> {
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  const root: Record<string, unknown> = {};
  let current: Record<string, unknown> = root;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    if (line.startsWith("[") && line.endsWith("]")) {
      const section = line.slice(1, -1).trim();
      const parts = section.split(".");
      let obj = root;
      for (const p of parts) {
        if (!obj[p] || typeof obj[p] !== "object") obj[p] = {};
        obj = obj[p] as Record<string, unknown>;
      }
      current = obj;
      continue;
    }
    const m = /^([^=#]+?)\s*=\s*(.+)$/.exec(line);
    if (!m) continue;
    const [, keyRaw, valueRaw] = m;
    const key = (keyRaw ?? "").trim();
    const value = (valueRaw ?? "").trim();
    current[key] = parseTomlValue(value);
  }
  return root;
}

function parseTomlValue(v: string): unknown {
  if (v === "true") return true;
  if (v === "false") return false;
  if (/^-?\d+$/.test(v)) return Number(v);
  if (/^-?\d+\.\d+$/.test(v)) return Number(v);
  if (v.startsWith("[") && v.endsWith("]")) {
    const inner = v.slice(1, -1).trim();
    if (!inner) return [];
    return inner.split(",").map((s) => parseTomlValue(s.trim()));
  }
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1);
  }
  return v;
}

export function jsonToCsv(input: string): { ok: true; output: string } | { ok: false; error: string } {
  try {
    const data = JSON.parse(input);
    if (!Array.isArray(data)) return { ok: false, error: "JSON must be an array of objects" };
    if (data.length === 0) return { ok: true, output: "" };
    const headers = Array.from(
      new Set(data.flatMap((r) => (r && typeof r === "object" ? Object.keys(r as object) : []))),
    );
    const lines = [headers.map(csvEscape).join(",")];
    for (const row of data) {
      const obj = (row ?? {}) as Record<string, unknown>;
      lines.push(headers.map((h) => csvEscape(obj[h])).join(","));
    }
    return { ok: true, output: lines.join("\n") };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export function csvToJson(
  input: string,
  indent = 2,
): { ok: true; output: string } | { ok: false; error: string } {
  try {
    const rows = parseCsv(input);
    if (rows.length === 0) return { ok: true, output: "[]" };
    const headers = rows[0] ?? [];
    const out = rows.slice(1).map((row) => {
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => {
        obj[h] = row[i] ?? "";
      });
      return obj;
    });
    return { ok: true, output: JSON.stringify(out, null, indent) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = typeof v === "string" ? v : String(v);
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function parseCsv(src: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [];
  let buf = "";
  let inQ = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQ) {
      if (ch === '"' && src[i + 1] === '"') {
        buf += '"';
        i++;
      } else if (ch === '"') {
        inQ = false;
      } else {
        buf += ch;
      }
    } else if (ch === '"') {
      inQ = true;
    } else if (ch === ",") {
      row.push(buf);
      buf = "";
    } else if (ch === "\n" || ch === "\r") {
      row.push(buf);
      out.push(row);
      row = [];
      buf = "";
      if (ch === "\r" && src[i + 1] === "\n") i++;
    } else {
      buf += ch;
    }
  }
  if (buf.length || row.length) {
    row.push(buf);
    out.push(row);
  }
  return out.filter((r) => !(r.length === 1 && r[0] === ""));
}

export function markdownToHtml(input: string): string {
  return miniMarkdownToHtml(input);
}

// Lazy-loaded Turndown handle. We cache the module promise so the heavy
// HTML→MD converter is only fetched the first time `htmlToMarkdown` runs.
type TurndownModule = { default: new (opts?: object) => { turndown: (html: string) => string } };
let _turndownPromise: Promise<TurndownModule> | null = null;
function loadTurndown(): Promise<TurndownModule> {
  if (!_turndownPromise) {
    _turndownPromise = import("turndown") as Promise<TurndownModule>;
  }
  return _turndownPromise;
}

export async function htmlToMarkdown(input: string): Promise<string> {
  const mod = await loadTurndown();
  const TurndownService = mod.default;
  const td = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced" });
  return td.turndown(input);
}

function miniMarkdownToHtml(md: string): string {
  // Reuse the same logic as the markdown runner in frontend-runner (kept
  // in sync intentionally — markdown output is intentionally deterministic).
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let inCode = false;
  let codeLang = "";
  let inList: "ul" | "ol" | null = null;
  let inBq = false;
  const flushList = () => {
    if (inList) {
      out.push(`</${inList}>`);
      inList = null;
    }
  };
  const flushBq = () => {
    if (inBq) {
      out.push("</blockquote>");
      inBq = false;
    }
  };
  for (const raw of lines) {
    const line = raw;
    if (line.startsWith("```")) {
      flushList();
      flushBq();
      if (inCode) {
        out.push("</code></pre>");
        inCode = false;
      } else {
        codeLang = line.slice(3).trim();
        out.push(`<pre><code class="lang-${codeLang}">`);
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      out.push(escapeHtml(line));
      continue;
    }
    if (/^#{1,6}\s+/.test(line)) {
      flushList();
      flushBq();
      const m = line.match(/^(#{1,6})\s+(.*)$/)!;
      out.push(`<h${m[1]!.length}>${inline(m[2]!)}</h${m[1]!.length}>`);
      continue;
    }
    if (/^>\s?/.test(line)) {
      flushList();
      if (!inBq) {
        out.push("<blockquote>");
        inBq = true;
      }
      out.push(`<p>${inline(line.replace(/^>\s?/, ""))}</p>`);
      continue;
    } else flushBq();
    const ul = /^[-*]\s+(.*)$/.exec(line);
    const ol = /^\d+\.\s+(.*)$/.exec(line);
    if (ul || ol) {
      const kind: "ul" | "ol" = ul ? "ul" : "ol";
      if (inList && inList !== kind) flushList();
      if (!inList) {
        out.push(`<${kind}>`);
        inList = kind;
      }
      out.push(`<li>${inline((ul ?? ol)![1]!)}</li>`);
      continue;
    } else flushList();
    if (line.trim() === "") {
      out.push("");
      continue;
    }
    out.push(`<p>${inline(line)}</p>`);
  }
  flushList();
  flushBq();
  if (inCode) out.push("</code></pre>");
  return out.join("\n");
  function inline(s: string): string {
    return escapeHtml(s)
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "<em>$1</em>")
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, t, u) => `<a href="${u}">${t}</a>`);
  }
  function escapeHtml(s: string): string {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
}

// ─── Base64 / URL ────────────────────────────────────────────────────

export function encodeBase64(input: string): string {
  // Browser-only
  if (typeof btoa === "function") {
    return btoa(unescape(encodeURIComponent(input)));
  }
  return Buffer.from(input, "utf-8").toString("base64");
}

export function decodeBase64(input: string): { ok: true; output: string } | { ok: false; error: string } {
  try {
    if (typeof atob === "function") {
      return { ok: true, output: decodeURIComponent(escape(atob(input.trim()))) };
    }
    return { ok: true, output: Buffer.from(input.trim(), "base64").toString("utf-8") };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export function encodeUrl(input: string): string {
  return encodeURIComponent(input);
}

export function decodeUrl(input: string): { ok: true; output: string } | { ok: false; error: string } {
  try {
    return { ok: true, output: decodeURIComponent(input) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ─── Hash (Web Crypto) ──────────────────────────────────────────────

export async function hashText(
  input: string,
  algo: "SHA-1" | "SHA-256" | "SHA-384" | "SHA-512",
): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest(algo, buf);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** MD5 is not part of Web Crypto, so we ship a tiny pure-JS implementation. */
export function md5(input: string): string {
  return md5Hex(input);
}

function md5Hex(s: string): string {
  function rh(n: number): string {
    let s = "";
    for (let j = 0; j <= 3; j++)
      s += ((n >> (j * 8 + 4)) & 0x0f).toString(16) + ((n >> (j * 8)) & 0x0f).toString(16);
    return s;
  }
  function ad(x: number, y: number): number {
    const l = (x & 0xffff) + (y & 0xffff);
    const m = (x >> 16) + (y >> 16) + (l >> 16);
    return (m << 16) | (l & 0xffff);
  }
  function rol(n: number, c: number): number {
    return (n << c) | (n >>> (32 - c));
  }
  function cmn(q: number, a: number, b: number, x: number, s: number, t: number): number {
    return ad(rol(ad(ad(a, q), ad(x, t)), s), b);
  }
  function ff(a: number, b: number, c: number, d: number, x: number, s: number, t: number): number {
    return cmn((b & c) | (~b & d), a, b, x, s, t);
  }
  function gg(a: number, b: number, c: number, d: number, x: number, s: number, t: number): number {
    return cmn((b & d) | (c & ~d), a, b, x, s, t);
  }
  function hh(a: number, b: number, c: number, d: number, x: number, s: number, t: number): number {
    return cmn(b ^ c ^ d, a, b, x, s, t);
  }
  function ii(a: number, b: number, c: number, d: number, x: number, s: number, t: number): number {
    return cmn(c ^ (b | ~d), a, b, x, s, t);
  }
  function sb(s: string): number[] {
    const nblk = ((s.length + 8) >> 6) + 1;
    const blks: number[] = new Array(nblk * 16).fill(0);
    let i: number;
    for (i = 0; i < s.length; i++) blks[i >> 2] = (blks[i >> 2] ?? 0) | (s.charCodeAt(i) << ((i % 4) * 8));
    blks[i >> 2] = (blks[i >> 2] ?? 0) | (0x80 << ((i % 4) * 8));
    blks[nblk * 16 - 2] = s.length * 8;
    return blks;
  }
  const x = sb(s);
  let a = 1732584193;
  let b = -271733879;
  let c = -1732584194;
  let d = 271733878;
  for (let i = 0; i < x.length; i += 16) {
    const oa = a,
      ob = b,
      oc = c,
      od = d;
    a = ff(a, b, c, d, x[i + 0] ?? 0, 7, -680876936);
    d = ff(d, a, b, c, x[i + 1] ?? 0, 12, -389564586);
    c = ff(c, d, a, b, x[i + 2] ?? 0, 17, 606105819);
    b = ff(b, c, d, a, x[i + 3] ?? 0, 22, -1044525330);
    a = ff(a, b, c, d, x[i + 4] ?? 0, 7, -176418897);
    d = ff(d, a, b, c, x[i + 5] ?? 0, 12, 1200080426);
    c = ff(c, d, a, b, x[i + 6] ?? 0, 17, -1473231341);
    b = ff(b, c, d, a, x[i + 7] ?? 0, 22, -45705983);
    a = ff(a, b, c, d, x[i + 8] ?? 0, 7, 1770035416);
    d = ff(d, a, b, c, x[i + 9] ?? 0, 12, -1958414417);
    c = ff(c, d, a, b, x[i + 10] ?? 0, 17, -42063);
    b = ff(b, c, d, a, x[i + 11] ?? 0, 22, -1990404162);
    a = ff(a, b, c, d, x[i + 12] ?? 0, 7, 1804603682);
    d = ff(d, a, b, c, x[i + 13] ?? 0, 12, -40341101);
    c = ff(c, d, a, b, x[i + 14] ?? 0, 17, -1502002290);
    b = ff(b, c, d, a, x[i + 15] ?? 0, 22, 1236535329);
    a = gg(a, b, c, d, x[i + 1] ?? 0, 5, -165796510);
    d = gg(d, a, b, c, x[i + 6] ?? 0, 9, -1069501632);
    c = gg(c, d, a, b, x[i + 11] ?? 0, 14, 643717713);
    b = gg(b, c, d, a, x[i + 0] ?? 0, 20, -373897302);
    a = gg(a, b, c, d, x[i + 5] ?? 0, 5, -701558691);
    d = gg(d, a, b, c, x[i + 10] ?? 0, 9, 38016083);
    c = gg(c, d, a, b, x[i + 15] ?? 0, 14, -660478335);
    b = gg(b, c, d, a, x[i + 4] ?? 0, 20, -405537848);
    a = gg(a, b, c, d, x[i + 9] ?? 0, 5, 568446438);
    d = gg(d, a, b, c, x[i + 14] ?? 0, 9, -1019803690);
    c = gg(c, d, a, b, x[i + 3] ?? 0, 14, -187363961);
    b = gg(b, c, d, a, x[i + 8] ?? 0, 20, 1163531501);
    a = gg(a, b, c, d, x[i + 13] ?? 0, 5, -1444681467);
    d = gg(d, a, b, c, x[i + 2] ?? 0, 9, -51403784);
    c = gg(c, d, a, b, x[i + 7] ?? 0, 14, 1735328473);
    b = gg(b, c, d, a, x[i + 12] ?? 0, 20, -1926607734);
    a = hh(a, b, c, d, x[i + 5] ?? 0, 4, -378558);
    d = hh(d, a, b, c, x[i + 8] ?? 0, 11, -2022574463);
    c = hh(c, d, a, b, x[i + 11] ?? 0, 16, 1839030562);
    b = hh(b, c, d, a, x[i + 14] ?? 0, 23, -35309556);
    a = hh(a, b, c, d, x[i + 1] ?? 0, 4, -1530992060);
    d = hh(d, a, b, c, x[i + 4] ?? 0, 11, 1272893353);
    c = hh(c, d, a, b, x[i + 7] ?? 0, 16, -155497632);
    b = hh(b, c, d, a, x[i + 10] ?? 0, 23, -1094730640);
    a = hh(a, b, c, d, x[i + 13] ?? 0, 4, 681279174);
    d = hh(d, a, b, c, x[i + 0] ?? 0, 11, -358537222);
    c = hh(c, d, a, b, x[i + 3] ?? 0, 16, -722521979);
    b = hh(b, c, d, a, x[i + 6] ?? 0, 23, 76029189);
    a = hh(a, b, c, d, x[i + 9] ?? 0, 4, -640364487);
    d = hh(d, a, b, c, x[i + 12] ?? 0, 11, -421815835);
    c = hh(c, d, a, b, x[i + 15] ?? 0, 16, 530742520);
    b = hh(b, c, d, a, x[i + 2] ?? 0, 23, -995338651);
    a = ii(a, b, c, d, x[i + 0] ?? 0, 6, -198630844);
    d = ii(d, a, b, c, x[i + 7] ?? 0, 10, 1126891415);
    c = ii(c, d, a, b, x[i + 14] ?? 0, 15, -1416354905);
    b = ii(b, c, d, a, x[i + 5] ?? 0, 21, -57434055);
    a = ii(a, b, c, d, x[i + 12] ?? 0, 6, 1700485571);
    d = ii(d, a, b, c, x[i + 3] ?? 0, 10, -1894986606);
    c = ii(c, d, a, b, x[i + 10] ?? 0, 15, -1051523);
    b = ii(b, c, d, a, x[i + 1] ?? 0, 21, -2054922799);
    a = ii(a, b, c, d, x[i + 8] ?? 0, 6, 1873313359);
    d = ii(d, a, b, c, x[i + 15] ?? 0, 10, -30611744);
    c = ii(c, d, a, b, x[i + 6] ?? 0, 15, -1560198380);
    b = ii(b, c, d, a, x[i + 13] ?? 0, 21, 1309151649);
    a = ii(a, b, c, d, x[i + 4] ?? 0, 6, -145523070);
    d = ii(d, a, b, c, x[i + 11] ?? 0, 10, -1120210379);
    c = ii(c, d, a, b, x[i + 2] ?? 0, 15, 718787259);
    b = ii(b, c, d, a, x[i + 9] ?? 0, 21, -343485551);
    a = ad(a, oa);
    b = ad(b, ob);
    c = ad(c, oc);
    d = ad(d, od);
  }
  return rh(a) + rh(b) + rh(c) + rh(d);
}

// ─── JWT ─────────────────────────────────────────────────────────────

export type JwtParts = {
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
  signature: string;
  signatureValid?: boolean;
  raw: { header: string; payload: string; signature: string };
};

export function decodeJwt(token: string): { ok: true; parts: JwtParts } | { ok: false; error: string } {
  const parts = token.trim().split(".");
  if (parts.length !== 3) return { ok: false, error: "JWT must have 3 parts (header.payload.signature)" };
  try {
    const decode = (s: string) => {
      const padded = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
      const json = atob(padded);
      return JSON.parse(decodeURIComponent(escape(json)));
    };
    return {
      ok: true,
      parts: {
        header: decode(parts[0]!),
        payload: decode(parts[1]!),
        signature: parts[2]!,
        raw: { header: parts[0]!, payload: parts[1]!, signature: parts[2]! },
      },
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ─── UUID / Key gen ──────────────────────────────────────────────────

export function uuidV4(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const h = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function uuidV7(): string {
  const ts = Date.now();
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  // 48-bit unix ts in ms
  bytes[0] = (ts / 2 ** 40) & 0xff;
  bytes[1] = (ts / 2 ** 32) & 0xff;
  bytes[2] = (ts / 2 ** 24) & 0xff;
  bytes[3] = (ts / 2 ** 16) & 0xff;
  bytes[4] = (ts / 2 ** 8) & 0xff;
  bytes[5] = ts & 0xff;
  // version + variant
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x70;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const h = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function uuidV1(): string {
  // Simplified time + clock-seq UUID v1
  const ts = Date.now();
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  const hexTs = (ts * 10000 + 122192928000000000).toString(16).padStart(16, "0");
  for (let i = 0; i < 8; i++) bytes[i] = parseInt(hexTs.slice(i * 2, i * 2 + 2), 16);
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x10;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const h = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function nanoId(size = 21): string {
  const alphabet = "useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict";
  let id = "";
  const bytes = new Uint8Array(size);
  globalThis.crypto.getRandomValues(bytes);
  for (let i = 0; i < size; i++) id += alphabet[bytes[i]! % alphabet.length];
  return id;
}

export function randomPassword(
  length = 20,
  options: { upper?: boolean; lower?: boolean; digits?: boolean; symbols?: boolean } = {},
): string {
  const opts = { upper: true, lower: true, digits: true, symbols: true, ...options };
  const sets: string[] = [];
  if (opts.upper) sets.push("ABCDEFGHJKLMNPQRSTUVWXYZ");
  if (opts.lower) sets.push("abcdefghijkmnopqrstuvwxyz");
  if (opts.digits) sets.push("23456789");
  if (opts.symbols) sets.push("!@#$%^&*-_=+");
  const pool = sets.join("");
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < length; i++) out += pool[bytes[i]! % pool.length];
  return out;
}

// ─── Color conversion ───────────────────────────────────────────────

export type ColorRgb = { r: number; g: number; b: number };
export type ColorHsl = { h: number; s: number; l: number };
export type ColorHsv = { h: number; s: number; v: number };
export type ColorCmyk = { c: number; m: number; y: number; k: number };

export function parseHex(input: string): ColorRgb | null {
  const s = input.trim().replace(/^#/, "");
  if (!/^([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(s)) return null;
  const full =
    s.length === 3
      ? s
          .split("")
          .map((c) => c + c)
          .join("")
      : s.slice(0, 6);
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

export function rgbToHex({ r, g, b }: ColorRgb): string {
  return "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
}

export function rgbToHsl({ r, g, b }: ColorRgb): ColorHsl {
  const R = r / 255,
    G = g / 255,
    B = b / 255;
  const max = Math.max(R, G, B),
    min = Math.min(R, G, B);
  const l = (max + min) / 2;
  let h = 0,
    s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case R:
        h = (G - B) / d + (G < B ? 6 : 0);
        break;
      case G:
        h = (B - R) / d + 2;
        break;
      case B:
        h = (R - G) / d + 4;
        break;
    }
    h *= 60;
  }
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}

export function hslToRgb({ h, s, l }: ColorHsl): ColorRgb {
  const H = (((h % 360) + 360) % 360) / 360;
  const S = s / 100,
    L = l / 100;
  if (S === 0) {
    const v = Math.round(L * 255);
    return { r: v, g: v, b: v };
  }
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = L < 0.5 ? L * (1 + S) : L + S - L * S;
  const p = 2 * L - q;
  return {
    r: Math.round(hue2rgb(p, q, H + 1 / 3) * 255),
    g: Math.round(hue2rgb(p, q, H) * 255),
    b: Math.round(hue2rgb(p, q, H - 1 / 3) * 255),
  };
}

export function rgbToHsv({ r, g, b }: ColorRgb): ColorHsv {
  const R = r / 255,
    G = g / 255,
    B = b / 255;
  const max = Math.max(R, G, B),
    min = Math.min(R, G, B);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    switch (max) {
      case R:
        h = (G - B) / d + (G < B ? 6 : 0);
        break;
      case G:
        h = (B - R) / d + 2;
        break;
      case B:
        h = (R - G) / d + 4;
        break;
    }
    h *= 60;
  }
  const s = max === 0 ? 0 : d / max;
  return { h: Math.round(h), s: Math.round(s * 100), v: Math.round(max * 100) };
}

export function rgbToCmyk({ r, g, b }: ColorRgb): ColorCmyk {
  const R = r / 255,
    G = g / 255,
    B = b / 255;
  const k = 1 - Math.max(R, G, B);
  if (k === 1) return { c: 0, m: 0, y: 0, k: 100 };
  return {
    c: Math.round(((1 - R - k) / (1 - k)) * 100),
    m: Math.round(((1 - G - k) / (1 - k)) * 100),
    y: Math.round(((1 - B - k) / (1 - k)) * 100),
    k: Math.round(k * 100),
  };
}

// ─── Number base ────────────────────────────────────────────────────

export function convertBase(
  input: string,
  from: number,
  to: number,
): { ok: true; output: string } | { ok: false; error: string } {
  try {
    const n = parseInt(input.trim(), from);
    if (isNaN(n)) return { ok: false, error: "Invalid input" };
    return { ok: true, output: n.toString(to).toUpperCase() };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ─── Cron ───────────────────────────────────────────────────────────

export type CronField = { values: number[]; raw: string };
export type CronParse = { ok: true; nextRuns: Date[]; description: string } | { ok: false; error: string };

export function parseCron(expr: string, count = 5): CronParse {
  try {
    const parts = expr.trim().split(/\s+/);
    if (parts.length !== 5)
      return { ok: false, error: "Cron expression must have 5 fields (minute hour dom mon dow)" };
    const [minute, hour, dom, mon, dow] = parts;
    const m = parseField(minute!, 0, 59);
    const h = parseField(hour!, 0, 23);
    const d = parseField(dom!, 1, 31);
    const mo = parseField(mon!, 1, 12);
    const w = parseField(dow!, 0, 6);
    const next: Date[] = [];
    const start = new Date();
    start.setSeconds(0, 0);
    for (let i = 0; i < 366 * 24 * 60 && next.length < count; i++) {
      const candidate = new Date(start.getTime() + i * 60_000);
      if (!m.values.includes(candidate.getMinutes())) continue;
      if (!h.values.includes(candidate.getHours())) continue;
      if (!mo.values.includes(candidate.getMonth() + 1)) continue;
      if (!d.values.includes(candidate.getDate())) continue;
      if (!w.values.includes(candidate.getDay())) continue;
      next.push(candidate);
    }
    return {
      ok: true,
      nextRuns: next,
      description: describeCron({ minute: m, hour: h, dom: d, mon: mo, dow: w }),
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

function parseField(spec: string, min: number, max: number): CronField {
  const values = new Set<number>();
  for (const part of spec.split(",")) {
    const [range, stepStr] = part.split("/") as [string, string | undefined];
    const step = stepStr ? Number(stepStr) || 1 : 1;
    let lo = min;
    let hi = max;
    if (range === "*") {
      // all
    } else if (range.includes("-")) {
      const [a, b] = range.split("-").map((v) => Number(v));
      if (a === undefined || b === undefined) throw new Error(`bad range: ${range}`);
      lo = a;
      hi = b;
    } else {
      const n = Number(range);
      if (isNaN(n)) throw new Error(`bad value: ${range}`);
      lo = n;
      hi = stepStr ? max : n;
    }
    for (let v = lo; v <= hi; v += step) values.add(v);
  }
  return { values: [...values].sort((a, b) => a - b), raw: spec };
}

function describeCron(f: {
  minute: CronField;
  hour: CronField;
  dom: CronField;
  mon: CronField;
  dow: CronField;
}): string {
  const fld = (x: CronField, names?: string[]) => {
    if (x.raw === "*") return "every";
    if (x.values.length === 1) return `at ${names ? (names[x.values[0]! - 1] ?? x.values[0]) : x.values[0]}`;
    return x.values.join(", ");
  };
  return `minute: ${fld(f.minute)}; hour: ${fld(f.hour)}; day-of-month: ${fld(f.dom)}; month: ${fld(f.mon, ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"])}; day-of-week: ${fld(f.dow, ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"])}`;
}

// ─── Regex ──────────────────────────────────────────────────────────

export type RegexMatch = { match: string; index: number; length: number; groups: Record<string, string> };

export function testRegex(
  pattern: string,
  flags: string,
  text: string,
): { ok: true; matches: RegexMatch[] } | { ok: false; error: string } {
  try {
    const re = new RegExp(pattern, flags);
    const matches: RegexMatch[] = [];
    if (!re.global) {
      const m = re.exec(text);
      if (m) matches.push(buildMatch(m));
    } else {
      let m: RegExpExecArray | null;
      while ((m = re.exec(text)) !== null) {
        matches.push(buildMatch(m));
        if (m[0] === "") re.lastIndex++;
      }
    }
    return { ok: true, matches };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

function buildMatch(m: RegExpExecArray): RegexMatch {
  const groups: Record<string, string> = {};
  if (m.groups) {
    for (const [k, v] of Object.entries(m.groups)) {
      if (v !== undefined) groups[k] = v;
    }
  }
  for (let i = 1; i < m.length; i++) {
    const v = m[i];
    if (v !== undefined) groups[`$${i}`] = v;
  }
  return { match: m[0], index: m.index, length: m[0].length, groups };
}

// ─── Diff (line-based LCS) ──────────────────────────────────────────

export type DiffLine = { left?: string; right?: string; kind: "same" | "added" | "removed" | "changed" };

export function diffLines(a: string, b: string): DiffLine[] {
  const A = a.split("\n");
  const B = b.split("\n");
  const n = A.length;
  const m = B.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      if (A[i] === B[j]) dp[i]![j] = (dp[i + 1]![j + 1] ?? 0) + 1;
      else dp[i]![j] = Math.max(dp[i + 1]![j] ?? 0, dp[i]![j + 1] ?? 0);
    }
  }
  const out: DiffLine[] = [];
  let i = 0,
    j = 0;
  while (i < n && j < m) {
    if (A[i] === B[j]) {
      out.push({ left: A[i], right: B[j], kind: "same" });
      i++;
      j++;
    } else if ((dp[i + 1]?.[j] ?? 0) >= (dp[i]?.[j + 1] ?? 0)) {
      out.push({ left: A[i], kind: "removed" });
      i++;
    } else {
      out.push({ right: B[j], kind: "added" });
      j++;
    }
  }
  while (i < n) {
    out.push({ left: A[i], kind: "removed" });
    i++;
  }
  while (j < m) {
    out.push({ right: B[j], kind: "added" });
    j++;
  }
  return out;
}

// ─── Lorem ipsum ────────────────────────────────────────────────────

const LOREM_WORDS =
  "lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua ut enim ad minim veniam quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt in culpa qui officia deserunt mollit anim id est laborum".split(
    " ",
  );

export function loremWords(n: number): string {
  const out: string[] = [];
  for (let i = 0; i < n; i++) out.push(LOREM_WORDS[i % LOREM_WORDS.length]!);
  return out.join(" ");
}

export function loremParagraphs(n: number): string {
  const paragraphs: string[] = [];
  for (let i = 0; i < n; i++) {
    const sentences: string[] = [];
    const sentenceCount = 4 + Math.floor(Math.random() * 4);
    for (let s = 0; s < sentenceCount; s++) {
      const words = 6 + Math.floor(Math.random() * 12);
      const wordsArr: string[] = [];
      for (let w = 0; w < words; w++) {
        wordsArr.push(LOREM_WORDS[Math.floor(Math.random() * LOREM_WORDS.length)]!);
      }
      wordsArr[0] = (wordsArr[0] ?? "lorem").charAt(0).toUpperCase() + (wordsArr[0] ?? "lorem").slice(1);
      sentences.push(wordsArr.join(" ") + ".");
    }
    paragraphs.push(sentences.join(" "));
  }
  return paragraphs.join("\n\n");
}

// ─── QR code ────────────────────────────────────────────────────────

export async function generateQrCodeDataUrl(text: string, size = 256): Promise<string> {
  return QRCode.toDataURL(text, { width: size, margin: 1, color: { dark: "#0a0a0a", light: "#ffffff" } });
}
