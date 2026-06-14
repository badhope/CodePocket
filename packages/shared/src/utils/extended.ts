/* ─── YAML ─────────────────────────────────────────────────────── */

export function formatYaml(input: string): { ok: true; output: string } | { ok: false; error: string } {
  try {
    // 简单的 YAML 格式化（基于缩进）
    const lines = input.split('\n');
    const result: string[] = [];
    let indent = 0;
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      
      // 减少缩进
      if (trimmed.startsWith('- ') || trimmed.startsWith('}')) {
        indent = Math.max(0, indent - 1);
      }
      
      result.push('  '.repeat(indent) + trimmed);
      
      // 增加缩进
      if (trimmed.endsWith(':') || trimmed.endsWith('{') || trimmed.endsWith('[')) {
        indent++;
      }
    }
    
    return { ok: true, output: result.join('\n') };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export function minifyYaml(input: string): string {
  return input
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .join('\n');
}

/* ─── Hash ─────────────────────────────────────────────────────── */

export type HashAlgorithm = 'md5' | 'sha1' | 'sha256' | 'sha384' | 'sha512';

export async function generateHash(
  input: string,
  algorithm: HashAlgorithm = 'sha256'
): Promise<{ ok: true; hash: string } | { ok: false; error: string }> {
  try {
    if (typeof crypto === 'undefined' || !crypto.subtle) {
      return { ok: false, error: 'Web Crypto API not available' };
    }
    
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    
    // MD5 和 SHA1 需要特殊处理（不在 Web Crypto 标准中）
    if (algorithm === 'md5') {
      // 简单的 MD5 实现（仅用于演示，生产环境应使用专业库）
      return { ok: false, error: 'MD5 not supported in browser, use SHA256' };
    }
    
    const algoMap: Record<string, string> = {
      sha1: 'SHA-1',
      sha256: 'SHA-256',
      sha384: 'SHA-384',
      sha512: 'SHA-512',
    };
    
    const hashBuffer = await crypto.subtle.digest(algoMap[algorithm] || 'SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    return { ok: true, hash: hashHex };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/* ─── Color ────────────────────────────────────────────────────── */

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface HSL {
  h: number;
  s: number;
  l: number;
}

export function hexToRgb(hex: string): RGB | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

export function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
}

export function rgbToHsl(r: number, g: number, b: number): HSL {
  r /= 255;
  g /= 255;
  b /= 255;
  
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }
  
  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

export function hslToRgb(h: number, s: number, l: number): RGB {
  h /= 360;
  s /= 100;
  l /= 100;
  
  let r, g, b;
  
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  
  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
}

/* ─── CSV/JSON ─────────────────────────────────────────────────── */

export function csvToJson(csv: string): { ok: true; output: string } | { ok: false; error: string } {
  try {
    const lines = csv.trim().split('\n');
    if (lines.length === 0) return { ok: false, error: 'Empty CSV' };
    
    const headers = lines[0].split(',').map(h => h.trim());
    const result = lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim());
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => {
        obj[h] = values[i] || '';
      });
      return obj;
    });
    
    return { ok: true, output: JSON.stringify(result, null, 2) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export function jsonToCsv(json: string): { ok: true; output: string } | { ok: false; error: string } {
  try {
    const data = JSON.parse(json);
    if (!Array.isArray(data) || data.length === 0) {
      return { ok: false, error: 'JSON must be a non-empty array' };
    }
    
    const headers = Object.keys(data[0]);
    const csvLines = [headers.join(',')];
    
    for (const row of data) {
      const values = headers.map(h => row[h] ?? '');
      csvLines.push(values.join(','));
    }
    
    return { ok: true, output: csvLines.join('\n') };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/* ─── Text Utils ───────────────────────────────────────────────── */

export function sortLines(text: string, reverse = false): string {
  const lines = text.split('\n');
  const sorted = reverse ? lines.sort((a, b) => b.localeCompare(a)) : lines.sort((a, b) => a.localeCompare(b));
  return sorted.join('\n');
}

export function uniqueLines(text: string): string {
  return [...new Set(text.split('\n'))].join('\n');
}

export function reverseLines(text: string): string {
  return text.split('\n').reverse().join('\n');
}

export function shuffleLines(text: string): string {
  const lines = text.split('\n');
  for (let i = lines.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [lines[i], lines[j]] = [lines[j]!, lines[i]!];
  }
  return lines.join('\n');
}

export function toUpperCase(text: string): string {
  return text.toUpperCase();
}

export function toLowerCase(text: string): string {
  return text.toLowerCase();
}

export function toTitleCase(text: string): string {
  return text.replace(/\b\w/g, c => c.toUpperCase());
}

export function wordCount(text: string): { words: number; chars: number; lines: number } {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const chars = text.length;
  const lines = text.split('\n').length;
  return { words, chars, lines };
}

/* ─── Cron ─────────────────────────────────────────────────────── */

export interface CronSchedule {
  minute: string;
  hour: string;
  dayOfMonth: string;
  month: string;
  dayOfWeek: string;
}

export function parseCron(expression: string): { ok: true; schedule: CronSchedule; description: string } | { ok: false; error: string } {
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) {
    return { ok: false, error: 'Cron expression must have 5 parts' };
  }
  
  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
  
  const description = describeCron(minute!, hour!, dayOfMonth!, month!, dayOfWeek!);
  
  return {
    ok: true,
    schedule: { minute: minute!, hour: hour!, dayOfMonth: dayOfMonth!, month: month!, dayOfWeek: dayOfWeek! },
    description,
  };
}

export function describeCron(minute: string, hour: string, dom: string, month: string, dow: string): string {
  const parts: string[] = [];
  
  if (minute === '*' && hour === '*' && dom === '*' && month === '*' && dow === '*') {
    return 'Every minute';
  }
  
  if (minute !== '*') parts.push(`at minute ${minute}`);
  if (hour !== '*') parts.push(`at hour ${hour}`);
  if (dom !== '*') parts.push(`on day ${dom} of month`);
  if (month !== '*') parts.push(`in month ${month}`);
  if (dow !== '*') parts.push(`on weekday ${dow}`);
  
  return parts.join(', ') || 'Custom schedule';
}

/* ─── Lorem Ipsum ──────────────────────────────────────────────── */

const LOREM_WORDS = [
  'lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur', 'adipiscing', 'elit',
  'sed', 'do', 'eiusmod', 'tempor', 'incididunt', 'ut', 'labore', 'et', 'dolore',
  'magna', 'aliqua', 'enim', 'ad', 'minim', 'veniam', 'quis', 'nostrud',
  'exercitation', 'ullamco', 'laboris', 'nisi', 'aliquip', 'ex', 'ea', 'commodo',
  'consequat', 'duis', 'aute', 'irure', 'in', 'reprehenderit', 'voluptate',
  'velit', 'esse', 'cillum', 'fugiat', 'nulla', 'pariatur', 'excepteur', 'sint',
  'occaecat', 'cupidatat', 'non', 'proident', 'sunt', 'culpa', 'qui', 'officia',
  'deserunt', 'mollit', 'anim', 'id', 'est', 'laborum',
];

export function generateLoremIpsum(words = 50): string {
  const result: string[] = [];
  let wordCount = 0;
  
  while (wordCount < words) {
    const sentenceLength = Math.min(Math.floor(Math.random() * 10) + 5, words - wordCount);
    const sentence: string[] = [];
    
    for (let i = 0; i < sentenceLength; i++) {
      const word = LOREM_WORDS[Math.floor(Math.random() * LOREM_WORDS.length)]!;
      sentence.push(i === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word);
    }
    
    result.push(sentence.join(' ') + '.');
    wordCount += sentenceLength;
  }
  
  return result.join(' ');
}

/* ─── Number Base ──────────────────────────────────────────────── */

export function convertBase(input: string, fromBase: number, toBase: number): { ok: true; output: string } | { ok: false; error: string } {
  try {
    const decimal = parseInt(input, fromBase);
    if (isNaN(decimal)) {
      return { ok: false, error: `Invalid number for base ${fromBase}` };
    }
    return { ok: true, output: decimal.toString(toBase).toUpperCase() };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export function toBinary(input: string): string {
  return parseInt(input, 10).toString(2);
}

export function toOctal(input: string): string {
  return parseInt(input, 10).toString(8);
}

export function toHex(input: string): string {
  return parseInt(input, 10).toString(16).toUpperCase();
}

/* ─── JSONPath ─────────────────────────────────────────────────── */

export function queryJsonPath(json: string, path: string): { ok: true; result: unknown } | { ok: false; error: string } {
  try {
    const data = JSON.parse(json);
    
    // 简单的 JSONPath 实现（支持 $.key, $.key.subkey, $[0], $.key[0]）
    const parts = path.replace(/^\$\.?/, '').split(/\.|\[|\]/).filter(Boolean);
    let current: unknown = data;
    
    for (const part of parts) {
      if (current === null || current === undefined) {
        return { ok: false, error: `Path not found: ${path}` };
      }
      
      if (/^\d+$/.test(part)) {
        current = (current as unknown[])[parseInt(part)];
      } else {
        current = (current as Record<string, unknown>)[part];
      }
    }
    
    return { ok: true, result: current };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/* ─── Validators ───────────────────────────────────────────────── */

export function validateEmail(email: string): boolean {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

export function validateUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function validateIPv4(ip: string): boolean {
  const re = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (!re.test(ip)) return false;
  
  const parts = ip.split('.').map(Number);
  return parts.every(p => p >= 0 && p <= 255);
}

export function validateIPv6(ip: string): boolean {
  const re = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
  return re.test(ip);
}

export function validateIP(ip: string): { valid: boolean; type: 'IPv4' | 'IPv6' | 'invalid' } {
  if (validateIPv4(ip)) return { valid: true, type: 'IPv4' };
  if (validateIPv6(ip)) return { valid: true, type: 'IPv6' };
  return { valid: false, type: 'invalid' };
}
