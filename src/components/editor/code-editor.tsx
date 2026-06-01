"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect, useRef } from "react";
import type { editor } from "monaco-editor";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full" />,
});

export interface CodeEditorProps {
  value: string;
  onChange?: (value: string) => void;
  language?: string;
  theme?: "vs-dark" | "light" | "hc-black";
  fontSize?: number;
  tabSize?: number;
  wordWrap?: "on" | "off";
  minimap?: boolean;
  lineNumbers?: "on" | "off" | "relative";
  readOnly?: boolean;
  height?: string | number;
  onMount?: (editor: editor.IStandaloneCodeEditor, monaco: typeof import("monaco-editor")) => void;
  options?: editor.IStandaloneEditorConstructionOptions;
}

export function CodeEditor({
  value,
  onChange,
  language = "plaintext",
  theme = "vs-dark",
  fontSize = 14,
  tabSize = 2,
  wordWrap = "on",
  minimap = false,
  lineNumbers = "on",
  readOnly = false,
  height = "100%",
  onMount,
  options,
}: CodeEditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.updateOptions({
        fontSize,
        tabSize,
        wordWrap,
        minimap: { enabled: minimap },
        lineNumbers,
        readOnly,
      });
    }
  }, [fontSize, tabSize, wordWrap, minimap, lineNumbers, readOnly]);

  return (
    <MonacoEditor
      value={value}
      language={language}
      theme={theme}
      height={height}
      onChange={(v) => onChange?.(v ?? "")}
      onMount={(editor, monaco) => {
        editorRef.current = editor;
        editor.updateOptions({
          fontSize,
          tabSize,
          wordWrap,
          minimap: { enabled: minimap },
          lineNumbers,
          readOnly,
          fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
          fontLigatures: true,
          smoothScrolling: true,
          cursorBlinking: "smooth",
          cursorSmoothCaretAnimation: "on",
          renderWhitespace: "selection",
          scrollBeyondLastLine: false,
          automaticLayout: true,
          bracketPairColorization: { enabled: true },
          guides: { bracketPairs: true, indentation: true },
          suggest: { showMethods: true, showFunctions: true, showConstructors: true },
          quickSuggestions: { other: "on", comments: "off", strings: "on" },
          ...options,
        });
        onMount?.(editor, monaco);
      }}
      options={options}
    />
  );
}
