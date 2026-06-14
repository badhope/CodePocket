/**
 * 内容转换工具（依赖第三方包）— 框架无关。
 * markdown 渲染使用 marked；html → markdown 使用 turndown。
 *
 * 注意：marked / turndown 仅在调用方实际需要时由 Vite/打包器 tree-shake 进去。
 * H5 端会预装；小程序 / App 端如不支持 markdown 可不安装。
 */

import { marked } from "marked";
import TurndownService from "turndown";

/** 配置 marked 一次即可 */
marked.setOptions({
  gfm: true,
  breaks: false,
});

/** Markdown → HTML */
export function markdownToHtml(input: string): string {
  if (!input.trim()) return "";
  return marked.parse(input, { async: false }) as string;
}

let _turndown: TurndownService | null = null;
function turndown(): TurndownService {
  if (!_turndown) {
    _turndown = new TurndownService({
      headingStyle: "atx",
      codeBlockStyle: "fenced",
      bulletListMarker: "-",
      emDelimiter: "_",
    });
    // 保留 <pre><code class="language-xxx"> 中的语言
    _turndown.addRule("fencedCode", {
      filter: (node) => {
        const n = node as HTMLElement;
        return n.nodeName === "PRE" && !!n.firstChild && n.firstChild.nodeName === "CODE";
      },
      replacement: (_content, node) => {
        const n = node as HTMLElement;
        const code = n.firstChild as HTMLElement | null;
        const className = code?.getAttribute?.("class") ?? "";
        const lang = /language-(\S+)/.exec(className)?.[1] ?? "";
        const text = code?.textContent ?? "";
        return `\n\n\`\`\`${lang}\n${text}\n\`\`\`\n\n`;
      },
    });
  }
  return _turndown;
}

/** HTML → Markdown */
export function htmlToMarkdown(input: string): string {
  if (!input.trim()) return "";
  return turndown().turndown(input);
}

/** 把 markdown 渲染成安全 HTML（小程序 / App 需要自己适配，这里仅 H5 / Node 用） */
export function renderMarkdown(input: string): string {
  return markdownToHtml(input);
}
