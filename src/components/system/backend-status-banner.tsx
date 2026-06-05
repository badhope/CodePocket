"use client";

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { AlertTriangle, CheckCircle2, CircleDashed, CloudOff, ExternalLink, Loader2, RefreshCw, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useBackendStatus, type BackendState } from "@/lib/system/backend-status"
import { cn } from "@/lib/utils"

const REPO_URL = "https://github.com/badhope/DocForge"

const BOOT_COMMANDS = [
  "git clone https://github.com/badhope/DocForge",
  "cd DocForge",
  "pnpm install",
  "make up           # starts Postgres + Redis + Piston-shim + migrations",
  "make dev          # starts Next.js on http://localhost:3000",
].join("\n")

export function BackendStatusBanner() {
  const t = useTranslations("backendStatus")
  const { status, recheck, backendAvailable } = useBackendStatus()
  const [dismissed, setDismissed] = useState(false)
  const [expanded, setExpanded] = useState(false)
  // auto-dismiss the success banner after 4s — we keep the small dot in
  // the header for the rest of the session.
  const [autoShown, setAutoShown] = useState(false)
  useEffect(() => {
    if (backendAvailable && !autoShown) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAutoShown(true)
      const id = setTimeout(() => setDismissed(true), 4000)
      return () => clearTimeout(id)
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDismissed(false)
    return undefined
  }, [backendAvailable, autoShown])

  // Don't show anything while we're doing the very first probe
  if (status.state === "checking" && status.lastChecked === 0) return null
  // "online" — only show the "back online" toast once
  if (status.state === "online" && dismissed) return null
  // "degraded" — always show so the user knows sub-systems are wobbling
  if (status.state === "degraded" && dismissed) return null
  if ((status.state === "offline" || status.state === "unsupported") && dismissed) {
    return null
  }

  const config = bannerConfig(status.state, t)

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "border-b",
        config.containerClass,
        "transition-colors",
      )}
    >
      <div className="container mx-auto flex max-w-7xl items-start gap-3 px-4 py-2.5 md:px-8">
        <config.Icon className={cn("mt-0.5 size-4 shrink-0", config.iconClass, status.state === "checking" && "animate-spin")} />
        <div className="min-w-0 flex-1 text-sm">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className={cn("font-semibold", config.titleClass)}>{config.title}</span>
            <span className="text-muted-foreground text-xs">
              {t("lastChecked", { when: relativeTime(status.lastChecked) })}
              {status.latencyMs != null && status.state === "online" && ` · ${status.latencyMs}ms`}
              {status.server?.version && ` · v${status.server.version}`}
            </span>
          </div>
          <p className="text-foreground/90 mt-0.5 leading-snug">
            {config.body}
            {status.error && <span className="text-muted-foreground"> — {status.error}</span>}
          </p>

          {expanded && (status.state === "offline" || status.state === "unsupported") && (
            <div className="mt-3 space-y-3">
              <div className="rounded-md border bg-black/5 p-3 font-mono text-xs leading-relaxed dark:bg-white/5">
                <pre className="whitespace-pre-wrap break-all">{BOOT_COMMANDS}</pre>
                <button
                  onClick={() => void navigator.clipboard.writeText(BOOT_COMMANDS)}
                  className="hover:text-foreground text-muted-foreground mt-2 inline-flex items-center gap-1 text-[10px] uppercase tracking-wide transition"
                >
                  {t("copy")}
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild size="sm" variant="default">
                  <a href={REPO_URL} target="_blank" rel="noreferrer">
                    <ExternalLink className="mr-1.5 size-3.5" />
                    {t("openRepo")}
                  </a>
                </Button>
                <Button size="sm" variant="outline" onClick={recheck}>
                  <RefreshCw className="mr-1.5 size-3.5" />
                  {t("retry")}
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {(status.state === "offline" || status.state === "unsupported") && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? t("hideGuide") : t("showGuide")}
            </Button>
          )}
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={() => setDismissed(true)}
            aria-label={t("dismiss")}
          >
            <X className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}

function bannerConfig(state: BackendState, t: ReturnType<typeof useTranslations<"backendStatus">>) {
  switch (state) {
    case "checking":
      return {
        containerClass: "bg-muted/60 border-border",
        iconClass: "text-muted-foreground",
        titleClass: "text-foreground",
        title: t("checking"),
        body: t("checkingBody"),
        Icon: Loader2,
      }
    case "online":
      return {
        containerClass: "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900",
        iconClass: "text-emerald-600 dark:text-emerald-400",
        titleClass: "text-emerald-900 dark:text-emerald-100",
        title: t("online"),
        body: t("onlineBody"),
        Icon: CheckCircle2,
      }
    case "degraded":
      return {
        containerClass: "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900",
        iconClass: "text-amber-600 dark:text-amber-400",
        titleClass: "text-amber-900 dark:text-amber-100",
        title: t("degraded"),
        body: t("degradedBody"),
        Icon: AlertTriangle,
      }
    case "unsupported":
      return {
        containerClass: "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900",
        iconClass: "text-amber-600 dark:text-amber-400",
        titleClass: "text-amber-900 dark:text-amber-100",
        title: t("unsupported"),
        body: t("unsupportedBody"),
        Icon: CloudOff,
      }
    case "offline":
    default:
      return {
        containerClass: "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-900",
        iconClass: "text-red-600 dark:text-red-400",
        titleClass: "text-red-900 dark:text-red-100",
        title: t("offline"),
        body: t("offlineBody"),
        Icon: CloudOff,
      }
  }
}

function relativeTime(ts: number): string {
  if (!ts) return "—"
  const dt = Math.max(0, Date.now() - ts)
  if (dt < 5_000) return "just now"
  if (dt < 60_000) return `${Math.round(dt / 1000)}s ago`
  if (dt < 3_600_000) return `${Math.round(dt / 60_000)}m ago`
  return new Date(ts).toLocaleTimeString()
}

/** Tiny status dot for the header — no copy, just color. */
export function BackendStatusDot({ className }: { className?: string }) {
  const { status } = useBackendStatus()
  const color =
    status.state === "online"
      ? "bg-emerald-500"
      : status.state === "degraded"
        ? "bg-amber-500"
        : status.state === "checking"
          ? "bg-blue-500 animate-pulse"
          : "bg-red-500"
  return (
    <span
      title={
        status.state === "online"
          ? "Backend online"
          : status.state === "degraded"
            ? "Backend degraded"
            : status.state === "checking"
              ? "Checking backend…"
              : "Backend offline"
      }
      className={cn("inline-block size-2 shrink-0 rounded-full", color, className)}
    />
  )
}

/** Same content as the banner but designed for tooltips / inline hints. */
export function BackendHint({ className }: { className?: string }) {
  const t = useTranslations("backendStatus")
  const { status, recheck } = useBackendStatus()
  if (status.state === "online") {
    return (
      <span className={cn("text-muted-foreground inline-flex items-center gap-1.5 text-xs", className)}>
        <CircleDashed className="size-3" />
        {t("online")}
      </span>
    )
  }
  return (
    <span className={cn("text-muted-foreground inline-flex items-center gap-1.5 text-xs", className)}>
      <CloudOff className="size-3" />
      {status.state === "checking" ? t("checking") : t("offline")}
      <button onClick={recheck} className="hover:text-foreground ml-1 underline">
        {t("retry")}
      </button>
    </span>
  )
}
