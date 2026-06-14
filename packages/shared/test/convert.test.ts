/**
 * convert/ — 9 种格式对 + engine 调度 + 后端 fallback。
 * 端到端：纯函数转换走真库（marked / turndown / fast-xml-parser / pdf-lib）。
 */
import { describe, it, expect } from "vitest";
import {
  mdToHtml,
  htmlToMd,
  mdToTxt,
  txtToMd,
  htmlToJson,
  jsonToHtml,
  jsonToXml,
  xmlToJson,
  htmlToPdf,
  convert,
  listSupportedPairs,
  findPair,
  FORMAT_MIME,
  CONVERSION_PAIRS,
  type ConvertResult,
} from "../src/convert/index.js";

describe("convert/formats", () => {
  it("exposes 9 local + 2 backend pairs", () => {
    expect(CONVERSION_PAIRS.length).toBe(11);
    const local = CONVERSION_PAIRS.filter((p) => p.local);
    const backend = CONVERSION_PAIRS.filter((p) => !p.local);
    expect(local.length).toBe(9);
    expect(backend.length).toBe(2);
  });
  it("findPair returns the right metadata", () => {
    const p = findPair("md", "html");
    expect(p?.hint).toBe("marked");
    expect(p?.local).toBe(true);
  });
  it("FORMAT_MIME has all 8 formats", () => {
    expect(Object.keys(FORMAT_MIME).sort()).toEqual(
      ["docx", "html", "json", "md", "pdf", "txt", "xlsx", "xml"].sort(),
    );
  });
  it("listSupportedPairs includes pdf (html→pdf)", () => {
    const pairs = listSupportedPairs();
    expect(pairs.find((p) => p.from === "html" && p.to === "pdf")).toBeDefined();
  });
});

describe("convert/converter — 1. MD → HTML", () => {
  it("renders headings, bold, code", () => {
    const html = mdToHtml("# Title\n\n**bold** and `code`");
    expect(html).toMatch(/<h1[^>]*>Title<\/h1>/);
    expect(html).toMatch(/<strong>bold<\/strong>/);
    expect(html).toMatch(/<code>code<\/code>/);
  });
});

describe("convert/converter — 2. HTML → MD", () => {
  it("strips tags", () => {
    const md = htmlToMd("<h1>Hi</h1><p>a <strong>b</strong></p>");
    expect(md).toMatch(/Hi/);
    expect(md).toMatch(/\*\*b\*\*/);
  });
});

describe("convert/converter — 3. MD → TXT", () => {
  it("strips markdown markers", () => {
    const txt = mdToTxt("# Title\n\n**bold** [link](https://x.com)");
    expect(txt).not.toMatch(/^#/m);
    expect(txt).not.toMatch(/\*\*/);
    expect(txt).toMatch(/Title/);
    expect(txt).toMatch(/bold/);
    expect(txt).toMatch(/link/); // 链接 text 保留
    expect(txt).not.toMatch(/https/);
  });
});

describe("convert/converter — 4. TXT → MD", () => {
  it("joins paragraphs with blank line", () => {
    const md = txtToMd("a\n\nb");
    expect(md).toBe("a\n\nb");
  });
  it("filters empty segments", () => {
    const md = txtToMd("  \n\n  \n\nhi");
    expect(md).toBe("hi");
  });
});

describe("convert/converter — 5. HTML → JSON", () => {
  it("produces a node tree", () => {
    const tree = JSON.parse(htmlToJson("<p>hello <strong>world</strong></p>"));
    const render = (n: { tag?: string; text?: string; children?: unknown[] }): string => {
      if (n.text != null) return n.text;
      const inner = (n.children ?? []).map((c) => render(c as typeof n)).join("");
      return n.tag ? `<${n.tag}>${inner}</${n.tag}>` : inner;
    };
    expect(render(tree.root[0])).toMatch(/<p>hello <strong>world<\/strong><\/p>/);
  });
});

describe("convert/converter — 6. JSON → HTML", () => {
  it("escapes text and emits tags", () => {
    const html = jsonToHtml('{"root":[{"tag":"p","children":[{"text":"<x>"}]}]}');
    expect(html).toBe("<p>&lt;x&gt;</p>");
  });
});

describe("convert/converter — 7. JSON → XML", () => {
  it("emits an xml root", () => {
    const xml = jsonToXml('{"a":{"@_id":"1","b":2}}');
    expect(xml).toMatch(/<a id="1">/);
    expect(xml).toMatch(/<b>2<\/b>/);
  });
});

describe("convert/converter — 8. XML → JSON", () => {
  it("parses a root", () => {
    const json = xmlToJson("<a id=\"1\"><b>2</b></a>");
    const data = JSON.parse(json) as { a: { "@_id": string; b: number | string } };
    expect(data.a["@_id"]).toBe("1");
    // fast-xml-parser 默认识别数字字面量；改用 numberValue
    expect(String(data.a.b)).toBe("2");
  });
});

describe("convert/converter — 9. HTML → PDF", () => {
  it("produces a non-empty PDF buffer", async () => {
    const out = await htmlToPdf("<h1>Hi</h1><p>line one<br>line two</p>");
    expect(out).toBeInstanceOf(Uint8Array);
    expect(out.byteLength).toBeGreaterThan(500);
    // PDF magic number
    const head = String.fromCharCode(...out.slice(0, 4));
    expect(head).toBe("%PDF");
  });
});

describe("convert/engine", () => {
  it("dispatches md→html and returns text", async () => {
    const r: ConvertResult = await convert("# hi", "md", "html");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(typeof r.output).toBe("string");
      expect(r.output as string).toMatch(/<h1[^>]*>hi<\/h1>/);
      expect(r.mime).toBe("text/html");
    }
  });
  it("dispatches html→pdf and returns Uint8Array", async () => {
    const r: ConvertResult = await convert("<p>hi</p>", "html", "pdf");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.output).toBeInstanceOf(Uint8Array);
      expect(r.mime).toBe("application/pdf");
    }
  });
  it("rejects unsupported pair", async () => {
    const r = await convert("x", "pdf", "json");
    expect(r.ok).toBe(false);
  });
  it("invokes onProgress at multiple stages", async () => {
    const seen: { stage: string; ratio: number }[] = [];
    await convert("# x", "md", "html", {
      onProgress: (stage, ratio) => seen.push({ stage, ratio }),
    });
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.at(-1)?.stage).toBe("done");
    expect(seen.at(-1)?.ratio).toBe(1);
  });
  it("falls back to backend when local=false and backend is provided", async () => {
    let progressSeen: string[] = [];
    const r: ConvertResult = await convert("xxx", "docx", "html", {
      backend: {
        async convert(from, to, _input, onProgress) {
          onProgress?.("uploading", 0.2);
          onProgress?.("converting", 0.6);
          progressSeen = ["uploading", "converting"];
          void from;
          void to;
          return {
            ok: true,
            output: "<p>backend-rendered</p>",
            mime: "text/html",
            pair: { from, to, local: false, hint: "backend" },
          };
        },
      },
    });
    expect(r.ok).toBe(true);
    expect(progressSeen).toEqual(["uploading", "converting"]);
  });
  it("returns error when local=false and no backend provided", async () => {
    const r: ConvertResult = await convert("xxx", "docx", "html");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/requires backend/);
  });
});
