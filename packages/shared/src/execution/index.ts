/**
 * 执行模块 — 语言信息和执行后端选择
 */

export interface LanguageInfo {
  id: string;
  label: string;
  icon: string;
  extensions: string[];
  defaultCode?: string;
}

export interface LanguageMeta extends LanguageInfo {
  version?: string;
  runtime?: string;
}

export const LANGUAGES: LanguageMeta[] = [
  {
    id: "javascript",
    label: "JavaScript",
    icon: "js",
    extensions: [".js"],
    defaultCode: 'console.log("Hello, World!");',
  },
  {
    id: "typescript",
    label: "TypeScript",
    icon: "ts",
    extensions: [".ts"],
    defaultCode: 'const msg: string = "Hello, World!";\nconsole.log(msg);',
  },
  {
    id: "python",
    label: "Python",
    icon: "py",
    extensions: [".py"],
    defaultCode: 'print("Hello, World!")',
  },
  {
    id: "java",
    label: "Java",
    icon: "java",
    extensions: [".java"],
    defaultCode: 'public class Main {\n  public static void main(String[] args) {\n    System.out.println("Hello, World!");\n  }\n}',
  },
  {
    id: "csharp",
    label: "C#",
    icon: "cs",
    extensions: [".cs"],
    defaultCode: 'using System;\nclass Program {\n  static void Main() {\n    Console.WriteLine("Hello, World!");\n  }\n}',
  },
  {
    id: "cpp",
    label: "C++",
    icon: "cpp",
    extensions: [".cpp"],
    defaultCode: '#include <iostream>\nint main() {\n  std::cout << "Hello, World!" << std::endl;\n  return 0;\n}',
  },
  {
    id: "go",
    label: "Go",
    icon: "go",
    extensions: [".go"],
    defaultCode: 'package main\nimport "fmt"\nfunc main() {\n  fmt.Println("Hello, World!")\n}',
  },
  {
    id: "rust",
    label: "Rust",
    icon: "rust",
    extensions: [".rs"],
    defaultCode: 'fn main() {\n  println!("Hello, World!");\n}',
  },
  {
    id: "ruby",
    label: "Ruby",
    icon: "rb",
    extensions: [".rb"],
    defaultCode: 'puts "Hello, World!"',
  },
  {
    id: "php",
    label: "PHP",
    icon: "php",
    extensions: [".php"],
    defaultCode: '<?php\necho "Hello, World!";\n?>',
  },
  {
    id: "swift",
    label: "Swift",
    icon: "swift",
    extensions: [".swift"],
    defaultCode: 'print("Hello, World!")',
  },
  {
    id: "kotlin",
    label: "Kotlin",
    icon: "kt",
    extensions: [".kt"],
    defaultCode: 'fun main() {\n  println("Hello, World!")\n}',
  },
  {
    id: "scala",
    label: "Scala",
    icon: "scala",
    extensions: [".scala"],
    defaultCode: 'object Main extends App {\n  println("Hello, World!")\n}',
  },
  {
    id: "lua",
    label: "Lua",
    icon: "lua",
    extensions: [".lua"],
    defaultCode: 'print("Hello, World!")',
  },
  {
    id: "r",
    label: "R",
    icon: "r",
    extensions: [".r"],
    defaultCode: 'print("Hello, World!")',
  },
  {
    id: "perl",
    label: "Perl",
    icon: "pl",
    extensions: [".pl"],
    defaultCode: 'print "Hello, World!\\n";',
  },
  {
    id: "bash",
    label: "Bash",
    icon: "bash",
    extensions: [".sh"],
    defaultCode: '#!/bin/bash\necho "Hello, World!"',
  },
  {
    id: "sql",
    label: "SQL",
    icon: "sql",
    extensions: [".sql"],
    defaultCode: 'SELECT "Hello, World!";',
  },
  {
    id: "powershell",
    label: "PowerShell",
    icon: "ps",
    extensions: [".ps1"],
    defaultCode: 'Write-Host "Hello, World!"',
  },
];

export function listLanguages(): LanguageMeta[] {
  return LANGUAGES;
}

export function getLanguage(id: string): LanguageMeta | undefined {
  return LANGUAGES.find((l) => l.id === id);
}

// ─── 执行后端 ─────────────────────────────────────────────

export interface ExecutionEvent {
  type: "run-output" | "run-end" | "error";
  stream?: "stdout" | "stderr";
  chunk?: string;
  result?: { code: number };
  message?: string;
}

export interface ExecutionRequest {
  language: string;
  files: Array<{ name: string; content: string }>;
  stdin?: string;
}

export interface ExecutionBackend {
  id: string;
  stream(request: ExecutionRequest, signal?: AbortSignal): AsyncIterable<ExecutionEvent>;
}

export class PistonBackend implements ExecutionBackend {
  id = "piston";
  private apiUrl: string;

  constructor(apiUrl = "https://emkc.org/api/v2/piston") {
    this.apiUrl = apiUrl;
  }

  async *stream(request: ExecutionRequest, signal?: AbortSignal): AsyncIterable<ExecutionEvent> {
    try {
      const res = await fetch(`${this.apiUrl}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language: request.language,
          version: "*",
          files: request.files,
          stdin: request.stdin ?? "",
        }),
        signal,
      });
      
      const data = await res.json();
      
      if (data.run?.output) {
        yield {
          type: "run-output",
          stream: "stdout",
          chunk: data.run.output,
        };
      }
      
      yield {
        type: "run-end",
        result: { code: data.run?.code ?? 0 },
      };
    } catch (e) {
      if ((e as Error).name === "AbortError") {
        return;
      }
      yield {
        type: "error",
        message: (e as Error).message,
      };
    }
  }
}

export class PyodideBackend implements ExecutionBackend {
  id = "pyodide";

  async *stream(request: ExecutionRequest, signal?: AbortSignal): AsyncIterable<ExecutionEvent> {
    yield {
      type: "error",
      message: "Pyodide backend not available in this environment",
    };
  }
}

export interface WorkerBackendOptions {
  workerUrl?: URL;
}

export class WorkerBackend implements ExecutionBackend {
  id = "worker";
  private workerUrl?: URL;

  constructor(options: WorkerBackendOptions = {}) {
    this.workerUrl = options.workerUrl;
  }

  async *stream(request: ExecutionRequest, signal?: AbortSignal): AsyncIterable<ExecutionEvent> {
    if (request.language !== "javascript" && request.language !== "typescript") {
      yield {
        type: "error",
        message: `Worker backend does not support ${request.language}`,
      };
      return;
    }

    try {
      const code = request.files[0]?.content ?? "";
      const result = eval(code);
      yield {
        type: "run-output",
        stream: "stdout",
        chunk: String(result),
      };
      yield {
        type: "run-end",
        result: { code: 0 },
      };
    } catch (e) {
      if ((e as Error).name === "AbortError") {
        return;
      }
      yield {
        type: "error",
        message: (e as Error).message,
      };
    }
  }
}

export interface SelectBackendOptions {
  language: string;
  snapshot: { available: boolean };
  piston: PistonBackend;
  pyodide: PyodideBackend;
  worker: WorkerBackend;
}

export function selectBackend(options: SelectBackendOptions): ExecutionBackend | null {
  const { language, snapshot, piston, pyodide, worker } = options;
  
  // Python 优先使用 Pyodide
  if (language === "python") {
    return pyodide;
  }
  
  // JS/TS 使用 Worker
  if (language === "javascript" || language === "typescript") {
    return worker;
  }
  
  // 其他语言使用 Piston（需要后端）
  if (snapshot.available) {
    return piston;
  }
  
  return null;
}

export class AbortError extends Error {
  constructor(message = "Aborted") {
    super(message);
    this.name = "AbortError";
  }
}
