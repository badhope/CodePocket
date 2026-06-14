/**
 * ID 生成（uuid / nanoid / short id）— 框架无关。
 * 优先使用 crypto.randomUUID；否则 fallback 到 Math.random（仅用于非安全场景）。
 */

export function uuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // RFC4122 v4
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  // 第 7 字节：bits 12-15 = 0100 (v4)
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  // 第 9 字节：bits 6-7 = 10 (variant)
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex
    .slice(8, 10)
    .join("")}-${hex.slice(10, 16).join("")}`;
}

/** nanoid 风格的短 id（默认 10 字符，base64-url 字符集） */
export function nanoid(size = 10): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  const bytes = new Uint8Array(size);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < size; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  let out = "";
  for (let i = 0; i < size; i++) {
    const b = bytes[i] ?? 0;
    out += alphabet[b & 63] ?? "";
  }
  return out;
}

/** 用于分享链接的短 id（base36，长度 6-8，碰撞概率极低） */
export function shortId(size = 7): string {
  const bytes = new Uint8Array(size);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < size; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  let out = "";
  for (let i = 0; i < size; i++) {
    out += ((bytes[i] ?? 0) % 36).toString(36);
  }
  return out;
}
