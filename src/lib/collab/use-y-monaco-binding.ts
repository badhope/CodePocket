// @ts-nocheck -- third-party types are incomplete
"use client";

import { useEffect, useRef } from "react";
import * as Y from "yjs";
import { MonacoBinding } from "y-monaco";
import type { editor } from "monaco-editor";

export interface UseYMonacoBindingOptions {
  ydoc: Y.Doc | null;
  fieldName?: string;
}

export function useYMonacoBinding(
  monacoEditor: editor.IStandaloneCodeEditor | null,
  options: UseYMonacoBindingOptions,
) {
  const bindingRef = useRef<MonacoBinding | null>(null);

  useEffect(() => {
    if (!monacoEditor || !options.ydoc) {
      bindingRef.current?.destroy();
      bindingRef.current = null;
      return;
    }
    const fieldName = options.fieldName ?? "content";
    const ytext = options.ydoc.getText(fieldName);
    const binding = new MonacoBinding(
      ytext,
      monacoEditor.getModel() as editor.ITextModel,
      new Set([monacoEditor]),
    );
    bindingRef.current = binding;
    return () => {
      binding.destroy();
      bindingRef.current = null;
    };
  }, [monacoEditor, options.ydoc, options.fieldName]);
}
