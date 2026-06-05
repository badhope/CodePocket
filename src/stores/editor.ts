"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

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
// Force a value-side use so the no-unused-vars rule doesn't complain
// about the array. We only need it for the `Language` type.
void SUPPORTED_LANGUAGES;

export interface EditorTab {
  id: string;
  path: string;
  language: string;
  content: string;
  savedContent: string;
  isDirty: boolean;
  isReadOnly?: boolean;
}

interface OutputLine {
  type: "info" | "out" | "err" | "warn" | "html";
  text: string;
}

interface EditorState {
  tabs: EditorTab[];
  activeTabId: string | null;
  currentLanguage: Language;
  output: OutputLine[];
  isRunning: boolean;
  isExecuting: boolean;
  activeOutputTab: "console" | "graphics" | "canvas3d";
  fontSize: number;
  wordWrap: boolean;
  minimap: boolean;
  autoSave: boolean;
  theme: "light" | "dark" | "system";

  addTab: (tab: Omit<EditorTab, "isDirty" | "savedContent"> & { savedContent?: string }) => void;
  closeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  updateTab: (id: string, patch: Partial<EditorTab>) => void;
  markClean: (id: string) => void;
  setLanguage: (lang: Language) => void;
  setFontSize: (n: number) => void;
  setWordWrap: (b: boolean) => void;
  setMinimap: (b: boolean) => void;
  setAutoSave: (b: boolean) => void;
  setTheme: (t: "light" | "dark" | "system") => void;
  setActiveOutputTab: (t: "console" | "graphics" | "canvas3d") => void;

  appendOutput: (line: OutputLine) => void;
  clearOutput: () => void;
  setIsExecuting: (b: boolean) => void;
  setIsRunning: (b: boolean) => void;
}

export const useEditorStore = create<EditorState>()(
  persist(
    (set) => ({
      tabs: [],
      activeTabId: null,
      currentLanguage: "python",
      output: [],
      isRunning: false,
      isExecuting: false,
      activeOutputTab: "console",
      fontSize: 14,
      wordWrap: true,
      minimap: false,
      autoSave: true,
      theme: "dark",

      addTab: (tab) =>
        set((s) => {
          const existing = s.tabs.find((t) => t.path === tab.path);
          if (existing) {
            return { activeTabId: existing.id };
          }
          const savedContent = tab.savedContent ?? tab.content;
          return {
            tabs: [...s.tabs, { ...tab, savedContent, isDirty: false }],
            activeTabId: tab.id,
          };
        }),
      closeTab: (id) =>
        set((s) => {
          const idx = s.tabs.findIndex((t) => t.id === id);
          if (idx === -1) return s;
          const newTabs = s.tabs.filter((t) => t.id !== id);
          const newActive =
            s.activeTabId === id
              ? (newTabs[idx]?.id ?? newTabs[idx - 1]?.id ?? newTabs[0]?.id ?? null)
              : s.activeTabId;
          return { tabs: newTabs, activeTabId: newActive };
        }),
      setActiveTab: (id) => set({ activeTabId: id }),
      updateTab: (id, patch) =>
        set((s) => ({
          tabs: s.tabs.map((t) => {
            if (t.id !== id) return t;
            const next = { ...t, ...patch };
            next.isDirty = next.content !== next.savedContent;
            return next;
          }),
        })),
      markClean: (id) =>
        set((s) => ({
          tabs: s.tabs.map((t) =>
            t.id === id ? { ...t, isDirty: false, savedContent: t.content } : t,
          ),
        })),
      setLanguage: (lang) => set({ currentLanguage: lang }),
      setFontSize: (n) => set({ fontSize: Math.max(10, Math.min(24, n)) }),
      setWordWrap: (b) => set({ wordWrap: b }),
      setMinimap: (b) => set({ minimap: b }),
      setAutoSave: (b) => set({ autoSave: b }),
      setTheme: (t) => set({ theme: t }),
      setActiveOutputTab: (t) => set({ activeOutputTab: t }),

      appendOutput: (line) => set((s) => ({ output: [...s.output, line] })),
      clearOutput: () => set({ output: [] }),
      setIsExecuting: (b) => set({ isExecuting: b }),
      setIsRunning: (b) => set({ isRunning: b }),
    }),
    {
      name: "oc-editor",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        fontSize: s.fontSize,
        wordWrap: s.wordWrap,
        minimap: s.minimap,
        autoSave: s.autoSave,
        theme: s.theme,
        currentLanguage: s.currentLanguage,
      }),
    },
  ),
);
