/**
 * 9 对文档转换的纯函数实现。
 * 全部框架无关，可被 H5 / Node 测试 / 后端 worker 共用。
 *
 * 注意：
 *  - MD↔HTML 复用 utils/markdown.ts（marked + turndown）
 *  - XML↔JSON 用 fast-xml-parser
 *  - HTML→PDF 用 pdf-lib（生成简单文本 PDF；不做 CSS 渲染）
 */

import { XMLParser, XMLBuilder } from "fast-xml-parser";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { markdownToHtml, htmlToMarkdown } from "../utils/markdown.js";

/* ── MD / HTML / TXT ─────────────────────────────────────── */

export function mdToHtml(input: string): string {
  return markdownToHtml(input);
}

export function htmlToMd(input: string): string {
  return htmlToMarkdown(input);
}

/** MD → 纯文本：去掉 markdown 标记（行内 code 保留内容、链接取 text、heading # 去掉） */
export function mdToTxt(input: string): string {
  return input
    .replace(/```[\s\S]*?```/g, (m) => m.replace(/```[a-zA-Z]*\n?/g, "").replace(/```/g, ""))
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** TXT → MD：当成段落用空行包起来（最简转换） */
export function txtToMd(input: string): string {
  return input
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .join("\n\n");
}

/* ── HTML ↔ JSON 结构化 ──────────────────────────────────── */

interface DomNode {
  tag?: string;
  text?: string;
  children?: DomNode[];
}

/** 简易 HTML → JSON 树：headings / paragraphs / list items / links */
export function htmlToJson(input: string): string {
  // 用一个最小化的 parser：先做 <br>/<p>/<h1-6>/<a> 解析，避免 DOM 依赖
  const nodes: DomNode[] = [];
  const stack: DomNode[] = [];
  let i = 0;
  const re = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)([^>]*)>|([^<]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(input)) !== null) {
    if (m[4] != null) {
      const text = m[4];
      if (text.trim() || stack.length) {
        const node: DomNode = { text };
        (stack[stack.length - 1]?.children ?? nodes).push(node);
      }
      continue;
    }
    const closing = m[1] === "/";
    const rawTag = m[2];
    if (rawTag == null) continue;
    const tag = rawTag.toLowerCase();
    if (closing) {
      stack.pop();
    } else if (["br", "img"].includes(tag)) {
      const node: DomNode = { tag };
      (stack[stack.length - 1]?.children ?? nodes).push(node);
    } else {
      const node: DomNode = { tag, children: [] };
      (stack[stack.length - 1]?.children ?? nodes).push(node);
      stack.push(node);
    }
    i = re.lastIndex;
  }
  void i;
  return JSON.stringify({ root: nodes }, null, 2);
}

/** JSON 树 → HTML：把 htmlToJson 输出反向（最简实现） */
export function jsonToHtml(input: string): string {
  const data = JSON.parse(input) as { root?: DomNode[] };
  const render = (n: DomNode): string => {
    if (n.text != null) return escapeHtml(n.text);
    const inner = (n.children ?? []).map(render).join("");
    if (!n.tag) return inner;
    return `<${n.tag}>${inner}</${n.tag}>`;
  };
  return (data.root ?? []).map(render).join("");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* ── JSON ↔ XML ─────────────────────────────────────────── */

const XML_OPTS = {
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  suppressEmptyNode: true,
};

export function jsonToXml(input: string): string {
  const data = JSON.parse(input);
  const builder = new XMLBuilder(XML_OPTS);
  return builder.build(data);
}

export function xmlToJson(input: string): string {
  const parser = new XMLParser(XML_OPTS);
  const data = parser.parse(input);
  return JSON.stringify(data, null, 2);
}

/* ── HTML → PDF（pdf-lib）────────────────────────────────── */

export async function htmlToPdf(input: string): Promise<Uint8Array> {
  const plain = htmlToMd(input); // 复用 turndown 把 HTML 展平成 markdown 文本
  const text = mdToTxt(plain); // 再 strip markdown 标记
  const lines = wrapText(text, 80);

  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Courier);
  const fontSize = 11;
  const lineHeight = fontSize * 1.4;
  const margin = 50;
  const pageWidth = 595.28; // A4
  const pageHeight = 841.89;
  const usableWidth = pageWidth - margin * 2;
  const charsPerLine = Math.floor(usableWidth / (fontSize * 0.6));

  let page = doc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;
  for (const line of lines) {
    if (y < margin) {
      page = doc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
    // pdf-lib 默认 font.widthOfTextAtSize 在某些 StandardFonts 不可用，用 charsPerLine 预算
    void font;
    void charsPerLine;
    page.drawText(line, {
      x: margin,
      y,
      size: fontSize,
      color: rgb(0, 0, 0),
    });
    y -= lineHeight;
  }
  return doc.save();
}

function wrapText(text: string, max: number): string[] {
  const out: string[] = [];
  for (const raw of text.split(/\n/)) {
    if (raw.length === 0) {
      out.push("");
      continue;
    }
    let line = "";
    for (const word of raw.split(/\s+/)) {
      if (line.length === 0) line = word;
      else if (line.length + 1 + word.length <= max) line += " " + word;
      else {
        out.push(line);
        line = word;
      }
    }
    if (line) out.push(line);
  }
  return out;
}
