/**
 * 本地代码执行服务
 * 替代外部 Piston API，在本地安全执行代码
 */

import express from "express";
import { spawn } from "child_process";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 2000;

// 支持的语言和对应的执行命令
const LANGUAGES = {
  javascript: {
    cmd: "node",
    args: ["-e"],
    timeout: 10000,
  },
  python: {
    cmd: "python3",
    args: ["-c"],
    timeout: 10000,
  },
  typescript: {
    cmd: "node",
    args: ["-e"],
    timeout: 10000,
    preprocess: (code) => {
      // 简单的 TypeScript 转 JavaScript（移除类型注解）
      return code
        .replace(/:\s*\w+(\[\])?/g, "")
        .replace(/interface\s+\w+\s*{[^}]*}/g, "")
        .replace(/type\s+\w+\s*=\s*[^;]+;/g, "");
    },
  },
};

app.post("/api/v2/execute", async (req, res) => {
  const { language, files, stdin, code: directCode } = req.body;

  const langConfig = LANGUAGES[language];
  if (!langConfig) {
    return res.status(400).json({
      error: `Language ${language} not supported`,
      supported: Object.keys(LANGUAGES),
    });
  }

  // 支持两种入参：files[0].content（Piston 风格）或直接的 code 字段
  const code = directCode || files?.[0]?.content || "";
  const processedCode = langConfig.preprocess ? langConfig.preprocess(code) : code;

  try {
    const result = await executeCode(
      langConfig.cmd,
      langConfig.args,
      processedCode,
      stdin,
      langConfig.timeout,
    );
    res.json({
      language,
      version: "local",
      run: result,
    });
  } catch (error) {
    res.status(500).json({
      error: "Execution failed",
      message: error.message,
    });
  }
});

app.get("/api/v2/runtimes", (req, res) => {
  const runtimes = Object.keys(LANGUAGES).map((lang) => ({
    language: lang,
    version: "local",
    aliases: [],
  }));
  res.json(runtimes);
});

function executeCode(cmd, args, code, stdin = "", timeout = 10000) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, [...args, code]);

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill("SIGKILL");
      reject(new Error("Execution timeout"));
    }, timeout);

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      clearTimeout(timer);
      if (timedOut) return;

      resolve({
        stdout,
        stderr,
        code,
        signal: null,
      });
    });

    proc.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });

    if (stdin) {
      proc.stdin.write(stdin);
      proc.stdin.end();
    }
  });
}

app.listen(PORT, () => {
  console.log(`Local code execution service running on port ${PORT}`);
  console.log(`Supported languages: ${Object.keys(LANGUAGES).join(", ")}`);
});
