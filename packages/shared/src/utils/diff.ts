/**
 * 文本 / JSON diff — 极简实现（不依赖 diff 库）。
 * 大文件（> 100KB）建议后端返回或 lazy 加载。
 */

export type DiffOp = "equal" | "insert" | "delete";
export interface DiffLine {
  op: DiffOp;
  left?: number;
  right?: number;
  value: string;
}

/** 行级 LCS diff（O(n*m) — 适合 < 5k 行） */
export function lineDiff(a: string, b: string): readonly DiffLine[] {
  const al = a.split("\n");
  const bl = b.split("\n");
  const n = al.length;
  const m = bl.length;

  // LCS 长度表
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    const aLine = al[i] ?? "";
    for (let j = m - 1; j >= 0; j--) {
      const bLine = bl[j] ?? "";
      if (aLine === bLine) {
        const dpNext = dp[i + 1]?.[j + 1] ?? 0;
        const dpCur = dp[i] ?? [];
        dpCur[j] = dpNext + 1;
      } else {
        const dpDown = dp[i + 1]?.[j] ?? 0;
        const dpRight = dp[i]?.[j + 1] ?? 0;
        const dpCur = dp[i] ?? [];
        dpCur[j] = Math.max(dpDown, dpRight);
      }
    }
  }

  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  let li = 0;
  let ri = 0;
  while (i < n && j < m) {
    const aLine = al[i] ?? "";
    const bLine = bl[j] ?? "";
    if (aLine === bLine) {
      out.push({ op: "equal", left: ++li, right: ++ri, value: aLine });
      i++;
      j++;
    } else if ((dp[i + 1]?.[j] ?? 0) >= (dp[i]?.[j + 1] ?? 0)) {
      out.push({ op: "delete", left: ++li, value: aLine });
      i++;
    } else {
      out.push({ op: "insert", right: ++ri, value: bLine });
      j++;
    }
  }
  while (i < n) {
    out.push({ op: "delete", left: ++li, value: al[i] ?? "" });
    i++;
  }
  while (j < m) {
    out.push({ op: "insert", right: ++ri, value: bl[j] ?? "" });
    j++;
  }
  return out;
}

/** JSON-aware diff — 把对象的 key/value 分别对比 */
export interface JsonDiffEntry {
  path: string;
  kind: "added" | "removed" | "changed" | "unchanged";
  left?: unknown;
  right?: unknown;
}

export function jsonDiff(a: unknown, b: unknown, basePath = "$"): readonly JsonDiffEntry[] {
  const out: JsonDiffEntry[] = [];
  walk(a, b, basePath, out);
  return out;
}

function walk(a: unknown, b: unknown, path: string, out: JsonDiffEntry[]): void {
  if (deepEqual(a, b)) {
    out.push({ path, kind: "unchanged", left: a, right: b });
    return;
  }
  const aIsObj = a !== null && typeof a === "object";
  const bIsObj = b !== null && typeof b === "object";
  if (!aIsObj || !bIsObj || Array.isArray(a) !== Array.isArray(b)) {
    out.push({ path, kind: "changed", left: a, right: b });
    return;
  }
  const aObj = a as Record<string, unknown>;
  const bObj = b as Record<string, unknown>;
  const keys = new Set([...Object.keys(aObj), ...Object.keys(bObj)]);
  for (const k of keys) {
    const child = path === "$" ? `$.${k}` : `${path}.${k}`;
    if (!(k in aObj)) {
      out.push({ path: child, kind: "added", right: bObj[k] });
    } else if (!(k in bObj)) {
      out.push({ path: child, kind: "removed", left: aObj[k] });
    } else {
      walk(aObj[k], bObj[k], child, out);
    }
  }
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== typeof b) return false;
  if (typeof a !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    const arrA = a as unknown[];
    const arrB = b as unknown[];
    if (arrA.length !== arrB.length) return false;
    for (let i = 0; i < arrA.length; i++) {
      if (!deepEqual(arrA[i], arrB[i])) return false;
    }
    return true;
  }
  const aKeys = Object.keys(a as object);
  const bKeys = Object.keys(b as object);
  if (aKeys.length !== bKeys.length) return false;
  for (const k of aKeys) {
    if (!deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])) return false;
  }
  return true;
}
