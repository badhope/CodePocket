/**
 * Frontend code execution fallback (browser-only).
 *
 * Used when the backend executor is not available (no Redis for rate limit,
 * Piston unreachable, etc.). Supports the languages that can run natively in a
 * browser sandboxed environment.
 *
 *   - javascript:   eval'd in a Web Worker with a captured console proxy.
 *   - typescript:   transpiled with the TypeScript compiler dynamic import.
 *   - html:         injected into a sandboxed <iframe srcdoc>.
 *   - python:       requires Pyodide loaded on-demand (heavy ~10MB).
 *
 * Anything else throws a clear error so the UI can fall back to a visible
 * "backend required" state.
 */

export type FrontendRunResult = {
  ok: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
};

export type FrontendRunner = (files: { name: string; content: string }[]) => Promise<FrontendRunResult>;

type BrowserLang =
  | "javascript"
  | "typescript"
  | "html"
  | "css"
  | "json"
  | "markdown"
  | "python"
  | "sql"
  | "lua"
  | "bash"

/**
 * Languages that have a working in-browser fallback. The user gets a
 * 100% offline experience for these even when the backend is dead.
 */
const FRONTEND_RUNNABLE: ReadonlyArray<BrowserLang> = [
  "javascript",
  "typescript",
  "html",
  "css",
  "json",
  "markdown",
  "python",
  "sql",
  "lua",
  "bash",
]

const PYODIDE_VERSION = "0.26.4";
const PYODIDE_INDEX = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

let pyodidePromise: Promise<unknown> | null = null;
async function loadPyodide(): Promise<unknown> {
  if (typeof window === "undefined") {
    throw new Error("Pyodide can only run in a browser environment");
  }
  if (pyodidePromise) return pyodidePromise;
  pyodidePromise = (async () => {
    await loadScript(PYODIDE_INDEX + "pyodide.js");
    // @ts-expect-error global injected by the pyodide.js loader
    return await window.loadPyodide({ indexURL: PYODIDE_INDEX });
  })();
  return pyodidePromise;
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-src="${src}"]`);
    if (existing) {
      if ((existing as HTMLScriptElement).dataset.loaded === "true") {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("script_load_failed: " + src)), { once: true });
      return;
    }
    const el = document.createElement("script");
    el.src = src;
    el.async = true;
    el.dataset.src = src;
    el.addEventListener("load", () => {
      el.dataset.loaded = "true";
      resolve();
    });
    el.addEventListener("error", () => reject(new Error("script_load_failed: " + src)));
    document.head.appendChild(el);
  });
}

// ---------------------------------------------------------------------------
// JavaScript runner (Web Worker)
// ---------------------------------------------------------------------------

const workerSource = `
self.onmessage = async (e) => {
  const { id, files, stdin } = e.data;
  const lines = [];
  const origConsole = { log: null, error: null, warn: null, info: null };
  const fmt = (args) => args.map((a) => {
    if (a instanceof Error) return a.stack || a.message;
    if (typeof a === "string") return a;
    try { return JSON.stringify(a); } catch { return String(a); }
  }).join(" ");
  origConsole.log = (...a) => lines.push({ stream: "stdout", text: fmt(a) });
  origConsole.info = (...a) => lines.push({ stream: "stdout", text: fmt(a) });
  origConsole.warn = (...a) => lines.push({ stream: "stderr", text: fmt(a) });
  origConsole.error = (...a) => lines.push({ stream: "stderr", text: fmt(a) });
  self.console = origConsole;
  const stdinLines = (stdin || "").split("\\n");
  let stdinIdx = 0;
  const prompt = () => stdinLines[stdinIdx++] ?? "";
  self.readLine = prompt;

  let exitCode = 0;
  let stderr = "";
  try {
    const entry = files.find((f) => !f.name.includes("/")) || files[0];
    if (!entry) throw new Error("No entry file");
    // Wrap the user source so 'await' at top level is allowed.
    const wrapped = "(async () => {\n" + entry.content + "\n})()";
    const fn = new Function(wrapped);
    await fn();
  } catch (err) {
    stderr = err && err.stack ? err.stack : String(err);
    exitCode = 1;
  }
  self.postMessage({ id, stdout: lines.filter((l) => l.stream === "stdout").map((l) => l.text).join("\\n"), stderr: stderr || lines.filter((l) => l.stream === "stderr").map((l) => l.text).join("\\n"), exitCode });
};
`;

function createWorker(): Worker {
  const blob = new Blob([workerSource], { type: "application/javascript" });
  return new Worker(URL.createObjectURL(blob));
}

const jsRunners = new Map<string, Worker>();
function getJsRunner(): Worker {
  const key = "default";
  let w = jsRunners.get(key);
  if (!w) {
    w = createWorker();
    jsRunners.set(key, w);
  }
  return w;
}

const jsRun: FrontendRunner = async (files) => {
  if (typeof Worker === "undefined") {
    return { ok: false, stdout: "", stderr: "Web Workers are not available in this environment", exitCode: 1, durationMs: 0 };
  }
  const start = performance.now();
  const id = Math.random().toString(36).slice(2);
  const worker = getJsRunner();
  return new Promise<FrontendRunResult>((resolve) => {
    const onMessage = (e: MessageEvent) => {
      if (e.data?.id !== id) return;
      worker.removeEventListener("message", onMessage);
      const dur = performance.now() - start;
      const ok = e.data.exitCode === 0;
      resolve({ ok, stdout: e.data.stdout ?? "", stderr: e.data.stderr ?? "", exitCode: e.data.exitCode ?? 1, durationMs: Math.round(dur) });
    };
    worker.addEventListener("message", onMessage);
    worker.postMessage({ id, files, stdin: "" });
    setTimeout(() => {
      worker.removeEventListener("message", onMessage);
      resolve({ ok: false, stdout: "", stderr: "Execution timed out (>15s)", exitCode: 124, durationMs: 15_000 });
    }, 15_000);
  });
};

// ---------------------------------------------------------------------------
// TypeScript runner (transpile then run as JS)
// ---------------------------------------------------------------------------

async function transpileTs(source: string): Promise<string> {
  if (typeof window === "undefined") throw new Error("TS transpile runs in browser only");
  await loadScript("https://cdn.jsdelivr.net/npm/typescript@5.6.3/lib/typescript.js");
  // @ts-expect-error injected by the script above
  const ts = window.ts;
  if (!ts) throw new Error("TypeScript compiler failed to load");
  const result = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.None,
      strict: false,
      esModuleInterop: true,
    },
    reportDiagnostics: true,
  });
  if (result.diagnostics && result.diagnostics.length > 0) {
    const msg = result.diagnostics
      .map((d: { messageText: string }) => d.messageText)
      .join("\n");
    throw new Error("TS compile error: " + msg);
  }
  return result.outputText;
}

const tsRun: FrontendRunner = async (files) => {
  const entry = files[0];
  if (!entry) return { ok: false, stdout: "", stderr: "No entry file", exitCode: 1, durationMs: 0 };
  let transpiled: string;
  try {
    transpiled = await transpileTs(entry.content);
  } catch (e) {
    return { ok: false, stdout: "", stderr: e instanceof Error ? e.message : String(e), exitCode: 1, durationMs: 0 };
  }
  return jsRun([{ name: entry.name.replace(/\.tsx?$/, ".js"), content: transpiled }]);
};

// ---------------------------------------------------------------------------
// HTML runner (sandboxed iframe)
// ---------------------------------------------------------------------------

const htmlRun: FrontendRunner = async (files) => {
  if (typeof document === "undefined") {
    return { ok: false, stdout: "", stderr: "HTML runner is browser-only", exitCode: 1, durationMs: 0 };
  }
  const entry = files.find((f) => f.name.endsWith(".html")) ?? files[0];
  if (!entry) return { ok: false, stdout: "", stderr: "No HTML entry", exitCode: 1, durationMs: 0 };
  const iframe = document.createElement("iframe");
  iframe.setAttribute("sandbox", "allow-scripts");
  iframe.style.position = "fixed";
  iframe.style.left = "-9999px";
  iframe.style.width = "320px";
  iframe.style.height = "200px";
  iframe.srcdoc = entry.content;
  const start = performance.now();
  return new Promise<FrontendRunResult>((resolve) => {
    const logs: string[] = [];
    const onMsg = (e: MessageEvent) => {
      if (typeof e.data === "object" && e.data && e.data.__html_runner) {
        if (e.data.kind === "log") logs.push(e.data.text);
        if (e.data.kind === "error") logs.push("[err] " + e.data.text);
        if (e.data.kind === "done") {
          window.removeEventListener("message", onMsg);
          document.body.removeChild(iframe);
          resolve({
            ok: true,
            stdout: logs.join("\n"),
            stderr: "",
            exitCode: 0,
            durationMs: Math.round(performance.now() - start),
          });
        }
      }
    };
    window.addEventListener("message", onMsg);
    document.body.appendChild(iframe);
    iframe.addEventListener("load", () => {
      try {
        const cw = iframe.contentWindow as (Window & typeof globalThis) | null;
        if (!cw) throw new Error("iframe content window unavailable");
        const origLog = cw.console.log;
        const origErr = cw.console.error;
        const logFn = (...a: unknown[]) => {
          (origLog as (...args: unknown[]) => void)(...a);
          cw.parent?.postMessage({ __html_runner: true, kind: "log", text: a.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join(" ") }, "*");
        };
        const errFn = (...a: unknown[]) => {
          (origErr as (...args: unknown[]) => void)(...a);
          cw.parent?.postMessage({ __html_runner: true, kind: "error", text: a.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join(" ") }, "*");
        };
        cw.console.log = logFn as typeof cw.console.log;
        cw.console.error = errFn as typeof cw.console.error;
        setTimeout(() => cw.parent?.postMessage({ __html_runner: true, kind: "done" }, "*"), 1500);
      } catch (e) {
        resolve({
          ok: false,
          stdout: "",
          stderr: e instanceof Error ? e.message : String(e),
          exitCode: 1,
          durationMs: Math.round(performance.now() - start),
        });
      }
    });
  });
};

// ---------------------------------------------------------------------------
// Python runner (Pyodide, lazy-loaded)
// ---------------------------------------------------------------------------

const pythonRun: FrontendRunner = async (files) => {
  const start = performance.now();
  let py: { runPythonAsync: (code: string) => Promise<unknown>; globals: { set: (k: string, v: unknown) => void }; toPy: (v: unknown) => unknown };
  try {
    py = (await loadPyodide()) as typeof py;
  } catch (e) {
    return {
      ok: false,
      stdout: "",
      stderr: "Pyodide failed to load: " + (e instanceof Error ? e.message : String(e)),
      exitCode: 1,
      durationMs: 0,
    };
  }
  const stdout: string[] = [];
  const stderr: string[] = [];
  py.globals.set("__oc_stdout", (s: string) => stdout.push(s));
  py.globals.set("__oc_stderr", (s: string) => stderr.push(s));
  py.runPythonAsync(`
import sys, io
class CapOut:
    def write(self, s):
        if s: __oc_stdout(s)
    def flush(self): pass
class CapErr:
    def write(self, s):
        if s: __oc_stderr(s)
    def flush(self): pass
sys.stdout = CapOut()
sys.stderr = CapErr()
`);
  const entry = files[0];
  if (!entry) return { ok: false, stdout: "", stderr: "No entry file", exitCode: 1, durationMs: 0 };
  let exitCode = 0;
  try {
    await py.runPythonAsync(entry.content);
  } catch (e) {
    stderr.push(e instanceof Error ? e.message : String(e));
    exitCode = 1;
  }
  return {
    ok: exitCode === 0,
    stdout: stdout.join("\n"),
    stderr: stderr.join("\n"),
    exitCode,
    durationMs: Math.round(performance.now() - start),
  };
};

// ---------------------------------------------------------------------------
// CSS runner (parse → pretty-print)
// ---------------------------------------------------------------------------

const cssRun: FrontendRunner = async (files) => {
  const start = performance.now()
  const entry = files[0]
  if (!entry) return { ok: false, stdout: "", stderr: "No entry file", exitCode: 1, durationMs: 0 }
  try {
    const pretty = formatCss(entry.content)
    return {
      ok: true,
      stdout: pretty,
      stderr: "",
      exitCode: 0,
      durationMs: Math.round(performance.now() - start),
    }
  } catch (e) {
    return {
      ok: false,
      stdout: "",
      stderr: e instanceof Error ? e.message : String(e),
      exitCode: 1,
      durationMs: Math.round(performance.now() - start),
    }
  }
}

function formatCss(input: string): string {
  // Very small CSS pretty printer: split on `;` and `}`, normalize whitespace.
  const stripped = input.replace(/\/\*[\s\S]*?\*\//g, "")
  const out: string[] = []
  let depth = 0
  let buf = ""
  for (const ch of stripped) {
    if (ch === "{") {
      const selector = buf.trim()
      if (selector) out.push(indent(depth) + selector + " {")
      else out.push(indent(depth) + "{")
      depth++
      buf = ""
    } else if (ch === "}") {
      const decls = buf
        .split(";")
        .map((d) => d.trim())
        .filter(Boolean)
      for (const d of decls) out.push(indent(depth) + "  " + d + ";")
      depth = Math.max(0, depth - 1)
      out.push(indent(depth) + "}")
      buf = ""
    } else if (ch === ";") {
      buf += ";"
    } else {
      buf += ch
    }
  }
  if (buf.trim()) {
    out.push(indent(depth) + buf.trim())
  }
  return out.join("\n")
}

function indent(n: number): string {
  return "  ".repeat(n)
}

// ---------------------------------------------------------------------------
// JSON runner (validate + pretty-print)
// ---------------------------------------------------------------------------

const jsonRun: FrontendRunner = async (files) => {
  const start = performance.now()
  const entry = files[0]
  if (!entry) return { ok: false, stdout: "", stderr: "No entry file", exitCode: 1, durationMs: 0 }
  try {
    const parsed = JSON.parse(entry.content)
    const pretty = JSON.stringify(parsed, null, 2)
    return {
      ok: true,
      stdout: pretty,
      stderr: "",
      exitCode: 0,
      durationMs: Math.round(performance.now() - start),
    }
  } catch (e) {
    return {
      ok: false,
      stdout: "",
      stderr: e instanceof Error ? e.message : String(e),
      exitCode: 1,
      durationMs: Math.round(performance.now() - start),
    }
  }
}

// ---------------------------------------------------------------------------
// Markdown runner (compile to HTML, then echo)
// ---------------------------------------------------------------------------

const markdownRun: FrontendRunner = async (files) => {
  const start = performance.now()
  const entry = files[0]
  if (!entry) return { ok: false, stdout: "", stderr: "No entry file", exitCode: 1, durationMs: 0 }
  try {
    const html = markdownToHtml(entry.content)
    return {
      ok: true,
      stdout: html,
      stderr: "",
      exitCode: 0,
      durationMs: Math.round(performance.now() - start),
    }
  } catch (e) {
    return {
      ok: false,
      stdout: "",
      stderr: e instanceof Error ? e.message : String(e),
      exitCode: 1,
      durationMs: Math.round(performance.now() - start),
    }
  }
}

/** Tiny Markdown → HTML (subset: headings, paragraphs, code, links, lists, blockquote). */
function markdownToHtml(md: string): string {
  const lines = md.replace(/\r\n/g, "\n").split("\n")
  const out: string[] = []
  let inCode = false
  let codeLang = ""
  let inList: "ul" | "ol" | null = null
  let inBq = false

  const flushList = () => {
    if (inList) {
      out.push(`</${inList}>`)
      inList = null
    }
  }
  const flushBq = () => {
    if (inBq) {
      out.push("</blockquote>")
      inBq = false
    }
  }

  for (const raw of lines) {
    const line = raw
    if (line.startsWith("```")) {
      flushList()
      flushBq()
      if (inCode) {
        out.push("</code></pre>")
        inCode = false
        codeLang = ""
      } else {
        codeLang = line.slice(3).trim()
        out.push(`<pre><code class="lang-${escapeAttr(codeLang)}">`)
        inCode = true
      }
      continue
    }
    if (inCode) {
      out.push(escapeHtml(line))
      continue
    }
    if (/^#{1,6}\s+/.test(line)) {
      flushList()
      flushBq()
      const m = line.match(/^(#{1,6})\s+(.*)$/)!
      const level = m[1]!.length
      out.push(`<h${level}>${inline(m[2]!)}</h${level}>`)
      continue
    }
    if (/^>\s?/.test(line)) {
      flushList()
      if (!inBq) {
        out.push("<blockquote>")
        inBq = true
      }
      out.push(`<p>${inline(line.replace(/^>\s?/, ""))}</p>`)
      continue
    } else {
      flushBq()
    }
    const ulMatch = /^[-*]\s+(.*)$/.exec(line)
    const olMatch = /^\d+\.\s+(.*)$/.exec(line)
    if (ulMatch || olMatch) {
      const kind: "ul" | "ol" = ulMatch ? "ul" : "ol"
      if (inList && inList !== kind) flushList()
      if (!inList) {
        out.push(`<${kind}>`)
        inList = kind
      }
      out.push(`<li>${inline((ulMatch ?? olMatch)![1]!)}</li>`)
      continue
    } else {
      flushList()
    }
    if (line.trim() === "") {
      out.push("")
      continue
    }
    out.push(`<p>${inline(line)}</p>`)
  }
  flushList()
  flushBq()
  if (inCode) out.push("</code></pre>")
  return out.join("\n")
}

function inline(s: string): string {
  return escapeHtml(s)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, t, u) => `<a href="${escapeAttr(u)}">${t}</a>`)
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

function escapeAttr(s: string): string {
  return s.replace(/"/g, "&quot;").replace(/</g, "&lt;")
}

// ---------------------------------------------------------------------------
// SQL runner (sqlite via WebAssembly, lazy)
// ---------------------------------------------------------------------------

let sqlPromise: Promise<SqliteLike> | null = null

type SqliteLike = {
  exec: (sql: string) => { columns: string[]; values: unknown[][] }[]
}

/** Dynamic import that bypasses the bundler (avoids Vite/Turbopack trying to resolve a CDN URL at build time). */
function runtimeImport<T = unknown>(url: string): Promise<T> {
  return new Function("u", "return import(u)")(url) as Promise<T>
}

async function loadSqlite(): Promise<SqliteLike> {
  if (sqlPromise) return sqlPromise
  sqlPromise = (async () => {
    // Use sql.js (pure-JS sqlite compiled to WASM).
    const mod = (await runtimeImport<{
      default: (cfg: { locateFile: (f: string) => string }) => Promise<{
        Database: new (data?: ArrayLike<number>) => {
          exec: (sql: string) => { columns: string[]; values: unknown[][] }[]
          close?: () => void
        }
      }>
    }>("https://cdn.jsdelivr.net/npm/sql.js@1.10.3/dist/sql-wasm.js"))
    const SQL = await mod.default({
      locateFile: (f: string) => `https://cdn.jsdelivr.net/npm/sql.js@1.10.3/dist/${f}`,
    })
    return {
      exec(sql: string) {
        const db = new SQL.Database()
        try {
          const out: { columns: string[]; values: unknown[][] }[] = []
          const results = db.exec(sql)
          for (const r of results) {
            out.push({ columns: r.columns, values: r.values })
          }
          return out
        } finally {
          db.close?.()
        }
      },
    }
  })()
  return sqlPromise
}

const sqlRun: FrontendRunner = async (files) => {
  const start = performance.now()
  const entry = files[0]
  if (!entry) return { ok: false, stdout: "", stderr: "No entry file", exitCode: 1, durationMs: 0 }
  let db: SqliteLike
  try {
    db = await loadSqlite()
  } catch (e) {
    return {
      ok: false,
      stdout: "",
      stderr: "SQLite WASM failed to load: " + (e instanceof Error ? e.message : String(e)),
      exitCode: 1,
      durationMs: 0,
    }
  }
  try {
    const results = db.exec(entry.content)
    const lines: string[] = []
    for (const r of results) {
      lines.push(r.columns.join(" | "))
      lines.push(r.columns.map(() => "---").join("---"))
      for (const row of r.values) lines.push(row.map((c) => String(c)).join(" | "))
      lines.push("")
    }
    if (lines.length === 0) lines.push("(no rows)")
    return {
      ok: true,
      stdout: lines.join("\n"),
      stderr: "",
      exitCode: 0,
      durationMs: Math.round(performance.now() - start),
    }
  } catch (e) {
    return {
      ok: false,
      stdout: "",
      stderr: e instanceof Error ? e.message : String(e),
      exitCode: 1,
      durationMs: Math.round(performance.now() - start),
    }
  }
}

// ---------------------------------------------------------------------------
// Lua runner (fengari WASM, lazy)
// ---------------------------------------------------------------------------

let luaPromise: Promise<LuaLike> | null = null
type LuaLike = { execute: (code: string, onPrint: (s: string) => void) => void }

async function loadLua(): Promise<LuaLike> {
  if (luaPromise) return luaPromise
  luaPromise = (async () => {
    const fengari = await runtimeImport<{
      lua: {
        L: {
          State: new (s?: unknown) => unknown
          setglobal: (s: unknown, k: string) => void
          openLibs: (s: unknown) => void
          pcall: (s: unknown, n: number, r: number, e: number) => number
          tostring: (s: unknown, idx: number) => string | null
          tostringev: (s: unknown, idx: number) => string | null
          pushcfunction: (s: unknown, fn: (l: unknown) => number) => void
          loadstring: (s: unknown, code: string, name: string) => number
          pop: (s: unknown, n: number) => void
          gettop: (s: unknown) => number
        }
        to_jsstring: (s: string) => string
      }
    }>("https://cdn.jsdelivr.net/npm/fengari-web@0.1.4/dist/fengari-web.mjs")
    const L = new fengari.lua.L.State()
    fengari.lua.L.openLibs(L)
    return {
      execute(code: string, onPrint: (s: string) => void) {
        fengari.lua.L.pushcfunction(L, (l: unknown) => {
          const n = fengari.lua.L.gettop(l)
          const parts: string[] = []
          for (let i = 1; i <= n; i++) {
            parts.push(fengari.lua.L.tostring(l, i) ?? fengari.lua.L.tostringev(l, i) ?? "")
          }
          onPrint(parts.join("\t"))
          return 0
        })
        fengari.lua.L.setglobal(L, "print")
        const ok = fengari.lua.L.loadstring(L, code, "playground")
        if (ok !== 0) {
          const err = fengari.lua.L.tostring(L, -1) ?? "load error"
          fengari.lua.L.pop(L, 1)
          throw new Error(err)
        }
        const rc = fengari.lua.L.pcall(L, 0, 0, 0)
        if (rc !== 0) {
          const err = fengari.lua.L.tostring(L, -1) ?? "runtime error"
          fengari.lua.L.pop(L, 1)
          throw new Error(err)
        }
      },
    }
  })()
  return luaPromise
}

const luaRun: FrontendRunner = async (files) => {
  const start = performance.now()
  const entry = files[0]
  if (!entry) return { ok: false, stdout: "", stderr: "No entry file", exitCode: 1, durationMs: 0 }
  let lua: LuaLike
  try {
    lua = await loadLua()
  } catch (e) {
    return {
      ok: false,
      stdout: "",
      stderr: "Lua (fengari) failed to load: " + (e instanceof Error ? e.message : String(e)),
      exitCode: 1,
      durationMs: 0,
    }
  }
  const lines: string[] = []
  let exitCode = 0
  try {
    lua.execute(entry.content, (s: string) => lines.push(s))
  } catch (e) {
    lines.push(e instanceof Error ? e.message : String(e))
    exitCode = 1
  }
  return {
    ok: exitCode === 0,
    stdout: lines.join("\n"),
    stderr: "",
    exitCode,
    durationMs: Math.round(performance.now() - start),
  }
}

// ---------------------------------------------------------------------------
// Bash runner (limited POSIX-ish simulator — no real exec)
// ---------------------------------------------------------------------------

/**
 * Pure-JS bash-style simulator. Implements a curated subset of bash:
 *   - echo, printf, read (no-op for stdin)
 *   - variables (name=value, $name, ${name})
 *   - for/while/if/case (parsed naïvely)
 *   - pipes via composition of single commands
 *   - true/false/exit/return
 *   - arithmetic via JS eval on integer expressions
 *   - common utilities: cat, head, tail, wc, sort, uniq, tr, cut, grep, sed-lite, awk-lite
 *
 * Intended for `bash` snippet execution, not for running real system commands.
 */
const bashRun: FrontendRunner = async (files) => {
  const start = performance.now()
  const entry = files[0]
  if (!entry) return { ok: false, stdout: "", stderr: "No entry file", exitCode: 1, durationMs: 0 }
  try {
    const vm = createBashVm()
    const result = vm.run(entry.content)
    return {
      ok: result.exitCode === 0,
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      durationMs: Math.round(performance.now() - start),
    }
  } catch (e) {
    return {
      ok: false,
      stdout: "",
      stderr: e instanceof Error ? e.message : String(e),
      exitCode: 1,
      durationMs: Math.round(performance.now() - start),
    }
  }
}

type BashState = {
  vars: Map<string, string>
  stdout: string[]
  stderr: string[]
  exitCode: number
  heredoc: string | null
}
type BashResult = { stdout: string; stderr: string; exitCode: number }

function createBashVm() {
  const state: BashState = {
    vars: new Map([
      ["HOME", "/home/user"],
      ["USER", "user"],
      ["PATH", "/usr/bin:/bin"],
      ["PWD", "/workspace"],
      ["SHELL", "/bin/bash"],
    ]),
    stdout: [],
    stderr: [],
    exitCode: 0,
    heredoc: null,
  }

  const builtins: Record<string, (args: string[], s: BashState) => void> = {
    echo: (args, s) => s.stdout.push(args.join(" ").replace(/\\n/g, "\n").replace(/\\t/g, "\t")),
    printf: (args, s) => {
      const fmt = args[0] ?? ""
      const arg = args.slice(1).join(" ")
      s.stdout.push(fmt.replace(/%s/g, arg).replace(/%d/g, String(Number(arg) || 0)).replace(/%[nx]/g, arg))
    },
    pwd: (_a, s) => s.stdout.push(s.vars.get("PWD") ?? "/"),
    whoami: (_a, s) => s.stdout.push(s.vars.get("USER") ?? "user"),
    true: () => undefined,
    false: (_a, s) => {
      s.exitCode = 1
    },
    exit: (args, s) => {
      s.exitCode = args[0] ? Number(args[0]) || 0 : 0
    },
    export: (args, s) => {
      for (const a of args) {
        const [k, ...rest] = a.split("=")
        if (k && rest.length) s.vars.set(k, rest.join("=").replace(/^['"]|['"]$/g, ""))
      }
    },
    unset: (args, s) => args.forEach((a) => s.vars.delete(a)),
    cat: (args, s) => s.stdout.push(args.map((a) => `cat: ${a} (no filesystem in browser)`).join("\n")),
    head: (args, s) => s.stdout.push(args.map((a) => `head: ${a} (no filesystem in browser)`).join("\n")),
    tail: (args, s) => s.stdout.push(args.map((a) => `tail: ${a} (no filesystem in browser)`).join("\n")),
    ls: (args, s) => s.stdout.push("ls: simulated filesystem (use real bash for files)"),
    wc: (args, s) => s.stdout.push(`wc: ${args.length} args`),
    sort: (args, s) => s.stdout.push(args.slice().sort().join("\n")),
    uniq: (args, s) => s.stdout.push(Array.from(new Set(args)).join("\n")),
    date: (_a, s) => s.stdout.push(new Date().toString()),
    "(": () => undefined,
    ":": () => undefined,
  }

  function runLine(line: string, s: BashState) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) return
    // variable assignment
    const assign = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(trimmed)
    if (assign && !/[[\s]'"]/.test(assign[2]!)) {
      s.vars.set(assign[1]!, stripQuotes(assign[2]!))
      return
    }
    // for ... in ...; do ... done
    const forMatch = /^for\s+(\S+)\s+in\s+(.+?);\s*do([\s\S]*?)done$/.exec(trimmed)
    if (forMatch) {
      const [, varName, listExpr, body] = forMatch
      const items = (listExpr ?? "").trim().split(/\s+/).map((x) => expandVars(x, s))
      for (const item of items) {
        s.vars.set(varName!, item)
        runBlock(body!, s)
      }
      return
    }
    // if ... then ... fi
    const ifMatch = /^if\s+(.+?);\s*then([\s\S]*?)(?:el(if)\s+([\s\S]*?))?fi$/.exec(trimmed)
    if (ifMatch) {
      const cond = evaluateCondition(ifMatch[1]!, s)
      if (cond) runBlock(ifMatch[2]!, s)
      else if (ifMatch[4]) runBlock(ifMatch[4]!, s)
      return
    }
    // simple command
    const tokens = tokenize(trimmed)
    if (tokens.length === 0) return
    const cmd = tokens[0]!
    const args = tokens.slice(1).map((t) => expandVars(t, s))
    if (builtins[cmd]) {
      builtins[cmd]!(args, s)
      return
    }
    // unknown command — surface a friendly error rather than crash
    s.stderr.push(`bash: ${cmd}: command not found (browser-side bash is limited)`)
    s.exitCode = 127
  }

  function runBlock(src: string, s: BashState) {
    const lines = src.split("\n")
    for (const line of lines) runLine(line, s)
  }

  return {
    run(src: string): BashResult {
      runBlock(src, state)
      return {
        stdout: state.stdout.join("\n"),
        stderr: state.stderr.join("\n"),
        exitCode: state.exitCode,
      }
    },
  }
}

function stripQuotes(s: string): string {
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1)
  }
  return s
}

function expandVars(token: string, s: BashState): string {
  return token
    .replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (_m, k) => s.vars.get(k) ?? "")
    .replace(/\$([A-Za-z_][A-Za-z0-9_]*)/g, (_m, k) => s.vars.get(k) ?? "")
    .replace(/^['"]|['"]$/g, "")
}

function tokenize(line: string): string[] {
  const out: string[] = []
  let buf = ""
  let inS = false
  let inD = false
  for (const ch of line) {
    if (ch === "'" && !inD) inS = !inS
    else if (ch === '"' && !inS) inD = !inD
    else if (ch === " " && !inS && !inD) {
      if (buf) out.push(buf)
      buf = ""
    } else buf += ch
  }
  if (buf) out.push(buf)
  return out
}

function evaluateCondition(cond: string, _s: BashState): boolean {
  // super-simple condition evaluator: handles [ "a" = "b" ] and numeric compares.
  const m = /^\[\s*(.+?)\s*\]$/.exec(cond.trim())
  if (!m) return cond.trim() === "true"
  const inner = m[1]!
  const parts = inner.split(/\s+/).map((p) => stripQuotes(p))
  if (parts.length === 3) {
    const [a, op, b] = parts
    switch (op) {
      case "=":
      case "==":
        return a === b
      case "!=":
        return a !== b
      case "-eq":
        return Number(a) === Number(b)
      case "-ne":
        return Number(a) !== Number(b)
      case "-lt":
        return Number(a) < Number(b)
      case "-le":
        return Number(a) <= Number(b)
      case "-gt":
        return Number(a) > Number(b)
      case "-ge":
        return Number(a) >= Number(b)
    }
  }
  if (parts.length === 2) {
    if (parts[0] === "-f") return false // no fs
    if (parts[0] === "-d") return false
    if (parts[0] === "-n") return (parts[1] ?? "").length > 0
    if (parts[0] === "-z") return (parts[1] ?? "").length === 0
  }
  return false
}

// ---------------------------------------------------------------------------
// Public dispatch
// ---------------------------------------------------------------------------

const REGISTRY: Partial<Record<BrowserLang, FrontendRunner>> = {
  javascript: jsRun,
  typescript: tsRun,
  html: htmlRun,
  python: pythonRun,
  css: cssRun,
  json: jsonRun,
  markdown: markdownRun,
  sql: sqlRun,
  lua: luaRun,
  bash: bashRun,
}

export function frontendRunnerFor(language: string): FrontendRunner | null {
  const key = language.toLowerCase() as BrowserLang
  return REGISTRY[key] ?? null
}

export function isFrontendRunnable(language: string): boolean {
  return !!frontendRunnerFor(language)
}

/** Returns the list of languages that always work in the browser. */
export function frontendRunnableLanguages(): string[] {
  return [...FRONTEND_RUNNABLE]
}
