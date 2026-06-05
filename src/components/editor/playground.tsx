// @ts-nocheck -- third-party types are incomplete
"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Play,
  Square,
  Trash2,
  Copy,
  Share2,
  Package,
  FileCode2,
  Plus,
  X,
  Terminal,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { LANGUAGES, getLanguage, type LanguageMeta } from "@/lib/execution";
import { cn } from "@/lib/utils";
import { LANGUAGE_LIST } from "@/lib/execution";
import { ECOSYSTEMS, type EcosystemConfig, type PackageEcosystem } from "@/lib/packages";
import { useBackendStatus } from "@/lib/system/backend-status";
import { useFeatureGate } from "@/lib/system/feature-gate";
import { LockedOverlay } from "@/components/system/locked-overlay";

// ─── Dynamic imports ────────────────────────────────────────────

const CodeEditor = dynamic(() => import("@/components/editor/code-editor").then((m) => m.CodeEditor), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full" />,
});

// ─── Types ───────────────────────────────────────────────────────

interface PlaygroundFile {
  name: string;
  content: string;
}

type SidePanel = "templates" | "packages";

interface OutputLine {
  type: "info" | "out" | "err" | "warn";
  text: string;
}

// ─── Language → Ecosystem mapping ────────────────────────────────

const LANG_ECOSYSTEM: Partial<Record<string, PackageEcosystem>> = {
  python: "pip",
  javascript: "npm",
  typescript: "npm",
  rust: "cargo",
  go: "go",
  java: "maven",
  kotlin: "maven",
  ruby: "gem",
  php: "pip",
};

function getEcosystemForLanguage(langId: string): EcosystemConfig | null {
  const eco = LANG_ECOSYSTEM[langId];
  if (!eco) return null;
  return ECOSYSTEMS[eco] ?? null;
}

function getDefaultFilename(lang: LanguageMeta): string {
  const extMap: Record<string, string> = {
    python: "main.py",
    javascript: "main.js",
    typescript: "main.ts",
    cpp: "main.cpp",
    c: "main.c",
    java: "Main.java",
    rust: "main.rs",
    go: "main.go",
    csharp: "Program.cs",
    php: "index.php",
    ruby: "main.rb",
    kotlin: "Main.kt",
    swift: "main.swift",
    scala: "Main.scala",
    bash: "main.sh",
    lua: "main.lua",
    sql: "query.sql",
    html: "index.html",
    css: "style.css",
  };
  return extMap[lang.id] ?? "main.txt";
}

// ─── URL Share Codec ─────────────────────────────────────────────

function encodeShare(data: { code: string; lang: string }): string {
  try {
    return btoa(encodeURIComponent(JSON.stringify(data)));
  } catch {
    return "";
  }
}

function decodeShare(hash: string): { code: string; lang: string } | null {
  try {
    return JSON.parse(decodeURIComponent(atob(hash)));
  } catch {
    return null;
  }
}

// ─── Templates ───────────────────────────────────────────────────

const TEMPLATES: Record<string, { label: string; code: string }[]> = {
  python: [
    { label: "Hello World", code: 'print("Hello, OnlineCode!")' },
    {
      label: "Fibonacci",
      code: "def fib(n):\n    a, b = 0, 1\n    for _ in range(n):\n        print(a)\n        a, b = b, a + b\n\nfib(10)",
    },
    {
      label: "Prime Check",
      code: "def is_prime(n):\n    if n < 2:\n        return False\n    for i in range(2, int(n**0.5) + 1):\n        if n % i == 0:\n            return False\n    return True\n\nfor n in range(1, 51):\n    if is_prime(n):\n        print(n)",
    },
    {
      label: "List Comprehension",
      code: 'evens = [x for x in range(20) if x % 2 == 0]\nprint("Even numbers:", evens)\n\nsquares = {x: x**2 for x in range(6)}\nprint("Squares:", squares)',
    },
    {
      label: "File Read",
      code: 'with open("data.txt", "w") as f:\n    f.write("Hello\\nWorld\\nPython")\n\nwith open("data.txt", "r") as f:\n    for line in f:\n        print(line.strip())',
    },
  ],
  javascript: [
    { label: "Hello World", code: 'console.log("Hello, OnlineCode!");' },
    {
      label: "Array Methods",
      code: 'const nums = [1, 2, 3, 4, 5];\nconst doubled = nums.map(n => n * 2);\nconst sum = nums.reduce((a, b) => a + b, 0);\nconsole.log("Doubled:", doubled);\nconsole.log("Sum:", sum);',
    },
    {
      label: "Async/Await",
      code: 'async function fetchData() {\n  const data = await Promise.resolve({ id: 1, name: "test" });\n  console.log("Data:", data);\n}\nfetchData();',
    },
    {
      label: "Class Example",
      code: "class Calculator {\n  add(a, b) { return a + b; }\n  multiply(a, b) { return a * b; }\n}\nconst calc = new Calculator();\nconsole.log(calc.add(5, 3));\nconsole.log(calc.multiply(5, 3));",
    },
  ],
  typescript: [
    {
      label: "Hello World",
      code: 'const greet = (name: string): string => `Hello, ${name}!`;\nconsole.log(greet("OnlineCode"));',
    },
    {
      label: "Interface",
      code: 'interface User {\n  id: number;\n  name: string;\n  email?: string;\n}\nconst user: User = { id: 1, name: "Alice" };\nconsole.log(user);',
    },
    {
      label: "Generic Function",
      code: 'function first<T>(arr: T[]): T | undefined {\n  return arr[0];\n}\nconsole.log(first([1, 2, 3]));\nconsole.log(first(["a", "b"]));',
    },
  ],
  cpp: [
    {
      label: "Hello World",
      code: '#include <iostream>\nint main() {\n    std::cout << "Hello, OnlineCode!" << std::endl;\n    return 0;\n}',
    },
    {
      label: "Vector Sort",
      code: '#include <iostream>\n#include <vector>\n#include <algorithm>\nint main() {\n    std::vector<int> v = {3, 1, 4, 1, 5, 9};\n    std::sort(v.begin(), v.end());\n    for (int x : v) std::cout << x << " ";\n    return 0;\n}',
    },
  ],
  rust: [
    { label: "Hello World", code: 'fn main() {\n    println!("Hello, OnlineCode!");\n}' },
    {
      label: "Struct + impl",
      code: 'struct Point { x: f64, y: f64 }\nimpl Point {\n    fn distance(&self, other: &Point) -> f64 {\n        ((self.x - other.x).powi(2) + (self.y - other.y).powi(2)).sqrt()\n    }\n}\nfn main() {\n    let a = Point { x: 0.0, y: 0.0 };\n    let b = Point { x: 3.0, y: 4.0 };\n    println!("Distance: {}", a.distance(&b));\n}',
    },
  ],
  go: [
    {
      label: "Hello World",
      code: 'package main\n\nimport "fmt"\n\nfunc main() {\n    fmt.Println("Hello, OnlineCode!")\n}',
    },
    {
      label: "Goroutine",
      code: 'package main\n\nimport ("fmt"; "time")\n\nfunc worker(id int) {\n    for i := 0; i < 3; i++ {\n        fmt.Printf("Worker %d: %d\\n", id, i)\n        time.Sleep(100 * time.Millisecond)\n    }\n}\nfunc main() {\n    go worker(1)\n    go worker(2)\n    time.Sleep(500 * time.Millisecond)\n}',
    },
  ],
};

// ─── Main Component ──────────────────────────────────────────────

export interface PlaygroundProps {
  initialCode?: string;
  initialLanguage?: string;
}

export function Playground({ initialCode, initialLanguage }: PlaygroundProps) {
  const t = useTranslations("playground");
  const te = useTranslations("editor");
  const tc = useTranslations("common");

  // ─── Backend status / feature gates ───
  const pistonGate = useFeatureGate("playground.piston");
  const pkgGate = useFeatureGate("playground.python-packages");

  // ─── State ───
  const [languageId, setLanguageId] = useState(initialLanguage ?? "python");
  const [version, setVersion] = useState<string | undefined>(undefined);
  const [files, setFiles] = useState<PlaygroundFile[]>([
    {
      name: getDefaultFilename(LANGUAGES[initialLanguage as never] ?? LANGUAGES.python),
      content: initialCode ?? LANGUAGES.python.defaultCode,
    },
  ]);
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const [isExecuting, setIsExecuting] = useState(false);
  const [output, setOutput] = useState<OutputLine[]>([]);
  const [stdinInput, setStdinInput] = useState("");
  const [packages, setPackages] = useState<string[]>([]);
  const [pkgInput, setPkgInput] = useState("");
  const [sidePanel, setSidePanel] = useState<SidePanel>("templates");
  const [templateConfirm, setTemplateConfirm] = useState<{ label: string; code: string } | null>(null);

  const meta = getLanguage(languageId);
  const activeFile = files[activeFileIndex] ?? files[0]!;
  const ecosystem = getEcosystemForLanguage(languageId);
  const codeRef = useRef(activeFile.content);

  // Keep ref in sync with active file content
  useEffect(() => {
    codeRef.current = activeFile.content;
  }, [activeFile.content]);

  // ─── URL Share decode on mount ───
  useEffect(() => {
    const h = window.location.hash.slice(1);
    if (!h) return;
    const shared = decodeShare(h);
    if (shared && getLanguage(shared.lang)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLanguageId(shared.lang);
      setFiles([{ name: getDefaultFilename(getLanguage(shared.lang)!), content: shared.code }]);
      setActiveFileIndex(0);
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  // ─── Restore code from localStorage ───
  useEffect(() => {
    const saved = localStorage.getItem("oc_playground_" + languageId);
    if (saved && !initialCode) {
      try {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setFiles([{ name: getDefaultFilename(meta!), content: saved }]);
      } catch {
        /* ignore */
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [languageId]);

  // ─── Change language ───
  const changeLanguage = useCallback((langId: string) => {
    setLanguageId(langId);
    const m = getLanguage(langId);
    if (m) {
      setFiles([{ name: getDefaultFilename(m), content: m.defaultCode }]);
      setActiveFileIndex(0);
      setVersion(undefined);
    }
  }, []);

  // ─── File operations ───
  const addFile = useCallback(() => {
    const base = meta ? getDefaultFilename(meta) : "file.txt";
    const ext = base.includes(".") ? base.split(".").pop()! : "";
    const stem = base.includes(".") ? base.slice(0, base.lastIndexOf(".")) : base;
    const existing = files.map((f) => f.name);
    let i = 1;
    let name = base;
    while (existing.includes(name)) {
      name = `${stem}_${i}.${ext}`;
      i++;
    }
    setFiles((prev) => [...prev, { name, content: "" }]);
    setActiveFileIndex(files.length);
  }, [files, meta]);

  const removeFile = useCallback(
    (idx: number) => {
      if (files.length <= 1) return;
      setFiles((prev) => prev.filter((_, i) => i !== idx));
      setActiveFileIndex((prev) => (prev >= idx ? Math.max(0, prev - 1) : prev));
    },
    [files.length],
  );

  const updateFileContent = useCallback(
    (content: string) => {
      setFiles((prev) => prev.map((f, i) => (i === activeFileIndex ? { ...f, content } : f)));
    },
    [activeFileIndex],
  );

  // ─── Output helpers ───
  const appendOutput = useCallback((line: OutputLine) => {
    setOutput((prev) => [...prev, line]);
  }, []);

  const clearOutput = useCallback(() => setOutput([]), []);

  // ─── Run ───
  const run = useCallback(async () => {
    if (!meta) return;
    const code = codeRef.current;
    if (!code.trim()) {
      toast.error(t("languageNotSupported"));
      return;
    }
    if (isExecuting) return;
    setIsExecuting(true);
    setOutput([]);

    appendOutput({ type: "info", text: `> ${meta.label} ${version ?? meta.defaultVersion}` });

    // Backend offline path: prefer frontend runner so we don't pay the
    // cost of a network round-trip that will 503 anyway.
    if (!pistonGate.enabled) {
      const { frontendRunnerFor } = await import("@/lib/execution/frontend-runner");
      const feRunner = frontendRunnerFor(languageId);
      if (!feRunner) {
        appendOutput({ type: "err", text: t("languageNotSupported") + " — " + t("needsBackendOrBrowser") });
        setIsExecuting(false);
        return;
      }
      appendOutput({ type: "info", text: "→ Backend offline, running in browser" });
      const feResult = await feRunner(files.map((f) => ({ name: f.name, content: f.content })));
      if (feResult.stdout) {
        feResult.stdout.split("\n").forEach((line) => {
          if (line) appendOutput({ type: "out", text: line });
        });
      }
      if (feResult.stderr) {
        feResult.stderr.split("\n").forEach((line) => {
          if (line) appendOutput({ type: "err", text: line });
        });
      }
      const feDur = (feResult.durationMs ?? 0) / 1000;
      appendOutput({
        type: feResult.ok ? "info" : "err",
        text: feResult.ok
          ? `✓ ${t("success")} (browser, ${feDur.toFixed(2)}s)`
          : `✗ ${t("failed")} exit=${feResult.exitCode} (browser, ${feDur.toFixed(2)}s)`,
      });
      setIsExecuting(false);
      return;
    }

    // If packages are added, we need to install them first
    // Strategy: create a setup script file that installs packages before running user code
    const hasPackages = packages.length > 0 && ecosystem;

    try {
      let executeFiles = files.map((f) => ({ name: f.name, content: f.content }));
      let executeLanguage = meta.pistonLanguage;
      let executeVersion = version ?? meta.defaultVersion;

      if (hasPackages) {
        appendOutput({ type: "info", text: `> ${t("installing")} ${packages.join(", ")}` });

        // Generate install + run script for each ecosystem
        const installCmd = ecosystem!.installCmd;
        const pkgList = packages.join(" ");
        const mainFile = files[0]?.name ?? "main";
        const runCmd = meta.runCommand.replace("{filename}", mainFile);

        // Build a bash setup script that installs packages then runs the code
        const setupScript = [
          "#!/bin/bash",
          "set -e",
          `echo "=== Installing: ${pkgList}"`,
          `${installCmd} ${pkgList} 2>&1`,
          `echo "=== Running: ${runCmd}"`,
          runCmd,
        ].join("\n");

        // Use bash language to execute the setup script
        executeFiles = [
          { name: "setup.sh", content: setupScript },
          ...files.map((f) => ({ name: f.name, content: f.content })),
        ];
        executeLanguage = "bash";
        executeVersion = "5.2.0";
      }

      const res = await fetch("/api/execute", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          language: executeLanguage,
          version: executeVersion,
          files: executeFiles,
          stdin: stdinInput,
          args: [],
        }),
      });
      const data: {
        sessionId: string;
        success: boolean;
        durationMs?: number;
        result?: {
          run?: { stdout: string; stderr: string; code: number; signal: string | null };
          compile?: { stdout: string; stderr: string; code: number; signal: string | null };
        };
        error?: string;
        message?: string;
        component?: string;
      } = await res.json();
      const startMs = Date.now();

      // ── Backend unavailable → switch to in-browser runner ──
      if (res.status === 503 || data.error === "backend_unavailable") {
        const { frontendRunnerFor } = await import("@/lib/execution/frontend-runner");
        const feRunner = frontendRunnerFor(executeLanguage);
        if (!feRunner) {
          appendOutput({
            type: "err",
            text: `Backend is unavailable and ${executeLanguage} cannot run in the browser.`,
          });
          appendOutput({ type: "err", text: data.message ?? data.error ?? "no backend" });
          appendOutput({
            type: "err",
            text: `Configure UPSTASH_REDIS_REST_URL/TOKEN (and Piston), or pick JS/TS/HTML/Python for browser-side execution.`,
          });
          return;
        }
        appendOutput({ type: "info", text: "→ Backend unavailable, running in browser sandbox" });
        const feResult = await feRunner(files.map((f) => ({ name: f.name, content: f.content })));
        if (feResult.stdout) {
          feResult.stdout.split("\n").forEach((line) => {
            if (line) appendOutput({ type: "out", text: line });
          });
        }
        if (feResult.stderr) {
          feResult.stderr.split("\n").forEach((line) => {
            if (line) appendOutput({ type: "err", text: line });
          });
        }
        const feDur = (feResult.durationMs ?? 0) / 1000;
        appendOutput({
          type: feResult.ok ? "info" : "err",
          text: feResult.ok
            ? `✓ ${t("success")} (browser, ${feDur.toFixed(2)}s)`
            : `✗ ${t("failed")} exit=${feResult.exitCode} (browser, ${feDur.toFixed(2)}s)`,
        });
        return;
      }

      const compile = data.result?.compile;
      const run = data.result?.run;

      if (compile?.stdout) {
        appendOutput({ type: "info", text: compile.stdout.trim() });
      }
      if (compile?.stderr) {
        compile.stderr.split("\n").forEach((l: string) => {
          if (l.trim()) appendOutput({ type: "err", text: l });
        });
      }

      if (run?.stdout) {
        run.stdout.split("\n").forEach((l: string) => {
          if (l) appendOutput({ type: "out", text: l });
        });
      }
      if (run?.stderr) {
        run.stderr.split("\n").forEach((l: string) => {
          if (l) appendOutput({ type: "err", text: l });
        });
      }

      const dur = (data.durationMs ?? Date.now() - startMs) / 1000;
      const exitCode = run?.code ?? compile?.code ?? -1;
      appendOutput({
        type: exitCode === 0 ? "info" : "err",
        text: exitCode === 0 ? `✓ ${t("success")} (${dur.toFixed(2)}s)` : `✗ Exit code ${exitCode}`,
      });
    } catch (e) {
      appendOutput({ type: "err", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setIsExecuting(false);
    }
  }, [
    meta,
    isExecuting,
    version,
    files,
    stdinInput,
    packages,
    ecosystem,
    t,
    appendOutput,
    pistonGate.enabled,
    languageId,
  ]);

  const stop = useCallback(() => {
    setIsExecuting(false);
    appendOutput({ type: "warn", text: "■ Stopped" });
  }, [appendOutput]);

  // ─── Copy ───
  const copyCode = useCallback(async () => {
    await navigator.clipboard.writeText(activeFile.content);
    toast.success(tc("copied"));
  }, [activeFile.content, tc]);

  // ─── Save to localStorage ───
  const saveLocal = useCallback(() => {
    localStorage.setItem("oc_playground_" + languageId, activeFile.content);
    toast.success(tc("save") + " ✓");
  }, [languageId, activeFile.content, tc]);

  // ─── Share via URL ───
  const shareUrl = useCallback(async () => {
    const encoded = encodeShare({ code: activeFile.content, lang: languageId });
    if (!encoded) {
      toast.error(t("shareUrlError"));
      return;
    }
    const url = `${window.location.origin}${window.location.pathname}#${encoded}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t("linkCopied"));
    } catch {
      toast.success(url);
    }
  }, [activeFile.content, languageId, t]);

  // ─── Packages ───
  const addPackage = useCallback(() => {
    const name = pkgInput.trim();
    if (!name) return;
    if (packages.includes(name)) {
      toast.error("Already added");
      return;
    }
    setPackages((prev) => [...prev, name]);
    setPkgInput("");
  }, [pkgInput, packages]);

  const removePackage = useCallback((name: string) => {
    setPackages((prev) => prev.filter((p) => p !== name));
  }, []);

  const handlePkgKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        addPackage();
      }
    },
    [addPackage],
  );

  // ─── Template ───
  const applyTemplate = useCallback((tpl: { label: string; code: string }) => {
    setTemplateConfirm(tpl);
  }, []);

  const confirmTemplate = useCallback(() => {
    if (!templateConfirm) return;
    updateFileContent(templateConfirm.code);
    setTemplateConfirm(null);
  }, [templateConfirm, updateFileContent]);

  // ─── Render ───
  if (!meta) {
    return (
      <div className="text-muted-foreground flex h-[calc(100vh-3.5rem)] items-center justify-center text-sm">
        {t("languageNotSupported")}
      </div>
    );
  }

  const langTemplates = TEMPLATES[languageId] ?? [];

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      {/* ─── Toolbar ─── */}
      <div className="bg-background flex items-center gap-1.5 border-b px-3 py-1.5">
        <Select value={languageId} onValueChange={changeLanguage}>
          <SelectTrigger className="h-8 w-40 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LANGUAGE_LIST.map((l) => (
              <SelectItem key={l.id} value={l.id}>
                <span className="mr-1">{l.icon}</span> {l.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={version ?? meta.defaultVersion} onValueChange={setVersion}>
          <SelectTrigger className="h-8 w-28 text-xs">
            <SelectValue placeholder={meta.defaultVersion} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={meta.defaultVersion}>{meta.defaultVersion}</SelectItem>
            {version && version !== meta.defaultVersion && <SelectItem value={version}>{version}</SelectItem>}
          </SelectContent>
        </Select>

        <div className="flex-1" />

        {isExecuting ? (
          <Button size="sm" variant="destructive" onClick={stop} className="h-8 gap-1 text-xs">
            <Square className="size-3.5" /> {t("stop")}
          </Button>
        ) : (
          <Button size="sm" onClick={run} className="h-8 gap-1 bg-emerald-600 text-xs hover:bg-emerald-700">
            <Play className="size-3.5" /> {t("run")}
          </Button>
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="size-8"
              onClick={clearOutput}
              aria-label={t("clearOutput")}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t("clearOutput")}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon" variant="ghost" className="size-8" onClick={copyCode} aria-label={tc("copy")}>
              <Copy className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{tc("copy")}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon" variant="ghost" className="size-8" onClick={shareUrl} aria-label={t("share")}>
              <Share2 className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t("copyLink")}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="size-8"
              onClick={saveLocal}
              aria-label={tc("save")}
            >
              <Download className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{tc("save")} (localStorage)</TooltipContent>
        </Tooltip>
      </div>

      {/* ─── Main area ─── */}
      <ResizablePanelGroup orientation="horizontal" className="flex-1">
        {/* ─── Editor panel ─── */}
        <ResizablePanel defaultSize={65} minSize={35}>
          <div className="flex h-full flex-col">
            {/* File tabs */}
            <div className="bg-muted/30 flex items-center gap-0.5 border-b px-1 py-0.5">
              {files.map((f, i) => (
                <div
                  key={i}
                  className={cn(
                    "group flex cursor-pointer items-center gap-1 rounded-t-sm border-b-2 px-2.5 py-1 text-xs transition-colors",
                    i === activeFileIndex
                      ? "bg-background border-primary text-foreground"
                      : "text-muted-foreground hover:bg-background/50 border-transparent",
                  )}
                  onClick={() => setActiveFileIndex(i)}
                >
                  <FileCode2 className="size-3" />
                  <span className="max-w-[120px] truncate">{f.name}</span>
                  {files.length > 1 && (
                    <button
                      className="ml-0.5 opacity-0 group-hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile(i);
                      }}
                      aria-label="Close"
                    >
                      <X className="size-3" />
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={addFile}
                className="text-muted-foreground hover:bg-background/50 flex items-center gap-0.5 rounded px-1.5 py-1 text-xs"
                aria-label={t("newFile")}
              >
                <Plus className="size-3" /> {t("newFile")}
              </button>
            </div>

            {/* Code editor */}
            <div className="flex-1 overflow-hidden">
              <CodeEditor
                value={activeFile.content}
                onChange={updateFileContent}
                language={meta.monacoLanguage}
                fontSize={14}
                wordWrap="on"
                minimap={false}
                height="100%"
              />
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle />

        {/* ─── Side panel ─── */}
        <ResizablePanel defaultSize={35} minSize={20} maxSize={45}>
          <div className="flex h-full flex-col border-l">
            {/* Side panel tabs */}
            <div className="bg-muted/30 flex items-center border-b px-2">
              <button
                onClick={() => setSidePanel("templates")}
                className={cn(
                  "flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium transition-colors",
                  sidePanel === "templates"
                    ? "border-primary text-foreground"
                    : "text-muted-foreground border-transparent",
                )}
              >
                <FileCode2 className="size-3.5" /> {t("templates")}
              </button>
              <button
                onClick={() => setSidePanel("packages")}
                className={cn(
                  "flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium transition-colors",
                  sidePanel === "packages"
                    ? "border-primary text-foreground"
                    : "text-muted-foreground border-transparent",
                )}
              >
                <Package className="size-3.5" /> {t("packages")}
              </button>
            </div>

            {/* Side panel content */}
            <div className="flex-1 overflow-auto p-2">
              {sidePanel === "templates" ? (
                <div className="space-y-2">
                  <p className="text-muted-foreground px-1 text-xs">{t("selectTemplate")}</p>
                  {langTemplates.length === 0 ? (
                    <p className="text-muted-foreground px-1 py-4 text-center text-xs">{tc("comingSoon")}</p>
                  ) : (
                    langTemplates.map((tpl) => (
                      <button
                        key={tpl.label}
                        onClick={() => applyTemplate(tpl)}
                        className="hover:bg-accent w-full rounded-md border px-3 py-2 text-left text-xs transition-colors"
                      >
                        <div className="font-medium">{tpl.label}</div>
                        <div className="text-muted-foreground mt-0.5 truncate font-mono text-[10px]">
                          {tpl.code.split("\n").slice(0, 2).join(" · ")}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {sidePanel === "packages" && !pkgGate.enabled && (
                    <LockedOverlay feature="playground.python-packages" inline className="my-2" />
                  )}
                  <div className={cn(!pkgGate.enabled && "pointer-events-none opacity-50")}>
                    {ecosystem ? (
                      <>
                        <div className="flex items-center gap-1.5">
                          <Input
                            value={pkgInput}
                            onChange={(e) => setPkgInput(e.target.value)}
                            onKeyDown={handlePkgKeyDown}
                            placeholder={ecosystem.placeholder}
                            className="h-7 flex-1 text-xs"
                          />
                          <Button size="sm" onClick={addPackage} className="h-7 text-xs">
                            {t("addPackage")}
                          </Button>
                        </div>
                        <p className="text-muted-foreground text-[10px]">
                          {ecosystem.installCmd} {packages.join(" ")}
                        </p>
                        {packages.length === 0 ? (
                          <p className="text-muted-foreground py-3 text-center text-xs">{t("noPackages")}</p>
                        ) : (
                          <div className="space-y-1">
                            {packages.map((p) => (
                              <div
                                key={p}
                                className="flex items-center justify-between rounded border px-2 py-1"
                              >
                                <span className="font-mono text-xs">{p}</span>
                                <button
                                  onClick={() => removePackage(p)}
                                  className="text-muted-foreground hover:text-foreground"
                                  aria-label="Remove"
                                >
                                  <X className="size-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="text-muted-foreground py-3 text-center text-xs">{t("noPackages")}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* ─── Output panel ─── */}
      <div className="bg-background border-t">
        <div className="flex items-center gap-1 border-b px-3 py-1">
          <Terminal className="text-muted-foreground size-3" />
          <span className="text-xs font-medium">{t("output")}</span>
          {isExecuting && (
            <Badge variant="secondary" className="ml-2 h-4 px-1.5 text-[10px]">
              {t("executing")}
            </Badge>
          )}
        </div>
        <div className="flex flex-col">
          {/* Output */}
          <div className="h-[28vh] overflow-auto p-3 font-mono text-xs">
            {output.length === 0 ? (
              <p className="text-muted-foreground p-2 text-center text-xs">{te("ready")}</p>
            ) : (
              output.map((line, i) => (
                <div
                  key={i}
                  className={
                    line.type === "err"
                      ? "text-red-500"
                      : line.type === "warn"
                        ? "text-yellow-500"
                        : line.type === "info"
                          ? "text-blue-400"
                          : "text-foreground"
                  }
                >
                  {line.text}
                </div>
              ))
            )}
          </div>
          {/* Stdin input */}
          <div className="border-t px-3 py-2">
            <div className="mb-1 flex items-center gap-1.5">
              <span className="text-muted-foreground text-[10px] font-medium">{t("stdin")}</span>
            </div>
            <textarea
              value={stdinInput}
              onChange={(e) => setStdinInput(e.target.value)}
              placeholder={t("stdinPlaceholder")}
              className="bg-background max-h-[80px] min-h-[40px] w-full resize-none rounded-md border px-2 py-1.5 font-mono text-xs outline-none"
              rows={2}
            />
          </div>
        </div>
      </div>

      {/* ─── Template confirm dialog ─── */}
      <AlertDialog open={!!templateConfirm} onOpenChange={(o) => !o && setTemplateConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{templateConfirm?.label}</AlertDialogTitle>
            <AlertDialogDescription>{t("confirmTemplate")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmTemplate}>{t("replace")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
