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

type BrowserLang = "javascript" | "typescript" | "html" | "python";

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
// Public dispatch
// ---------------------------------------------------------------------------

const REGISTRY: Partial<Record<BrowserLang, FrontendRunner>> = {
  javascript: jsRun,
  typescript: tsRun,
  html: htmlRun,
  python: pythonRun,
};

export function frontendRunnerFor(language: string): FrontendRunner | null {
  const key = language.toLowerCase() as BrowserLang;
  return REGISTRY[key] ?? null;
}

export function isFrontendRunnable(language: string): boolean {
  return !!frontendRunnerFor(language);
}
