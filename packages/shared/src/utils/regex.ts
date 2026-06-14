/**
 * 正则表达式工具 — 框架无关。
 * 所有匹配、捕获组、命名组都走原生 RegExp，结果归一化输出。
 */

export interface RegexMatch {
  index: number;
  input: string;
  match: string;
  groups: (string | undefined)[];
  namedGroups: Record<string, string | undefined>;
  start: number;
  end: number;
}

export interface RegexTestResult {
  ok: boolean;
  pattern: string;
  flags: string;
  matches: readonly RegexMatch[];
  count: number;
  error: string | null;
}

/** 安全地构造 RegExp（pattern + flags 分离） */
export function compileRegex(pattern: string, flags: string): { re: RegExp } | { error: string } {
  try {
    return { re: new RegExp(pattern, flags) };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

/** 跑一遍正则（带错误捕获 + 全局匹配） */
export function regexTest(pattern: string, flags: string, input: string): RegexTestResult {
  const compiled = compileRegex(pattern, flags);
  if ("error" in compiled) {
    return { ok: false, pattern, flags, matches: [], count: 0, error: compiled.error };
  }
  const re = compiled.re;
  const matches: RegexMatch[] = [];
  // 命名组
  if (re.global) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(input)) !== null) {
      matches.push(toRegexMatch(m, input));
      if (m[0] === "") re.lastIndex++; // 防空匹配死循环
    }
  } else {
    const m = re.exec(input);
    if (m) matches.push(toRegexMatch(m, input));
  }
  return { ok: true, pattern, flags, matches, count: matches.length, error: null };
}

function toRegexMatch(m: RegExpExecArray, input: string): RegexMatch {
  return {
    index: m.index,
    input,
    match: m[0],
    groups: m.slice(1),
    namedGroups: { ...(m.groups ?? {}) },
    start: m.index,
    end: m.index + m[0].length,
  };
}

/** 常用 flags 校验 */
export function validateFlags(flags: string): { ok: true } | { ok: false; error: string } {
  const valid = /^[gimsuy]*$/;
  if (!valid.test(flags)) {
    return { ok: false, error: "invalid flags (allowed: g i m s u y)" };
  }
  const seen = new Set<string>();
  for (const f of flags) {
    if (seen.has(f)) return { ok: false, error: `duplicate flag '${f}'` };
    seen.add(f);
  }
  return { ok: true };
}
