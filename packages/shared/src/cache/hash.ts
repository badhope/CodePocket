/**
 * 框架无关哈希工具。
 * - 浏览器/Node 18+：用 `crypto.subtle.digest("SHA-256", ...)`（异步、慢、密码学强）
 * - 其它情况：用 FNV-1a 32-bit（同步、快、非密码学但够去重用）
 *
 * 对 LRU key 来说两者都可——只是去重，不是签名。
 */

const ENC = new TextEncoder();

/** Web Crypto SHA-256（异步）。浏览器 / Node 19+ 全支持。 */
export async function sha256(input: string): Promise<string> {
  if (typeof globalThis.crypto?.subtle?.digest === "function") {
    const buf = await globalThis.crypto.subtle.digest("SHA-256", ENC.encode(input));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  // 极少数环境（老 Safari）兜底用 FNV-1a
  return fnv1aHex(input);
}

/** 同步 FNV-1a 32-bit → 8 hex chars。仅作为非 Web Crypto 环境的兜底。 */
export function fnv1aHex(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/**
 * 同步快速 key。优先 FNV-1a（避免 await subtle.digest 拖慢每次工具调用）。
 * 碰撞概率 ~ 2^-32，100 条缓存内冲突几乎不可能。
 */
export function fastKey(slug: string, input: string): string {
  return `${slug}::${fnv1aHex(slug + "\u0000" + input)}`;
}
