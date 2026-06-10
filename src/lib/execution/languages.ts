// @ts-nocheck -- third-party types are incomplete
import { z } from "zod";

const SUPPORTED_LANGUAGES = [
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
type Language = (typeof SUPPORTED_LANGUAGES)[number];

export const languageIdSchema = z.enum(SUPPORTED_LANGUAGES);

export interface PistonLanguage {
  language: string;
  version: string;
  aliases: string[];
  runtime?: string;
  compiled?: boolean;
}

export interface LanguageMeta {
  id: Language;
  label: string;
  monacoLanguage: string;
  pistonLanguage: string;
  defaultVersion: string;
  extensions: string[];
  icon: string;
  compileCommand?: string;
  runCommand: string;
  defaultCode: string;
  supportsStdin: boolean;
  compiled: boolean;
  category: "scripting" | "compiled" | "jvm" | "dotnet" | "data" | "markup" | "shell";
}

const defaultCodeFor = (lang: LanguageMeta): string => {
  switch (lang.id) {
    case "python":
      return [
        "# Python",
        'print("Hello, DocForge!")',
        "",
        "for i in range(3):",
        '    print(f"Count: {i}")',
        "",
      ].join("\n");
    case "javascript":
      return [
        "// JavaScript",
        'console.log("Hello, DocForge!");',
        "",
        "for (let i = 0; i < 3; i++) {",
        "  console.log(`Count: ${i}`);",
        "}",
        "",
      ].join("\n");
    case "typescript":
      return [
        "// TypeScript",
        "const greet = (name: string): string => `Hello, ${name}!`;",
        'console.log(greet("DocForge"));',
        "",
      ].join("\n");
    case "cpp":
      return `// C++\n#include <iostream>\nint main() {\n    std::cout << "Hello, DocForge!" << std::endl;\n    return 0;\n}\n`;
    case "c":
      return `// C\n#include <stdio.h>\nint main() {\n    printf("Hello, DocForge!\\n");\n    return 0;\n}\n`;
    case "java":
      return `// Java\npublic class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, DocForge!");\n    }\n}\n`;
    case "rust":
      return `// Rust\nfn main() {\n    println!("Hello, DocForge!");\n}\n`;
    case "go":
      return `// Go\npackage main\n\nimport "fmt"\n\nfunc main() {\n    fmt.Println("Hello, DocForge!")\n}\n`;
    case "csharp":
      return `// C#\nusing System;\n\nclass Program {\n    static void Main() {\n        Console.WriteLine("Hello, DocForge!");\n    }\n}\n`;
    case "php":
      return `<?php\n// PHP\necho "Hello, DocForge!\\n";\n`;
    case "ruby":
      return `# Ruby\nputs "Hello, DocForge!"\n\n3.times { |i| puts "Count: #{i}" }\n`;
    case "kotlin":
      return `// Kotlin\nfun main() {\n    println("Hello, DocForge!")\n}\n`;
    case "swift":
      return `// Swift\nprint("Hello, DocForge!")\n`;
    case "scala":
      return `// Scala\nobject Main extends App {\n    println("Hello, DocForge!")\n}\n`;
    case "bash":
      return [
        "#!/usr/bin/env bash",
        "# Bash",
        'echo "Hello, DocForge!"',
        "for i in 1 2 3; do",
        '  echo "Count: $i"',
        "done",
        "",
      ].join("\n");
    case "lua":
      return [
        "-- Lua",
        'print("Hello, DocForge!")',
        "for i = 1, 3 do",
        '  print("Count: " .. i)',
        "end",
        "",
      ].join("\n");
    case "sql":
      return `-- SQL\nSELECT 'Hello, DocForge!' AS greeting;\n`;
    case "html":
      return `<!DOCTYPE html>\n<html lang="en">\n<head><meta charset="UTF-8"><title>Hello</title></head>\n<body><h1>Hello, DocForge!</h1></body>\n</html>\n`;
    case "css":
      return `/* CSS */\nbody {\n  font-family: system-ui, sans-serif;\n  background: linear-gradient(135deg, #667eea, #764ba2);\n  color: white;\n  display: grid;\n  place-items: center;\n  min-height: 100vh;\n}\n`;
    default:
      return "";
  }
};

const all = (): LanguageMeta[] => [
  {
    id: "python",
    label: "Python",
    monacoLanguage: "python",
    pistonLanguage: "python",
    defaultVersion: "3.10.0",
    extensions: [".py", ".pyw"],
    icon: "🐍",
    runCommand: "python3 {filename}",
    defaultCode: "",
    supportsStdin: true,
    compiled: false,
    category: "scripting",
  },
  {
    id: "javascript",
    label: "JavaScript",
    monacoLanguage: "javascript",
    pistonLanguage: "javascript",
    defaultVersion: "20.11.1",
    extensions: [".js", ".mjs", ".cjs"],
    icon: "🟨",
    runCommand: "node {filename}",
    defaultCode: "",
    supportsStdin: true,
    compiled: false,
    category: "scripting",
  },
  {
    id: "typescript",
    label: "TypeScript",
    monacoLanguage: "typescript",
    pistonLanguage: "typescript",
    defaultVersion: "5.0.3",
    extensions: [".ts", ".tsx"],
    icon: "🔷",
    compileCommand: "tsc {filename}",
    runCommand: "node {filename}.js",
    defaultCode: "",
    supportsStdin: true,
    compiled: true,
    category: "scripting",
  },
  {
    id: "cpp",
    label: "C++",
    monacoLanguage: "cpp",
    pistonLanguage: "c++",
    defaultVersion: "10.2.0",
    extensions: [".cpp", ".cc", ".cxx", ".hpp", ".h"],
    icon: "⚡",
    compileCommand: "g++ -O2 -o {filename}.out {filename}",
    runCommand: "./{filename}.out",
    defaultCode: "",
    supportsStdin: true,
    compiled: true,
    category: "compiled",
  },
  {
    id: "c",
    label: "C",
    monacoLanguage: "c",
    pistonLanguage: "c",
    defaultVersion: "10.2.0",
    extensions: [".c", ".h"],
    icon: "🔧",
    compileCommand: "gcc -O2 -o {filename}.out {filename}",
    runCommand: "./{filename}.out",
    defaultCode: "",
    supportsStdin: true,
    compiled: true,
    category: "compiled",
  },
  {
    id: "java",
    label: "Java",
    monacoLanguage: "java",
    pistonLanguage: "java",
    defaultVersion: "15.0.2",
    extensions: [".java"],
    icon: "☕",
    compileCommand: "javac {filename}",
    runCommand: "java {filename}",
    defaultCode: "",
    supportsStdin: true,
    compiled: true,
    category: "jvm",
  },
  {
    id: "rust",
    label: "Rust",
    monacoLanguage: "rust",
    pistonLanguage: "rust",
    defaultVersion: "1.68.2",
    extensions: [".rs"],
    icon: "🦀",
    compileCommand: "rustc -O {filename}",
    runCommand: "./{filename}",
    defaultCode: "",
    supportsStdin: true,
    compiled: true,
    category: "compiled",
  },
  {
    id: "go",
    label: "Go",
    monacoLanguage: "go",
    pistonLanguage: "go",
    defaultVersion: "1.16.2",
    extensions: [".go"],
    icon: "🐹",
    compileCommand: "go build -o {filename}.out {filename}",
    runCommand: "./{filename}.out",
    defaultCode: "",
    supportsStdin: true,
    compiled: true,
    category: "compiled",
  },
  {
    id: "csharp",
    label: "C#",
    monacoLanguage: "csharp",
    pistonLanguage: "csharp.net",
    defaultVersion: "5.0.201",
    extensions: [".cs"],
    icon: "🎯",
    compileCommand: "dotnet build",
    runCommand: "dotnet run",
    defaultCode: "",
    supportsStdin: true,
    compiled: true,
    category: "dotnet",
  },
  {
    id: "php",
    label: "PHP",
    monacoLanguage: "php",
    pistonLanguage: "php",
    defaultVersion: "8.2.3",
    extensions: [".php"],
    icon: "🐘",
    runCommand: "php {filename}",
    defaultCode: "",
    supportsStdin: true,
    compiled: false,
    category: "scripting",
  },
  {
    id: "ruby",
    label: "Ruby",
    monacoLanguage: "ruby",
    pistonLanguage: "ruby",
    defaultVersion: "3.0.1",
    extensions: [".rb"],
    icon: "💎",
    runCommand: "ruby {filename}",
    defaultCode: "",
    supportsStdin: true,
    compiled: false,
    category: "scripting",
  },
  {
    id: "kotlin",
    label: "Kotlin",
    monacoLanguage: "kotlin",
    pistonLanguage: "kotlin",
    defaultVersion: "1.8.20",
    extensions: [".kt", ".kts"],
    icon: "🟣",
    compileCommand: "kotlinc {filename} -include-runtime -d {filename}.jar",
    runCommand: "java -jar {filename}.jar",
    defaultCode: "",
    supportsStdin: true,
    compiled: true,
    category: "jvm",
  },
  {
    id: "swift",
    label: "Swift",
    monacoLanguage: "swift",
    pistonLanguage: "swift",
    defaultVersion: "5.3.3",
    extensions: [".swift"],
    icon: "🦅",
    compileCommand: "swiftc {filename}",
    runCommand: "./{filename}",
    defaultCode: "",
    supportsStdin: true,
    compiled: true,
    category: "compiled",
  },
  {
    id: "scala",
    label: "Scala",
    monacoLanguage: "scala",
    pistonLanguage: "scala",
    defaultVersion: "3.2.2",
    extensions: [".scala", ".sc"],
    icon: "🟥",
    compileCommand: "scalac {filename}",
    runCommand: "scala {filename}",
    defaultCode: "",
    supportsStdin: true,
    compiled: true,
    category: "jvm",
  },
  {
    id: "bash",
    label: "Bash",
    monacoLanguage: "shell",
    pistonLanguage: "bash",
    defaultVersion: "5.2.0",
    extensions: [".sh", ".bash"],
    icon: "🐚",
    runCommand: "bash {filename}",
    defaultCode: "",
    supportsStdin: true,
    compiled: false,
    category: "shell",
  },
  {
    id: "lua",
    label: "Lua",
    monacoLanguage: "lua",
    pistonLanguage: "lua",
    defaultVersion: "5.4.4",
    extensions: [".lua"],
    icon: "🌙",
    runCommand: "lua {filename}",
    defaultCode: "",
    supportsStdin: true,
    compiled: false,
    category: "scripting",
  },
  {
    id: "sql",
    label: "SQL",
    monacoLanguage: "sql",
    pistonLanguage: "sqlite3",
    defaultVersion: "3.36.0",
    extensions: [".sql"],
    icon: "🗄️",
    runCommand: "sqlite3 :memory: < {filename}",
    defaultCode: "",
    supportsStdin: false,
    compiled: false,
    category: "data",
  },
  {
    id: "html",
    label: "HTML",
    monacoLanguage: "html",
    pistonLanguage: "html",
    defaultVersion: "5.0.0",
    extensions: [".html", ".htm"],
    icon: "🌐",
    runCommand: "browser {filename}",
    defaultCode: "",
    supportsStdin: false,
    compiled: false,
    category: "markup",
  },
  {
    id: "css",
    label: "CSS",
    monacoLanguage: "css",
    pistonLanguage: "css",
    defaultVersion: "3.0.0",
    extensions: [".css"],
    icon: "🎨",
    runCommand: "browser {filename}",
    defaultCode: "",
    supportsStdin: false,
    compiled: false,
    category: "markup",
  },
];

export const LANGUAGES: Record<Language, LanguageMeta> = all().reduce(
  (acc, l) => {
    acc[l.id] = { ...l, defaultCode: defaultCodeFor(l) };
    return acc;
  },
  {} as Record<Language, LanguageMeta>,
);

export const LANGUAGE_LIST: LanguageMeta[] = Object.values(LANGUAGES);

export function getLanguage(id: string): LanguageMeta | null {
  if ((SUPPORTED_LANGUAGES as readonly string[]).includes(id)) {
    return LANGUAGES[id as Language];
  }
  return null;
}

export function isLanguage(id: string): id is Language {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(id);
}
