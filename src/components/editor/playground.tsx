"use client";

import { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import { useEditorStore } from "@/stores/editor";
import { LANGUAGES, getLanguage } from "@/lib/execution";
import type { ExecuteResponse } from "@/lib/execution";
import { Play, Square, Trash2, Save, Copy, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

const CodeEditor = dynamic(
  () => import("@/components/editor/code-editor").then((m) => m.CodeEditor),
  {
    ssr: false,
    loading: () => <Skeleton className="h-full w-full" />,
  },
);

const Scene3D = dynamic(() => import("@/components/editor/scene-3d").then((m) => m.Scene3D), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full" />,
});

export interface PlaygroundProps {
  initialCode?: string;
  initialLanguage?: string;
}

export function Playground({ initialCode, initialLanguage }: PlaygroundProps) {
  const t = useTranslations("execution");
  const te = useTranslations("editor");
  const tc = useTranslations("common");
  const {
    currentLanguage,
    setLanguage,
    fontSize,
    wordWrap,
    minimap,
    output,
    isExecuting,
    setIsExecuting,
    setIsRunning,
    appendOutput,
    clearOutput,
  } = useEditorStore();
  const [code, setCode] = useState<string>(initialCode ?? "");
  const [version, setVersion] = useState<string | undefined>(undefined);

  const meta = getLanguage(currentLanguage);

  useEffect(() => {
    if (!code && meta?.defaultCode) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCode(meta.defaultCode);
    }
    if (initialCode) {
      setCode(initialCode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLanguage, meta?.id]);

  useEffect(() => {
    if (initialLanguage && getLanguage(initialLanguage)) {
      setLanguage(initialLanguage as never);
    }
  }, [initialLanguage, setLanguage]);

  const run = useCallback(async () => {
    if (!code.trim()) {
      toast.error(t("errors.emptyCode"));
      return;
    }
    if (isExecuting) return;
    setIsExecuting(true);
    setIsRunning(true);
    clearOutput();
    appendOutput({ type: "info", text: `>>> ${meta?.label} ${version ?? meta?.defaultVersion} starting...` });

    try {
      const res = await fetch("/api/execute", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          language: currentLanguage,
          version,
          files: [{ name: meta?.runCommand.split(" ")[1] ?? "main", content: code }],
          stdin: "",
          args: [],
          env: {},
        }),
      });
      const data: ExecuteResponse & { durationMs?: number } = await res.json();
      const startMs = Date.now();
      if (data.result?.run?.stdout) {
        data.result.run.stdout.split("\n").forEach((line: string) => {
          if (line) appendOutput({ type: "out", text: line });
        });
      }
      if (data.result?.run?.stderr) {
        data.result.run.stderr.split("\n").forEach((line: string) => {
          if (line) appendOutput({ type: "err", text: line });
        });
      }
      const duration = data.durationMs ?? Date.now() - startMs;
      const exitCode = data.result?.run?.code ?? -1;
      appendOutput({
        type: exitCode === 0 ? "info" : "err",
        text:
          exitCode === 0
            ? `✓ ${t("completed", { duration: (duration / 1000).toFixed(2) + "s" })}`
            : `✗ Exit ${exitCode}`,
      });
    } catch (e) {
      appendOutput({ type: "err", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setIsExecuting(false);
      setIsRunning(false);
    }
  }, [code, isExecuting, currentLanguage, version, meta, setIsExecuting, setIsRunning, clearOutput, appendOutput, t]);

  const stop = useCallback(() => {
    setIsRunning(false);
    setIsExecuting(false);
    appendOutput({ type: "warn", text: "■ stopped" });
  }, [setIsRunning, setIsExecuting, appendOutput]);

  const save = useCallback(() => {
    localStorage.setItem("oc_playground_" + currentLanguage, code);
    toast.success(tc("save") + " ✓");
  }, [code, currentLanguage, tc]);

  const copy = useCallback(async () => {
    await navigator.clipboard.writeText(code);
    toast.success(tc("copied"));
  }, [code, tc]);

  const share = useCallback(async () => {
    try {
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ snippetId: undefined }),
      });
      if (!res.ok) throw new Error("share failed");
      const data = await res.json();
      const url = `${window.location.origin}${data.url}`;
      await navigator.clipboard.writeText(url);
      toast.success(tc("copied") + " · " + url);
    } catch {
      await navigator.clipboard.writeText(code);
      toast.success(tc("copied"));
    }
  }, [code, tc]);

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      <div className="bg-background flex items-center gap-2 border-b px-4 py-2">
        <Select value={currentLanguage} onValueChange={(v) => setLanguage(v as never)}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.values(LANGUAGES).map((l) => (
              <SelectItem key={l.id} value={l.id}>
                {l.icon} {l.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={version ?? meta?.defaultVersion ?? ""} onValueChange={setVersion}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="version" />
          </SelectTrigger>
          <SelectContent>
            {(version ? [version, meta?.defaultVersion] : [meta?.defaultVersion])
              .filter(Boolean)
              .map((v) => (
                <SelectItem key={v} value={v!}>
                  {v}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        <div className="ml-auto flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="sm" variant="ghost" onClick={save} aria-label="Save">
                <Save className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{tc("save")}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="sm" variant="ghost" onClick={copy} aria-label="Copy">
                <Copy className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{tc("copy")}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="sm" variant="ghost" onClick={share} aria-label="Share">
                <Share2 className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{tc("share")}</TooltipContent>
          </Tooltip>
          <Button size="sm" variant="ghost" onClick={clearOutput} aria-label="Clear">
            <Trash2 className="size-4" />
          </Button>
          {isExecuting ? (
            <Button size="sm" variant="destructive" onClick={stop}>
              <Square className="size-4" /> {te("stop")}
            </Button>
          ) : (
            <Button size="sm" onClick={run} disabled={!code.trim()}>
              <Play className="size-4" /> {te("run")}
            </Button>
          )}
        </div>
      </div>

      <ResizablePanelGroup orientation="vertical" className="flex-1">
        <ResizablePanel defaultSize={65} minSize={20}>
          <CodeEditor
            value={code}
            onChange={setCode}
            language={meta?.monacoLanguage ?? "plaintext"}
            fontSize={fontSize}
            wordWrap={wordWrap ? "on" : "off"}
            minimap={minimap}
            height="100%"
          />
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel defaultSize={35} minSize={10}>
          <Tabs defaultValue="console" className="flex h-full flex-col">
            <div className="flex items-center border-b px-2">
              <TabsList className="bg-transparent">
                <TabsTrigger value="console">{t("console")}</TabsTrigger>
                <TabsTrigger value="graphics">{t("graphics")}</TabsTrigger>
                <TabsTrigger value="canvas3d">{t("canvas3d")}</TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="console" className="mt-0 flex-1 overflow-hidden">
              <div className="bg-background h-full overflow-auto p-2 font-mono text-xs">
                {output.length === 0 ? (
                  <p className="text-muted-foreground p-4 text-center">{t("empty")}</p>
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
                              ? "text-blue-500"
                              : "text-foreground"
                      }
                    >
                      {line.text}
                    </div>
                  ))
                )}
              </div>
            </TabsContent>
            <TabsContent value="graphics" className="mt-0 flex-1 overflow-hidden">
              <canvas id="graphics-canvas" className="h-full w-full" />
            </TabsContent>
            <TabsContent value="canvas3d" className="mt-0 flex-1 overflow-hidden">
              <Scene3D />
            </TabsContent>
          </Tabs>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
