// @ts-nocheck -- third-party types are incomplete
"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { useSession } from "next-auth/react";
import type { editor as MonacoEditor } from "monaco-editor";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { Play, Square, Save, Trash2, X, AlertCircle, ArrowLeft, Loader2, Boxes } from "lucide-react";
import { useEditorStore } from "@/stores/editor";
import { FileTree, type FileNode } from "@/components/project/file-tree";
import { PackageManager } from "@/components/project/package-manager";
import { CollabPresence } from "@/components/collab/collab-presence";
import { ShareDialog } from "@/components/share/share-dialog";
import { getLanguage, type ExecuteResponse } from "@/lib/execution";
import { useYCollab, useYMonacoBinding } from "@/lib/collab";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import Link from "next/link";

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

interface ProjectData {
  project: {
    id: string;
    name: string;
    description: string | null;
    language: string;
    visibility: string;
    template: string | null;
  };
  files: Array<{
    id: string;
    path: string;
    type: "file" | "directory";
    content: string | null;
    size: number;
    mime: string;
    encoding: string;
  }>;
}

export interface ProjectEditorProps {
  id: string;
}

function languageFromPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    py: "python",
    js: "javascript",
    ts: "typescript",
    jsx: "javascript",
    tsx: "typescript",
    c: "c",
    h: "c",
    cpp: "cpp",
    cc: "cpp",
    cxx: "cpp",
    hpp: "cpp",
    java: "java",
    rs: "rust",
    go: "go",
    cs: "csharp",
    php: "php",
    rb: "ruby",
    kt: "kotlin",
    swift: "swift",
    scala: "scala",
    sh: "bash",
    bash: "bash",
    lua: "lua",
    sql: "sql",
    html: "html",
    htm: "html",
    css: "css",
    json: "json",
    md: "markdown",
    yaml: "yaml",
    yml: "yaml",
    toml: "ini",
  };
  return map[ext] ?? "plaintext";
}

export function ProjectEditor({ id }: ProjectEditorProps) {
  const router = useRouter();
  const locale = useLocale();
  const { data: session } = useSession();
  const [data, setData] = useState<ProjectData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteFileId, setDeleteFileId] = useState<FileNode | null>(null);
  const [monacoEditor, setMonacoEditor] = useState<MonacoEditor.IStandaloneCodeEditor | null>(null);
  const saveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const {
    tabs,
    activeTabId,
    fontSize,
    wordWrap,
    minimap,
    autoSave,
    isExecuting,
    output,
    activeOutputTab,
    addTab,
    closeTab,
    setActiveTab,
    updateTab,
    markClean,
    setIsExecuting,
    setIsRunning,
    appendOutput,
    clearOutput,
    setActiveOutputTab,
  } = useEditorStore();

  const userId = session?.user?.id ?? "anon";
  const userName = session?.user?.name ?? "Guest";
  const t = useTranslations("projectEditor");
  const texec = useTranslations("execution");
  const tpkg = useTranslations("packages");
  const tc = useTranslations("common");
  const collabRoomId = activeTabId ? `p:${id}:${activeTabId}` : null;
  const { ydoc, status: collabStatus, users: collabUsers } = useYCollab({
    roomId: collabRoomId,
    userId,
    userName,
  });
  useYMonacoBinding(monacoEditor, { ydoc });

  useEffect(() => {
    fetch(`/api/projects/${id}/files`)
      .then(async (r) => {
        if (!r.ok) {
          if (r.status === 404) throw new Error("not_found");
          if (r.status === 403) throw new Error("forbidden");
          throw new Error("load_failed");
        }
        return r.json();
      })
      .then((d: ProjectData) => {
        setData(d);
        const firstFile = d.files.find((f) => f.type === "file");
        if (firstFile) {
          addTab({
            id: firstFile.id,
            path: firstFile.path,
            language: languageFromPath(firstFile.path),
            content: firstFile.content ?? "",
            savedContent: firstFile.content ?? "",
          });
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : "unknown"));
  }, [id, addTab]);

  const onSelect = useCallback(
    (f: FileNode) => {
      if (f.type !== "file") return;
      addTab({
        id: f.id,
        path: f.path,
        language: languageFromPath(f.path),
        content: f.content ?? "",
        savedContent: f.content ?? "",
      });
    },
    [addTab],
  );

  const onCreate = useCallback(
    async (path: string, type: "file" | "directory") => {
      const res = await fetch(`/api/projects/${id}/files`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ path, type, content: type === "file" ? "" : undefined }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || err.message || "Create failed");
      }
      const created = await res.json();
      setData((d) => (d ? { ...d, files: [...d.files, created] } : d));
      if (type === "file") {
        addTab({
          id: created.id,
          path: created.path,
          language: languageFromPath(created.path),
          content: created.content ?? "",
          savedContent: created.content ?? "",
        });
      }
    },
    [id, addTab],
  );

  const onDelete = useCallback(
    async (fileId: string, path: string) => {
      if (!fileId) {
        toast.error(t("folderDeleteNotSupported"));
        return;
      }
      setDeleteFileId({ id: fileId, path, type: "file" });
    },
    [t],
  );

  const confirmDelete = useCallback(async () => {
    if (!deleteFileId) return;
    const fileId = deleteFileId.id;
    setDeleteFileId(null);
    const res = await fetch(`/api/projects/${id}/files/${fileId}`, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error || t("deleteFailed"));
      return;
    }
    setData((d) => (d ? { ...d, files: d.files.filter((f) => f.id !== fileId) } : d));
    closeTab(fileId);
    toast.success(t("fileDeleted"));
  }, [deleteFileId, id, closeTab, t]);

  const onRename = useCallback(
    async (fileId: string, newPath: string) => {
      const res = await fetch(`/api/projects/${id}/files/${fileId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ path: newPath }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || t("renameFailed"));
        return;
      }
      setData((d) =>
        d
          ? { ...d, files: d.files.map((f) => (f.id === fileId ? { ...f, path: newPath } : f)) }
          : d,
      );
      const t0 = tabs.find((t2) => t2.id === fileId);
      if (t0) updateTab(fileId, { path: newPath });
    },
    [id, tabs, updateTab, t],
  );

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? null;

  const onChange = useCallback(
    (value: string) => {
      if (!activeTab) return;
      updateTab(activeTab.id, { content: value });

      if (!autoSave) return;
      const t = saveTimers.current.get(activeTab.id);
      if (t) clearTimeout(t);
      const timer = setTimeout(async () => {
        const res = await fetch(`/api/projects/${id}/files/${activeTab.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ content: value }),
        });
        if (res.ok) markClean(activeTab.id);
      }, 800);
      saveTimers.current.set(activeTab.id, timer);
    },
    [activeTab, updateTab, autoSave, id, markClean],
  );

  const saveNow = useCallback(async () => {
    if (!activeTab) return;
    const timer = saveTimers.current.get(activeTab.id);
    if (timer) clearTimeout(timer);
    saveTimers.current.delete(activeTab.id);
    const res = await fetch(`/api/projects/${id}/files/${activeTab.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: activeTab.content }),
    });
    if (res.ok) {
      markClean(activeTab.id);
      toast.success(t("saved"));
    } else {
      toast.error(t("saveFailed"));
    }
  }, [activeTab, id, markClean, t]);

  const run = useCallback(async () => {
    if (!activeTab || isExecuting) return;
    const meta = getLanguage(languageFromPath(activeTab.path));
    if (!meta) {
      toast.error(t("noLanguageDetected"));
      return;
    }
    setIsExecuting(true);
    setIsRunning(true);
    clearOutput();
    appendOutput({ type: "info", text: `>>> Running ${activeTab.path}` });
    try {
      const res = await fetch("/api/execute", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          language: meta.pistonLanguage,
          version: meta.defaultVersion,
          files: [{ name: activeTab.path.split("/").pop(), content: activeTab.content }],
          stdin: "",
          args: [],
        }),
      });
      const result: ExecuteResponse & { durationMs?: number } = await res.json();
      const startMs = Date.now();
      if (result.result?.run?.stdout) {
        result.result.run.stdout
          .split("\n")
          .forEach((line: string) => {
            if (line) appendOutput({ type: "out", text: line });
          });
      }
      if (result.result?.run?.stderr) {
        result.result.run.stderr
          .split("\n")
          .forEach((line: string) => {
            if (line) appendOutput({ type: "err", text: line });
          });
      }
      const code = result.result?.run?.code ?? -1;
      const dur = (result.durationMs ?? Date.now() - startMs) / 1000;
      appendOutput({
        type: code === 0 ? "info" : "err",
        text: code === 0 ? `✓ Completed in ${dur.toFixed(2)}s` : `✗ Exit ${code}`,
      });
    } catch (e) {
      appendOutput({ type: "err", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setIsExecuting(false);
      setIsRunning(false);
    }
  }, [activeTab, isExecuting, setIsExecuting, setIsRunning, clearOutput, appendOutput, t]);

  if (error) {
    return (
      <div className="container mx-auto max-w-2xl p-8">
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <AlertCircle className="text-destructive size-12" />
            <h2 className="text-lg font-semibold">
              {error === "not_found" ? t("projectNotFound") : error === "forbidden" ? t("accessDenied") : t("loadFailed")}
            </h2>
            <Button asChild>
              <Link href={`/${locale}/projects`}>
                <ArrowLeft className="mr-2 size-4" /> {t("back")}
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center">
        <Loader2 className="text-muted-foreground size-8 animate-spin" />
      </div>
    );
  }

  const fileNodes: FileNode[] = data.files.map((f) => ({
    id: f.id,
    path: f.path,
    type: f.type,
    content: f.content ?? "",
    size: f.size,
  }));

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      <div className="bg-background flex items-center gap-2 border-b px-4 py-1.5">
        <Button variant="ghost" size="icon" onClick={() => router.push(`/${locale}/projects`)} aria-label="Back">
          <ArrowLeft className="size-4" />
        </Button>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-semibold">{data.project.name}</span>
          <span className="text-muted-foreground truncate text-xs">{data.project.description || t("noDescription")}</span>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="sm" variant="ghost" onClick={saveNow} disabled={!activeTab?.isDirty} aria-label="Save">
              <Save className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t("saveTooltip")}</TooltipContent>
        </Tooltip>
        <CollabPresence users={collabUsers} status={collabStatus} selfId={userId} />
        <ShareDialog projectId={id} />
        <Button size="sm" onClick={run} disabled={!activeTab || isExecuting}>
          {isExecuting ? <Square className="size-4" /> : <Play className="size-4" />}
          {isExecuting ? t("stop") : t("run")}
        </Button>
      </div>

      <ResizablePanelGroup orientation="horizontal" className="flex-1">
        <ResizablePanel defaultSize={18} minSize={12} maxSize={35}>
          <FileTree
            files={fileNodes}
            activeId={activeTabId}
            onSelect={onSelect}
            onCreate={onCreate}
            onDelete={onDelete}
            onRename={onRename}
          />
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel defaultSize={82}>
          <ResizablePanelGroup orientation="vertical">
            <ResizablePanel defaultSize={70} minSize={20}>
              <div className="flex h-full flex-col">
                <div className="bg-muted/30 flex items-center gap-0.5 overflow-x-auto border-b px-1 py-0.5">
                  {tabs.length === 0 ? (
                    <span className="text-muted-foreground px-2 py-1 text-xs">{t("noFileOpen")}</span>
                  ) : (
                    tabs.map((t) => (
                      <div
                        key={t.id}
                        className={cn(
                          "group flex items-center gap-1.5 rounded-sm px-2 py-1 text-xs",
                          activeTabId === t.id
                            ? "bg-background border-border border"
                            : "hover:bg-background/50",
                        )}
                        onClick={() => setActiveTab(t.id)}
                      >
                        <span className="max-w-[160px] truncate">{t.path.split("/").pop()}</span>
                        {t.isDirty && <span className="size-1.5 rounded-full bg-yellow-500" />}
                        <button
                          className="opacity-0 group-hover:opacity-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            closeTab(t.id);
                          }}
                          aria-label="Close"
                        >
                          <X className="size-3" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
                <div className="flex-1 overflow-hidden">
                  {activeTab ? (
                    <CodeEditor
                      value={activeTab.content}
                      onChange={onChange}
                      language={activeTab.language}
                      fontSize={fontSize}
                      wordWrap={wordWrap ? "on" : "off"}
                      minimap={minimap}
                      height="100%"
                      onMount={(ed) => setMonacoEditor(ed)}
                    />
                  ) : (
                    <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
                      {t("selectFileToEdit")}
                    </div>
                  )}
                </div>
              </div>
            </ResizablePanel>
            <ResizableHandle />
            <ResizablePanel defaultSize={30} minSize={10}>
              <Tabs
                value={activeOutputTab}
                onValueChange={(v) => setActiveOutputTab(v as never)}
                className="flex h-full flex-col"
              >
                <div className="flex items-center justify-between border-b px-2">
                  <TabsList className="bg-transparent">
                    <TabsTrigger value="console">{texec("console")}</TabsTrigger>
                    <TabsTrigger value="graphics">{texec("graphics")}</TabsTrigger>
                    <TabsTrigger value="canvas3d">{texec("canvas3d")}</TabsTrigger>
                    <TabsTrigger value="packages">
                      <Boxes className="mr-1 size-3" /> {tpkg("title")}
                    </TabsTrigger>
                  </TabsList>
                  <Button size="icon" variant="ghost" className="size-6" onClick={clearOutput} aria-label="Clear">
                    <Trash2 className="size-3" />
                  </Button>
                </div>
                <TabsContent value="console" className="mt-0 flex-1 overflow-hidden">
                  <div className="bg-background h-full overflow-auto p-2 font-mono text-xs">
                    {output.length === 0 ? (
                      <p className="text-muted-foreground p-4 text-center">{t("noOutput")}</p>
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
                <TabsContent value="packages" className="mt-0 flex-1 overflow-hidden">
                  <PackageManager projectId={id} className="h-full overflow-auto" />
                </TabsContent>
              </Tabs>
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>
      </ResizablePanelGroup>

      <AlertDialog open={!!deleteFileId}         onOpenChange={(o: boolean) => !o && setDeleteFileId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteFileConfirm")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteFileWarning", { path: deleteFileId?.path ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>{tc("delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
