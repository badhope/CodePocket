/* ─── Base64 ───────────────────────────────────────────────────── */

export function encodeBase64(input: string): string {
  if (typeof btoa !== "undefined") {
    return btoa(unescape(encodeURIComponent(input)));
  }
  // Node fallback: use TextEncoder to get UTF-8 bytes, then encode.
  const bytes = new TextEncoder().encode(input);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i] ?? 0);
  return btoa(bin);
}

export function decodeBase64(input: string): string {
  if (typeof atob !== "undefined") {
    return decodeURIComponent(escape(atob(input)));
  }
  const bin = atob(input);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

/* ─── URL ──────────────────────────────────────────────────────── */

export function encodeUrl(input: string): string {
  return encodeURIComponent(input);
}

export function decodeUrl(input: string): string {
  try {
    return decodeURIComponent(input);
  } catch {
    return input;
  }
}

/* ─── JWT（仅解码，不验签 — 验签需后端或 jwt 库） ──────────── */

export interface JwtHeader {
  alg: string;
  typ?: string;
  [k: string]: unknown;
}
export interface JwtPayload {
  sub?: string;
  iss?: string;
  aud?: string | string[];
  exp?: number;
  iat?: number;
  nbf?: number;
  jti?: string;
  [k: string]: unknown;
}

export function decodeJwt(
  token: string,
): { ok: true; header: JwtHeader; payload: JwtPayload; signature: string } | { ok: false; error: string } {
  const parts = token.split(".");
  if (parts.length !== 3) return { ok: false, error: "JWT must have 3 parts" };
  const h = parts[0]!;
  const p = parts[1]!;
  const s = parts[2]!;
  try {
    const header = JSON.parse(decodeBase64(h)) as JwtHeader;
    const payload = JSON.parse(decodeBase64(p)) as JwtPayload;
    return { ok: true, header, payload, signature: s };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export function jwtIsExpired(payload: JwtPayload, nowSec = Math.floor(Date.now() / 1000)): boolean {
  return typeof payload.exp === "number" && payload.exp <= nowSec;
}
