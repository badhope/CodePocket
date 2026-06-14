/**
 * QR 码生成 — 框架无关接口。
 * 实际渲染需要 canvas（浏览器） / canvas 包（Node）。
 * 运行时注入 render 函数以避免依赖具体实现。
 *
 * 实际 QR 算法使用「qrcode-generator」纯 JS 库，无 native dep。
 */

import qrcode from "qrcode-generator";

export type ErrorCorrectionLevel = "L" | "M" | "Q" | "H";

export interface QrMatrixOptions {
  text: string;
  /** 二维码尺寸（像素），默认 256 */
  size?: number;
  /** 容错级别 L/M/Q/H，默认 M */
  ecLevel?: ErrorCorrectionLevel;
  /** 暗色十六进制，默认 #18181b */
  dark?: string;
  /** 亮色十六进制，默认 #fafafa */
  light?: string;
}

export interface QrMatrix {
  /** 行列数 */
  size: number;
  /** boolean 矩阵：true = dark，false = light */
  cells: boolean[][];
}

export function buildQrMatrix(opts: QrMatrixOptions): QrMatrix {
  const ec = opts.ecLevel ?? "M";
  const qr = qrcode(0, ec);
  qr.addData(opts.text, "Byte");
  qr.make();
  const n = qr.getModuleCount();
  const cells: boolean[][] = [];
  for (let r = 0; r < n; r++) {
    const row: boolean[] = [];
    for (let c = 0; c < n; c++) {
      row.push(qr.isDark(r, c));
    }
    cells.push(row);
  }
  return { size: n, cells };
}

/** 把矩阵渲染成 SVG 字符串 */
export function qrToSvg(matrix: QrMatrix, opts: { dark?: string; light?: string } = {}): string {
  const dark = opts.dark ?? "#18181b";
  const light = opts.light ?? "#fafafa";
  const cells = matrix.cells
    .map((row, r) =>
      row
        .map((on, c) => (on ? `M${c},${r}h1v1h-1z` : ""))
        .filter(Boolean)
        .join(""),
    )
    .filter(Boolean)
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${matrix.size} ${matrix.size}" shape-rendering="crispEdges" style="background:${light}"><path d="${cells}" fill="${dark}"/></svg>`;
}

/** 把 SVG 渲染到 canvas，返回 dataURL。Node 环境需先注入 node-canvas 或 polyfill。 */
export function qrToDataUrl(opts: QrMatrixOptions): string {
  const matrix = buildQrMatrix(opts);
  return `data:image/svg+xml;base64,${btoa(qrToSvg(matrix, opts))}`;
}
