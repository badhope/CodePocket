/**
 * Web Worker 沙盒：在浏览器中安全执行 JS / TS / Lua / SQL 代码。
 *
 * 协议（与 packages/shared/src/execution/backends/worker.ts 对齐）：
 *   接收: { type: "run", language, files, stdin }
 *   发送: { type: "chunk", stream: "stdout"|"stderr", data }
 *         { type: "ok", result }
 *         { type: "err", error }
 */

const TIMEOUT_MS = 10_000;

/* ---------- helpers ---------- */

function send(msg) {
  self.postMessage(msg);
}

function sendChunk(stream, data) {
  send({ type: "chunk", stream, data });
}

function sendOk(result) {
  send({ type: "ok", result });
}

function sendErr(error) {
  send({ type: "err", error });
}

/* ---------- JavaScript ---------- */

function runJavaScript(code, stdin) {
  let stdoutBuf = "";
  let stderrBuf = "";

  function formatArg(a) {
    if (a === undefined) return "undefined";
    if (a === null) return "null";
    if (typeof a === "string") return a;
    try {
      return JSON.stringify(a);
    } catch {
      return String(a);
    }
  }

  const fakeConsole = {
    log: (...args) => {
      const output = args.map(formatArg).join(" ") + "\n";
      stdoutBuf += output;
      sendChunk("stdout", output);
    },
    error: (...args) => {
      const output = args.map(formatArg).join(" ") + "\n";
      stderrBuf += output;
      sendChunk("stderr", output);
    },
    warn: (...args) => {
      const output = args.map(formatArg).join(" ") + "\n";
      stderrBuf += output;
      sendChunk("stderr", output);
    },
    info: (...args) => {
      const output = args.map(formatArg).join(" ") + "\n";
      stdoutBuf += output;
      sendChunk("stdout", output);
    },
    debug: (...args) => {
      const output = args.map(formatArg).join(" ") + "\n";
      stdoutBuf += output;
      sendChunk("stdout", output);
    },
  };

  // eslint-disable-next-line no-new-func
  const fn = new Function("console", "stdin", code);
  fn(fakeConsole, stdin);

  return { stdout: stdoutBuf, stderr: stderrBuf, code: 0 };
}

/* ---------- TypeScript (simple transpile) ---------- */

function stripTypeAnnotations(code) {
  // Very lightweight TS → JS: remove type annotations, interfaces, type aliases, enums.
  // This is intentionally simple; for production use the TypeScript compiler API.
  let out = code;

  // Remove import type / export type statements
  out = out.replace(/^\s*(import|export)\s+type\s+.*?;?\s*$/gm, "");

  // Remove interface / type alias blocks
  out = out.replace(
    /^\s*(export\s+)?(interface|type)\s+\w+[\s\S]*?(?=\n\s*\n|\n(?:export|import|const|let|var|function|class|async|enum|declare|namespace|module)\b|\n*$)/gm,
    "",
  );

  // Remove type assertions: `as Type`
  out = out.replace(/\s+as\s+\w[\w.<>\[\]|&,\s]*/g, "");

  // Remove return type annotations on functions: `): Type {` → `) {`
  out = out.replace(/\)\s*:\s*[\w<>\[\]|&,\s]+?\s*\{/g, ") {");

  // Remove parameter type annotations: `(x: Type)` → `(x)`
  out = out.replace(/(\w+)\s*:\s*[\w<>\[\]|&,\s]+?([,\)])/g, "$1$2");

  // Remove generic type parameters on function calls / declarations
  out = out.replace(/<[\w<>\[\]|&,\s]+>/g, "");

  // Remove `declare` statements
  out = out.replace(/^\s*declare\s+.*?;?\s*$/gm, "");

  // Remove enum blocks (convert to plain object)
  out = out.replace(/^\s*(export\s+)?enum\s+(\w+)\s*\{([\s\S]*?)\}/gm, (_match, _exp, name, body) => {
    const entries = body
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((entry, i) => {
        const [k, v] = entry.split("=").map((s) => s.trim());
        return v ? `${k}: ${v}` : `${k}: ${i}`;
      });
    return `const ${name} = { ${entries.join(", ")} };`;
  });

  return out;
}

function runTypeScript(code, stdin) {
  const jsCode = stripTypeAnnotations(code);
  return runJavaScript(jsCode, stdin);
}

/* ---------- Lua ---------- */

function runLua(_code, _stdin) {
  return {
    stdout: "",
    stderr: "Language lua requires backend support",
    code: 1,
  };
}

/* ---------- SQL ---------- */

function runSQL(_code, _stdin) {
  return {
    stdout: "",
    stderr: "Language sql requires backend support",
    code: 1,
  };
}

/* ---------- main handler ---------- */

self.addEventListener("message", (e) => {
  const msg = e.data;
  if (!msg || msg.type !== "run") return;

  const { language, files, stdin } = msg;
  const code = (files && files[0] && files[0].content) || "";

  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error("Execution timed out (10s)")), TIMEOUT_MS);
  });

  const execPromise = new Promise((resolve) => {
    let result;
    switch (language) {
      case "javascript":
        result = runJavaScript(code, stdin || "");
        break;
      case "typescript":
        result = runTypeScript(code, stdin || "");
        break;
      case "lua":
        result = runLua(code, stdin || "");
        break;
      case "sql":
        result = runSQL(code, stdin || "");
        break;
      default:
        result = { stdout: "", stderr: `Unsupported language: ${language}`, code: 1 };
    }
    resolve(result);
  });

  Promise.race([execPromise, timeoutPromise])
    .then((result) => {
      clearTimeout(timer);
      if (result.stderr) sendChunk("stderr", result.stderr);
      sendOk({
        language,
        version: "worker",
        run: {
          stdout: result.stdout || "",
          stderr: result.stderr || "",
          code: result.code ?? 0,
          output: (result.stdout || "") + (result.stderr || ""),
        },
      });
    })
    .catch((err) => {
      clearTimeout(timer);
      sendErr(err.message || String(err));
    });
});
