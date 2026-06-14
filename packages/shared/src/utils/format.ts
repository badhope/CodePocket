/* ─── JSON ──────────────────────────────────────────────────────── */

export type JsonNode = {
  key: string;
  path: string;
  kind: "object" | "array" | "string" | "number" | "boolean" | "null";
  value?: unknown;
  children?: JsonNode[];
};

export function formatJson(
  input: string,
  indent = 2,
): { ok: true; output: string } | { ok: false; error: string } {
  try {
    return { ok: true, output: JSON.stringify(JSON.parse(input), null, indent) };
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

/* ─── CSS ──────────────────────────────────────────────────────── */

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

/* ─── HTML ─────────────────────────────────────────────────────── */

const HTML_INLINE = new Set([
  "a",
  "b",
  "i",
  "em",
  "strong",
  "span",
  "code",
  "br",
  "img",
  "input",
  "label",
  "small",
  "sub",
  "sup",
]);

export function formatHtml(input: string): string {
  const stripped = input.replace(/\s+/g, " ").trim();
  const tokens = stripped.match(/<!--[\s\S]*?-->|<\/?[a-zA-Z][^>]*>|[^<]+/g) ?? [];
  const out: string[] = [];
  let depth = 0;
  for (const tok of tokens) {
    if (tok.startsWith("<!--")) {
      out.push(" ".repeat(depth * 2) + tok);
      continue;
    }
    if (tok.startsWith("</")) {
      depth = Math.max(0, depth - 1);
      out.push(" ".repeat(depth * 2) + tok);
      continue;
    }
    if (tok.startsWith("<")) {
      const tag = tok.match(/^<([a-zA-Z][a-zA-Z0-9]*)/)?.[1]?.toLowerCase() ?? "";
      out.push(" ".repeat(depth * 2) + tok);
      if (!tok.endsWith("/>") && !HTML_INLINE.has(tag)) depth++;
      continue;
    }
    out.push(" ".repeat(depth * 2) + tok);
  }
  return out.join("\n");
}

export function minifyHtml(input: string): string {
  return input
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\s+/g, " ")
    .replace(/>\s+</g, "><")
    .trim();
}

/* ─── SQL / XML ────────────────────────────────────────────────── */

export function formatSql(input: string): string {
  return input
    .replace(/\s+/g, " ")
    .replace(
      /\b(SELECT|FROM|WHERE|GROUP BY|ORDER BY|LIMIT|OFFSET|JOIN|LEFT JOIN|RIGHT JOIN|INNER JOIN|ON|AND|OR|UNION|INSERT INTO|VALUES|UPDATE|SET|DELETE FROM|CREATE TABLE|DROP TABLE|ALTER TABLE|PRIMARY KEY|FOREIGN KEY|NOT NULL|DEFAULT|UNIQUE|INDEX)\b/gi,
      "\n$1",
    )
    .replace(/^\s+/, "")
    .replace(/;\s*$/, ";")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const major = /^(SELECT|FROM|WHERE|GROUP BY|ORDER BY|LIMIT|UNION)/i.test(line);
      return major ? "\n" + line : "  " + line;
    })
    .join("\n")
    .trim();
}

export function formatXml(input: string): string {
  const stripped = input.replace(/>\s+</g, "><").trim();
  const tokens = stripped.match(/<\?[\s\S]*?\?>|<!--[\s\S]*?-->|<\/?[a-zA-Z][^>]*>|[^<]+/g) ?? [];
  const out: string[] = [];
  let depth = 0;
  for (const tok of tokens) {
    if (tok.startsWith("<?")) {
      out.push(tok);
      continue;
    }
    if (tok.startsWith("<!--")) {
      out.push(" ".repeat(depth * 2) + tok);
      continue;
    }
    if (tok.startsWith("</")) {
      depth = Math.max(0, depth - 1);
      out.push(" ".repeat(depth * 2) + tok);
      continue;
    }
    if (tok.startsWith("<")) {
      out.push(" ".repeat(depth * 2) + tok);
      if (!tok.endsWith("/>") && !/^<(br|hr|img|input|meta|link)\b/i.test(tok)) depth++;
      continue;
    }
    if (tok.trim()) out.push(" ".repeat(depth * 2) + tok.trim());
  }
  return out.join("\n");
}

/* ─── 通用：缩进风格 ──────────────────────────────────────────── */

function simplePretty(
  input: string,
  openTok: string,
  _closeTok: string,
  cStart: string,
  cEnd: string,
): string {
  // 先去掉注释（粗略）
  const noComments = input.replace(new RegExp(`${escapeRe(cStart)}[\\s\\S]*?${escapeRe(cEnd)}`, "g"), "");
  // 在 { / } / ; 前后补换行
  const lines = noComments
    .split(/\n/)
    .flatMap((line) => {
      const out: string[] = [];
      let cur = "";
      for (const ch of line) {
        cur += ch;
        if (ch === openTok[0] || ch === ";" || ch === "}") {
          out.push(cur);
          cur = "";
        }
      }
      if (cur.trim()) out.push(cur);
      return out;
    })
    .map((s) => s.trim())
    .filter(Boolean);
  let depth = 0;
  return lines
    .map((line) => {
      const isClose = line.startsWith("}");
      if (isClose) depth = Math.max(0, depth - 1);
      const r = "  ".repeat(depth) + line;
      if (!isClose && line.endsWith(openTok)) depth++;
      return r;
    })
    .join("\n");
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
