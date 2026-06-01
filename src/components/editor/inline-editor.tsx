"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full" />,
});

export interface InlineEditorProps {
  value: string;
  onChange?: (v: string) => void;
  language?: string;
  height?: string | number;
  className?: string;
  readOnly?: boolean;
}

export function InlineEditor({ value, onChange, language = "plaintext", height = 200, className, readOnly }: InlineEditorProps) {
  return (
    <div className={className} style={{ height }}>
      <MonacoEditor
        value={value}
        language={language}
        height={height}
        onChange={(v) => onChange?.(v ?? "")}
        options={{
          readOnly,
          minimap: { enabled: false },
          fontSize: 13,
          lineNumbers: "on",
          scrollBeyondLastLine: false,
          automaticLayout: true,
          fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
        }}
      />
    </div>
  );
}

export interface DebouncedEditorProps extends InlineEditorProps {
  onSave?: (v: string) => Promise<void> | void;
  delayMs?: number;
}

export function DebouncedEditor({ value, onSave, onChange, delayMs = 1500, ...rest }: DebouncedEditorProps) {
  const [local, setLocal] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = useRef(false);

  useEffect(() => {
    if (!dirty.current) setLocal(value);
  }, [value]);

  const handleChange = useCallback(
    (v: string) => {
      setLocal(v);
      dirty.current = true;
      onChange?.(v);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(async () => {
        await onSave?.(v);
        dirty.current = false;
      }, delayMs);
    },
    [onChange, onSave, delayMs],
  );

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return <InlineEditor {...rest} value={local} onChange={handleChange} />;
}
