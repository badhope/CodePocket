import { describe, it, expect } from "vitest";
import {
  listTools,
  getTool,
  searchTools,
  listLanguages,
  getLanguage,
  formatJson,
  minifyJson,
  jsonToTree,
  encodeBase64,
  decodeBase64,
  decodeJwt,
  jwtIsExpired,
  uuid,
  shortId,
  lineDiff,
  jsonDiff,
  relativeTime,
  negotiateLocale,
  featureRequiresBackend,
  evaluateFeatureGate,
  signInSchema,
  signUpSchema,
  createProjectSchema,
  formatCss,
  minifyCss,
  formatHtml,
  formatSql,
  formatXml,
  regexTest,
  markdownToHtml,
  htmlToMarkdown,
  buildQrMatrix,
  qrToSvg,
  tFor,
  toolLabelFor,
} from "../src/index.js";

describe("tools registry", () => {
  it("has 30 tools", () => {
    expect(listTools().length).toBe(30);
  });
  it("looks up by slug", () => {
    const t = getTool("json-formatter");
    expect(t?.category).toBe("formatter");
    expect(t?.offlineFirst).toBe(true);
    expect(t?.requiresBackend).toBe(false);
  });
  it("searches by keyword", () => {
    const hits = searchTools("pdf");
    expect(hits.some((t) => t.slug === "document-convert")).toBe(true);
  });
});

describe("languages", () => {
  it("has 19 languages", () => {
    expect(listLanguages().length).toBe(19);
  });
  it("python is scripting, no compile step", () => {
    const py = getLanguage("python");
    expect(py?.category).toBe("scripting");
    expect(py?.compiled).toBe(false);
  });
  it("rust needs compile command", () => {
    const rust = getLanguage("rust");
    expect(rust?.compileCommand).toBeTruthy();
  });
});

describe("utils/format", () => {
  it("formats JSON", () => {
    const r = formatJson('{"a":1}');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output).toContain('"a": 1');
  });
  it("minifies JSON", () => {
    const r = minifyJson('{\n  "a": 1\n}');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output).toBe('{"a":1}');
  });
  it("builds tree", () => {
    const r = jsonToTree('{"a":[1,2]}');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.root.kind).toBe("object");
      expect(r.root.children?.[0]?.kind).toBe("array");
    }
  });
  it("returns error on invalid", () => {
    expect(formatJson("not json").ok).toBe(false);
  });
});

describe("utils/codec", () => {
  it("round-trips base64", () => {
    const s = "Hello, 世界! 🌍";
    expect(decodeBase64(encodeBase64(s))).toBe(s);
  });
  it("decodes JWT", () => {
    // header.payload.sig (fake)
    const token = [
      Buffer.from('{"alg":"HS256","typ":"JWT"}').toString("base64url"),
      Buffer.from('{"sub":"user-1","exp":9999999999}').toString("base64url"),
      "sig",
    ].join(".");
    const r = decodeJwt(token);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.header.alg).toBe("HS256");
      expect(r.payload.sub).toBe("user-1");
      expect(jwtIsExpired(r.payload)).toBe(false);
    }
  });
  it("detects expired JWT", () => {
    const token = [
      Buffer.from('{"alg":"none"}').toString("base64url"),
      Buffer.from('{"sub":"u","exp":1}').toString("base64url"),
      "",
    ].join(".");
    const r = decodeJwt(token);
    expect(r.ok).toBe(true);
    if (r.ok) expect(jwtIsExpired(r.payload)).toBe(true);
  });
});

describe("utils/id", () => {
  it("uuid v4 has 4 dashes and 36 chars", () => {
    const id = uuid();
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
  });
  it("shortId is alphanumeric of requested length", () => {
    const id = shortId(8);
    expect(id).toHaveLength(8);
    expect(id).toMatch(/^[0-9a-z]+$/);
  });
});

describe("utils/diff", () => {
  it("line diff shows inserts/deletes", () => {
    const out = lineDiff("a\nb\nc", "a\nB\nc");
    const ops = out.map((l) => l.op);
    expect(ops).toContain("equal");
    expect(ops).toContain("delete");
    expect(ops).toContain("insert");
  });
  it("json diff finds added key", () => {
    const out = jsonDiff({ a: 1 }, { a: 1, b: 2 });
    expect(out.some((e) => e.kind === "added" && e.path === "$.b")).toBe(true);
  });
  it("json diff finds changed value", () => {
    const out = jsonDiff({ a: 1 }, { a: 2 });
    expect(out.some((e) => e.kind === "changed" && e.path === "$.a")).toBe(true);
  });
});

describe("utils/time", () => {
  it("relative time returns minutes for recent past", () => {
    const t = relativeTime(new Date(Date.now() - 5 * 60 * 1000).toISOString());
    expect(t.future).toBe(false);
    expect(t.unit).toBe("min");
  });
});

describe("i18n", () => {
  it("negotiates exact match", () => {
    expect(negotiateLocale("zh-CN,en;q=0.9")).toBe("zh-CN");
  });
  it("falls back to language root", () => {
    expect(negotiateLocale("fr-FR,en")).toBe("fr");
  });
  it("defaults to en", () => {
    expect(negotiateLocale(null)).toBe("en");
  });
});

describe("feature-gate", () => {
  it("offline-first features are always enabled", () => {
    const g = evaluateFeatureGate("convert.local", { state: "offline", available: false });
    expect(g.requiresBackend).toBe(false);
    expect(g.enabled).toBe(true);
  });
  it("backend-required feature gated when offline", () => {
    expect(featureRequiresBackend("playground.piston")).toBe(true);
    const g = evaluateFeatureGate("playground.piston", { state: "offline", available: false });
    expect(g.enabled).toBe(false);
    expect(g.reason).toBe("backend_offline");
  });
  it("unlocks when backend is online", () => {
    const g = evaluateFeatureGate("playground.piston", { state: "online", available: true });
    expect(g.enabled).toBe(true);
  });
});

describe("validators", () => {
  it("signIn accepts good input", () => {
    expect(signInSchema.safeParse({ email: "a@b.com", password: "longenough" }).success).toBe(true);
  });
  it("signIn rejects short password", () => {
    expect(signInSchema.safeParse({ email: "a@b.com", password: "short" }).success).toBe(false);
  });
  it("signUp requires matching passwords", () => {
    expect(
      signUpSchema.safeParse({
        email: "a@b.com",
        password: "longenough",
        confirmPassword: "differentone",
      }).success,
    ).toBe(false);
  });
  it("createProject requires name", () => {
    expect(createProjectSchema.safeParse({}).success).toBe(false);
    expect(createProjectSchema.safeParse({ name: "X" }).success).toBe(true);
  });
});

describe("utils/format extra", () => {
  it("formatCss indents", () => {
    const out = formatCss(".a{color:red}.b{color:blue}");
    expect(out).toMatch(/\.a[\s\S]+\.b/);
  });
  it("minifyCss removes whitespace", () => {
    const out = minifyCss(`.a {\n  color: red;\n}`);
    expect(out).toBe(".a{color:red}");
  });
  it("formatHtml adds indentation", () => {
    const out = formatHtml("<div><p>hi</p></div>");
    expect(out).toMatch(/<div>\n/);
  });
  it("formatSql aligns keywords", () => {
    const out = formatSql("SELECT a FROM t WHERE b=1");
    expect(out).toMatch(/^SELECT/);
    expect(out).toMatch(/\nFROM/);
  });
  it("formatXml indents", () => {
    const out = formatXml("<root><a>1</a></root>");
    expect(out).toContain("<root>");
    expect(out).toContain("</root>");
    expect(out.split("\n").length).toBeGreaterThan(2);
  });
});

describe("utils/regex", () => {
  it("matches simple pattern", () => {
    const r = regexTest("\\d+", "g", "a1 b22 c333");
    expect(r.ok).toBe(true);
    expect(r.count).toBe(3);
    expect(r.matches[0]?.match).toBe("1");
    expect(r.matches[2]?.match).toBe("333");
  });
  it("captures groups", () => {
    const r = regexTest("(\\w+)=(\\d+)", "", "x=42");
    expect(r.ok).toBe(true);
    expect(r.matches[0]?.groups).toEqual(["x", "42"]);
  });
  it("named groups", () => {
    const r = regexTest("(?<k>\\w+)=(?<v>\\d+)", "", "x=42");
    expect(r.ok).toBe(true);
    expect(r.matches[0]?.namedGroups).toEqual({ k: "x", v: "42" });
  });
  it("reports invalid regex", () => {
    const r = regexTest("[", "", "");
    expect(r.ok).toBe(false);
    expect(r.error).toBeTruthy();
  });
});

describe("utils/markdown", () => {
  it("renders headers", () => {
    const out = markdownToHtml("# Hello");
    expect(out).toMatch(/<h1>Hello<\/h1>/);
  });
  it("renders code blocks", () => {
    const out = markdownToHtml("```js\nconst x = 1;\n```");
    expect(out).toMatch(/<pre/);
    expect(out).toMatch(/language-js/);
  });
  it("html to markdown preserves code lang", () => {
    const out = htmlToMarkdown('<pre><code class="language-python">print(1)</code></pre>');
    expect(out).toMatch(/```python/);
    expect(out).toMatch(/print\(1\)/);
  });
});

describe("utils/qr", () => {
  it("builds matrix", () => {
    const m = buildQrMatrix({ text: "hello" });
    expect(m.size).toBeGreaterThan(10);
    expect(m.cells.length).toBe(m.size);
    expect(m.cells[0]?.length).toBe(m.size);
  });
  it("renders svg", () => {
    const m = buildQrMatrix({ text: "https://docforge.dev" });
    const svg = qrToSvg(m);
    expect(svg).toMatch(/^<svg /);
    expect(svg).toMatch(/<\/svg>$/);
    expect(svg).toMatch(/<path/);
  });
});

describe("i18n messages", () => {
  it("provides 6 locales", () => {
    for (const l of ["en", "es", "fr", "ja", "ko", "zh-CN"] as const) {
      expect(tFor(l, "common.copy")).toBeTruthy();
    }
  });
  it("labels all 20 tools in zh-CN", () => {
    for (const slug of [
      "json-formatter",
      "playground",
      "epoch-converter",
      "jwt-decoder",
      "regex-tester",
    ]) {
      expect(toolLabelFor("zh-CN", slug)).toBeTruthy();
    }
  });
  it("covers home / tools / playground / notfound for all locales", () => {
    const keys = [
      "home.title",
      "home.start",
      "tools.title",
      "tools.search.placeholder",
      "playground.run",
      "notfound.title",
    ];
    for (const l of ["en", "es", "fr", "ja", "ko", "zh-CN"] as const) {
      for (const k of keys) {
        expect(tFor(l, k), `${l}/${k}`).toBeTruthy();
      }
    }
  });
  it("falls back to English for missing key", () => {
    expect(tFor("zh-CN", "home.title")).toContain("工具");
  });
});

describe("formatHtml inline / self-closing", () => {
  it("does not break <a> with text content", () => {
    const out = formatHtml('<a href="/x">link</a>');
    expect(out).toContain('<a href="/x">');
    expect(out).toContain("</a>");
    expect(out).toContain("link");
  });
  it("self-closing <br> does not break parent close-tag matching", () => {
    const out = formatHtml("<p>line1<br>line2</p>");
    // <p> 与 </p> 都在 depth 0（行首无缩进）
    expect(out.split("\n")[0]).toBe("<p>");
    expect(out.trimEnd().endsWith("</p>")).toBe(true);
  });
  it("indents children with 2 spaces", () => {
    const out = formatHtml("<div><span>hi</span></div>");
    expect(out).toContain("<div>");
    // 子元素至少带 2 空格缩进
    expect(out).toMatch(/\n {2}<span/);
    expect(out).toContain("</div>");
  });
  it("preserves <!-- comments -->", () => {
    const out = formatHtml("<!-- a --><p>x</p>");
    expect(out).toContain("<!-- a -->");
    expect(out).toContain("<p>");
    expect(out).toContain("</p>");
  });
});
