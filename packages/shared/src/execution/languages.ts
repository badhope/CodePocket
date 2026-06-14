/**
 * 支持的编程语言元数据。
 * 与 [src/lib/execution/languages.ts](../../src/lib/execution/languages.ts) 保持一致，
 * 但去掉了 React/Monaco 相关字段（monacoLanguage 留作兼容）。
 */

export const SUPPORTED_LANGUAGES = [
  "python",
  "javascript",
  "typescript",
  "cpp",
  "c",
  "java",
  "rust",
  "go",
  "csharp",
  "php",
  "ruby",
  "kotlin",
  "swift",
  "scala",
  "bash",
  "lua",
  "sql",
  "html",
  "css",
] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

export type LanguageCategory = "scripting" | "compiled" | "jvm" | "dotnet" | "data" | "markup" | "shell";

export interface LanguageMeta {
  id: Language;
  label: string;
  /** 送往 Monaco editor 的语言 id */
  monacoLanguage: string;
  /** 送往 Piston 后端的 language id */
  pistonLanguage: string;
  defaultVersion: string;
  extensions: string[];
  icon: string;
  category: LanguageCategory;
  compiled: boolean;
  supportsStdin: boolean;
  runCommand: string;
  compileCommand?: string;
  /** 默认示例代码 */
  defaultCode: string;
}

const META: readonly LanguageMeta[] = [
  {
    id: "python",
    label: "Python",
    monacoLanguage: "python",
    pistonLanguage: "python",
    defaultVersion: "3.10.0",
    extensions: [".py"],
    icon: "code",
    category: "scripting",
    compiled: false,
    supportsStdin: true,
    runCommand: "python3 -",
    defaultCode: '# Python\nprint("Hello, DocForge!")\n\nfor i in range(3):\n    print(f"Count: {i}")\n',
  },
  {
    id: "javascript",
    label: "JavaScript",
    monacoLanguage: "javascript",
    pistonLanguage: "javascript",
    defaultVersion: "20.11.1",
    extensions: [".js", ".mjs"],
    icon: "file-code",
    category: "scripting",
    compiled: false,
    supportsStdin: true,
    runCommand: "node -",
    defaultCode:
      '// JavaScript\nconsole.log("Hello, DocForge!");\n\nfor (let i = 0; i < 3; i++) {\n  console.log(`Count: ${i}`);\n}\n',
  },
  {
    id: "typescript",
    label: "TypeScript",
    monacoLanguage: "typescript",
    pistonLanguage: "typescript",
    defaultVersion: "5.0.3",
    extensions: [".ts"],
    icon: "file-code-2",
    category: "scripting",
    compiled: false,
    supportsStdin: true,
    runCommand: "tsc --target es2020 --module commonjs --out-file /tmp/code.js && node /tmp/code.js",
    defaultCode:
      '// TypeScript\nconst greet = (name: string): string => `Hello, ${name}!`;\nconsole.log(greet("DocForge"));\n',
  },
  {
    id: "cpp",
    label: "C++",
    monacoLanguage: "cpp",
    pistonLanguage: "c++",
    defaultVersion: "10.2.0",
    extensions: [".cpp", ".cc"],
    icon: "file-cog",
    category: "compiled",
    compiled: true,
    supportsStdin: true,
    runCommand: "./code",
    compileCommand: "g++ -O2 -o code code.cpp",
    defaultCode:
      '// C++\n#include <iostream>\n\nint main() {\n    std::cout << "Hello, DocForge!" << std::endl;\n    return 0;\n}\n',
  },
  {
    id: "c",
    label: "C",
    monacoLanguage: "c",
    pistonLanguage: "c",
    defaultVersion: "10.2.0",
    extensions: [".c"],
    icon: "file-cog",
    category: "compiled",
    compiled: true,
    supportsStdin: true,
    runCommand: "./code",
    compileCommand: "gcc -O2 -o code code.c",
    defaultCode:
      '// C\n#include <stdio.h>\n\nint main(void) {\n    printf("Hello, DocForge!\\n");\n    return 0;\n}\n',
  },
  {
    id: "java",
    label: "Java",
    monacoLanguage: "java",
    pistonLanguage: "java",
    defaultVersion: "15.0.2",
    extensions: [".java"],
    icon: "coffee",
    category: "jvm",
    compiled: true,
    supportsStdin: true,
    runCommand: "java Main",
    compileCommand: "javac Main.java",
    defaultCode:
      '// Java\npublic class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, DocForge!");\n    }\n}\n',
  },
  {
    id: "rust",
    label: "Rust",
    monacoLanguage: "rust",
    pistonLanguage: "rust",
    defaultVersion: "1.68.2",
    extensions: [".rs"],
    icon: "cog",
    category: "compiled",
    compiled: true,
    supportsStdin: true,
    runCommand: "./code",
    compileCommand: "rustc -O code.rs -o code",
    defaultCode: '// Rust\nfn main() {\n    println!("Hello, DocForge!");\n}\n',
  },
  {
    id: "go",
    label: "Go",
    monacoLanguage: "go",
    pistonLanguage: "go",
    defaultVersion: "1.16.2",
    extensions: [".go"],
    icon: "hexagon",
    category: "compiled",
    compiled: true,
    supportsStdin: true,
    runCommand: "go run code.go",
    defaultCode:
      '// Go\npackage main\n\nimport "fmt"\n\nfunc main() {\n    fmt.Println("Hello, DocForge!")\n}\n',
  },
  {
    id: "csharp",
    label: "C#",
    monacoLanguage: "csharp",
    pistonLanguage: "csharp",
    defaultVersion: "6.12.0",
    extensions: [".cs"],
    icon: "hash",
    category: "dotnet",
    compiled: true,
    supportsStdin: true,
    runCommand: "mono code.exe",
    compileCommand: "mcs code.cs",
    defaultCode:
      '// C#\nusing System;\n\nclass Program {\n    static void Main() {\n        Console.WriteLine("Hello, DocForge!");\n    }\n}\n',
  },
  {
    id: "php",
    label: "PHP",
    monacoLanguage: "php",
    pistonLanguage: "php",
    defaultVersion: "8.2.3",
    extensions: [".php"],
    icon: "code",
    category: "scripting",
    compiled: false,
    supportsStdin: true,
    runCommand: "php code.php",
    defaultCode:
      '<?php\n// PHP\necho "Hello, DocForge!\\n";\nfor ($i = 0; $i < 3; $i++) {\n    echo "Count: $i\\n";\n}\n',
  },
  {
    id: "ruby",
    label: "Ruby",
    monacoLanguage: "ruby",
    pistonLanguage: "ruby",
    defaultVersion: "3.0.1",
    extensions: [".rb"],
    icon: "gem",
    category: "scripting",
    compiled: false,
    supportsStdin: true,
    runCommand: "ruby code.rb",
    defaultCode: '# Ruby\nputs "Hello, DocForge!"\n\n3.times do |i|\n  puts "Count: #{i}"\nend\n',
  },
  {
    id: "kotlin",
    label: "Kotlin",
    monacoLanguage: "kotlin",
    pistonLanguage: "kotlin",
    defaultVersion: "1.8.20",
    extensions: [".kt"],
    icon: "code",
    category: "jvm",
    compiled: true,
    supportsStdin: true,
    runCommand: "java -jar code.jar",
    compileCommand: "kotlinc code.kt -include-runtime -d code.jar",
    defaultCode: '// Kotlin\nfun main() {\n    println("Hello, DocForge!")\n}\n',
  },
  {
    id: "swift",
    label: "Swift",
    monacoLanguage: "swift",
    pistonLanguage: "swift",
    defaultVersion: "5.3.3",
    extensions: [".swift"],
    icon: "code",
    category: "compiled",
    compiled: true,
    supportsStdin: true,
    runCommand: "swift code.swift",
    defaultCode: '// Swift\nprint("Hello, DocForge!")\n',
  },
  {
    id: "scala",
    label: "Scala",
    monacoLanguage: "scala",
    pistonLanguage: "scala",
    defaultVersion: "3.2.2",
    extensions: [".scala"],
    icon: "mountain",
    category: "jvm",
    compiled: true,
    supportsStdin: true,
    runCommand: "scala code.scala",
    defaultCode: '// Scala\nobject Main extends App {\n  println("Hello, DocForge!")\n}\n',
  },
  {
    id: "bash",
    label: "Bash",
    monacoLanguage: "shell",
    pistonLanguage: "bash",
    defaultVersion: "5.2.0",
    extensions: [".sh"],
    icon: "terminal",
    category: "shell",
    compiled: false,
    supportsStdin: true,
    runCommand: "bash code.sh",
    defaultCode: '# Bash\necho "Hello, DocForge!"\n\nfor i in 1 2 3; do\n  echo "Count: $i"\ndone\n',
  },
  {
    id: "lua",
    label: "Lua",
    monacoLanguage: "lua",
    pistonLanguage: "lua",
    defaultVersion: "5.4.4",
    extensions: [".lua"],
    icon: "moon",
    category: "scripting",
    compiled: false,
    supportsStdin: true,
    runCommand: "lua code.lua",
    defaultCode: '-- Lua\nprint("Hello, DocForge!")\n\nfor i = 0, 2 do\n  print("Count: " .. i)\nend\n',
  },
  {
    id: "sql",
    label: "SQL",
    monacoLanguage: "sql",
    pistonLanguage: "sqlite3",
    defaultVersion: "3.36.0",
    extensions: [".sql"],
    icon: "database",
    category: "data",
    compiled: false,
    supportsStdin: true,
    runCommand: "sqlite3 :memory: < code.sql",
    defaultCode:
      '-- SQL\nSELECT "Hello, DocForge!" AS greeting;\n\nWITH RECURSIVE cnt(x) AS (\n  SELECT 0 UNION ALL SELECT x+1 FROM cnt WHERE x < 2\n)\nSELECT "Count: " || x FROM cnt;\n',
  },
  {
    id: "html",
    label: "HTML",
    monacoLanguage: "html",
    pistonLanguage: "html",
    defaultVersion: "5.0",
    extensions: [".html", ".htm"],
    icon: "file-code",
    category: "markup",
    compiled: false,
    supportsStdin: false,
    runCommand: "echo '(rendered in browser)'",
    defaultCode:
      "<!-- HTML -->\n<!DOCTYPE html>\n<html>\n<head><title>Hello</title></head>\n<body>\n  <h1>Hello, DocForge!</h1>\n</body>\n</html>\n",
  },
  {
    id: "css",
    label: "CSS",
    monacoLanguage: "css",
    pistonLanguage: "css",
    defaultVersion: "3",
    extensions: [".css"],
    icon: "palette",
    category: "markup",
    compiled: false,
    supportsStdin: false,
    runCommand: "echo '(rendered in browser)'",
    defaultCode: "/* CSS */\nbody {\n  font-family: system-ui, sans-serif;\n  background: #fafafa;\n}\n",
  },
];

const BY_ID = new Map<string, LanguageMeta>(META.map((m) => [m.id, m]));

export function listLanguages(): readonly LanguageMeta[] {
  return META;
}

export function getLanguage(id: string): LanguageMeta | undefined {
  return BY_ID.get(id);
}

/** 推断语言（从文件名扩展名） */
export function inferLanguageFromFilename(filename: string): Language | undefined {
  const lower = filename.toLowerCase();
  for (const m of META) {
    if (m.extensions.some((ext) => lower.endsWith(ext))) return m.id;
  }
  return undefined;
}
