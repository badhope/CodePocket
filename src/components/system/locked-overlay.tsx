"use client";

import Link from "next/link"
import { useLocale } from "next-intl"
import { CloudOff, ExternalLink, Lock, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useFeatureGate, type FeatureId } from "@/lib/system/feature-gate"
import { cn } from "@/lib/utils"

const REPO_URL = "https://github.com/badhope/DocForge"

const COPY = {
  zh: {
    title: "此功能需要后端服务",
    subtitle: "请在本地启动 DocForge 后端以解锁",
    steps: [
      "git clone https://github.com/badhope/DocForge",
      "cd DocForge",
      "pnpm install",
      "make up    # Postgres + Redis + Piston + 迁移",
      "make dev   # 启动 Next.js → http://localhost:3000",
    ],
    cta: "查看仓库",
    retry: "重试",
    ctaBrowse: "浏览可用离线工具",
  },
  en: {
    title: "This feature needs the backend",
    subtitle: "Run DocForge locally to unlock it",
    steps: [
      "git clone https://github.com/badhope/DocForge",
      "cd DocForge",
      "pnpm install",
      "make up    # Postgres + Redis + Piston + migrations",
      "make dev   # starts Next.js → http://localhost:3000",
    ],
    cta: "Open the repository",
    retry: "Retry",
    ctaBrowse: "Browse offline tools",
  },
}

export function LockedOverlay({
  feature,
  className,
  inline = false,
  children,
}: {
  feature: FeatureId
  className?: string
  /** inline mode disables the full overlay chrome and just renders a pill */
  inline?: boolean
  /** children shown under the lock message (e.g. preview) */
  children?: React.ReactNode
}) {
  const locale = useLocale()
  const gate = useFeatureGate(feature)
  if (gate.enabled) return null
  const copy = COPY[locale === "zh-CN" ? "zh" : "en"]

  if (inline) {
    return (
      <div
        className={cn(
          "border-muted-foreground/20 bg-muted/40 text-muted-foreground inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs",
          className,
        )}
      >
        <Lock className="size-3" />
        <span>{copy.title}</span>
      </div>
    )
  }

  return (
    <Card className={cn("border-dashed", className)}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <span className="bg-muted text-muted-foreground inline-flex size-8 items-center justify-center rounded-full">
            <Lock className="size-4" />
          </span>
          <div>
            <CardTitle className="text-base">{copy.title}</CardTitle>
            <CardDescription>{copy.subtitle}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {children && <div className="pointer-events-none opacity-50">{children}</div>}
        <div className="bg-muted/60 rounded-md border p-3 font-mono text-xs leading-relaxed">
          <pre className="whitespace-pre-wrap break-all">{copy.steps.join("\n")}</pre>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm">
            <a href={REPO_URL} target="_blank" rel="noreferrer">
              <ExternalLink className="mr-1.5 size-3.5" />
              {copy.cta}
            </a>
          </Button>
          <RetryButton label={copy.retry} />
          <Button asChild size="sm" variant="outline">
            <Link href={`/${locale}/tools`}>
              <CloudOff className="mr-1.5 size-3.5" />
              {copy.ctaBrowse}
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function RetryButton({ label }: { label: string }) {
  // local remount to re-trigger the global probe via the banner's recheck
  return (
    <Button
      size="sm"
      variant="outline"
      onClick={() => {
        // easiest reliable re-probe: force a fresh fetch that the global
        // store will observe on the next status emit
        fetch("/api/health", { cache: "no-store" })
          .catch(() => undefined)
          .finally(() => window.dispatchEvent(new Event("online")))
      }}
    >
      <RefreshCw className="mr-1.5 size-3.5" />
      {label}
    </Button>
  )
}
