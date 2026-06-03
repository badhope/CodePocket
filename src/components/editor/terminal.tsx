// @ts-nocheck
"use client";

import { useEffect, useRef } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import "@xterm/xterm/css/xterm.css";
import { useTheme } from "next-themes";

export interface TerminalProps {
  className?: string;
  welcomeMessage?: string;
  onInput?: (data: string) => void;
}

export function Terminal({ className, welcomeMessage, onInput }: TerminalProps) {
  const ref = useRef<HTMLDivElement>(null);
  const termRef = useRef<XTerm | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const { theme } = useTheme();

  useEffect(() => {
    if (!ref.current) return;
    const term = new XTerm({
      fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
      fontSize: 13,
      lineHeight: 1.2,
      cursorBlink: true,
      cursorStyle: "bar",
      convertEol: true,
      theme:
        theme === "light"
          ? {
              background: "#ffffff",
              foreground: "#1f2328",
              cursor: "#1f2328",
              selectionBackground: "#add6ff80",
              black: "#000000",
              red: "#cf222e",
              green: "#1a7f37",
              yellow: "#9a6700",
              blue: "#0969da",
              magenta: "#8250df",
              cyan: "#1b7c83",
              white: "#6e7781",
              brightBlack: "#656d76",
              brightRed: "#a40e26",
              brightGreen: "#116329",
              brightYellow: "#7d4e00",
              brightBlue: "#0550ae",
              brightMagenta: "#6639ba",
              brightCyan: "#0a4f5a",
              brightWhite: "#424a53",
            }
          : {
              background: "#0d1117",
              foreground: "#e6edf3",
              cursor: "#e6edf3",
              selectionBackground: "#264f78",
              black: "#484f58",
              red: "#ff7b72",
              green: "#7ee787",
              yellow: "#d2a8ff",
              blue: "#79c0ff",
              magenta: "#ff7b72",
              cyan: "#79c0ff",
              white: "#b1bac4",
              brightBlack: "#6e7681",
              brightRed: "#ffa198",
              brightGreen: "#7ee787",
              brightYellow: "#d2a8ff",
              brightBlue: "#79c0ff",
              brightMagenta: "#ffa198",
              brightCyan: "#79c0ff",
              brightWhite: "#ffffff",
            },
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.loadAddon(new WebLinksAddon());
    term.open(ref.current);
    fit.fit();
    termRef.current = term;
    fitRef.current = fit;

    if (welcomeMessage) term.writeln(welcomeMessage);

    const sub = term.onData((d) => onInput?.(d));
    const ro = new ResizeObserver(() => {
      try {
        fit.fit();
      } catch {}
    });
    ro.observe(ref.current);

    return () => {
      sub.dispose();
      ro.disconnect();
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
    };
  }, [theme, welcomeMessage, onInput]);

  return <div ref={ref} className={className} style={{ minHeight: 100, width: "100%", height: "100%" }} />;
}
