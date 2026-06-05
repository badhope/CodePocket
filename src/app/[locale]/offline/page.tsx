"use client"

import { useBackendStatus } from "@/lib/system/backend-status"
import { useTranslations } from "next-intl"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Copy, ExternalLink, RefreshCw, CheckCircle2, AlertTriangle, CloudOff, CircleDashed } from "lucide-react"
import { toast } from "sonner"
import { Link } from "@/lib/i18n/navigation"
import { useEffect, useState } from "react"

const REPO_URL = "https://github.com/badhope/DocForge"

const BOOT_COMMANDS = [
  "git clone https://github.com/badhope/DocForge",
  "cd DocForge",
  "pnpm install",
  "make up           # starts Postgres + Redis + Piston-shim + migrations",
  "make dev          # starts Next.js on http://localhost:3000",
].join("\n")

export default function OfflinePage() {
  const { status, recheck } = useBackendStatus()
  const t = useTranslations("backendStatus")
  const tCommon = useTranslations("common")
  const tErrors = useTranslations("errors")
  const tTools = useTranslations("tools")
  const [copied, setCopied] = useState(false)

  // Re-probe when the user lands here so they see "online" as soon as the
  // backend is back.
  useEffect(() => {
    if (status.state === "offline" || status.state === "unsupported") {
      recheck()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const copyCommands = async () => {
    try {
      await navigator.clipboard.writeText(BOOT_COMMANDS)
      setCopied(true)
      toast.success("Copied to clipboard")
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("Copy failed")
    }
  }

  const config = (() => {
    if (status.state === "online") {
      return {
        icon: CheckCircle2,
        color: "text-emerald-600 dark:text-emerald-400",
        title: tCommon("backendRecoveredTitle"),
        body: tCommon("backendRecoveredBody"),
      }
    }
    if (status.state === "degraded") {
      return {
        icon: AlertTriangle,
        color: "text-amber-600 dark:text-amber-400",
        title: t("degraded"),
        body: t("degradedBody"),
      }
    }
    if (status.state === "unsupported") {
      return {
        icon: CloudOff,
        color: "text-muted-foreground",
        title: t("unsupported"),
        body: t("unsupportedBody"),
      }
    }
    if (status.state === "checking") {
      return {
        icon: CircleDashed,
        color: "text-muted-foreground",
        title: t("checking"),
        body: t("checkingBody"),
      }
    }
    return {
      icon: CloudOff,
      color: "text-red-600 dark:text-red-400",
      title: t("offline"),
      body: t("offlineBody"),
    }
  })()
  const Icon = config.icon

  return (
    <div className="container mx-auto max-w-3xl px-4 py-10 md:py-16">
      <Card>
        <CardHeader>
          <div className="mb-2 flex items-center gap-3">
            <span className="bg-muted inline-flex size-10 items-center justify-center rounded-md">
              <Icon className={`size-5 ${config.color}`} />
            </span>
            <div>
              <CardTitle>{config.title}</CardTitle>
              <CardDescription className="mt-1">{config.body}</CardDescription>
            </div>
            <Badge variant={status.state === "online" ? "default" : status.state === "degraded" ? "secondary" : "destructive"} className="ml-auto">
              {status.state}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {status.error && (
            <div className="bg-muted/40 rounded-md border p-3 font-mono text-xs">{status.error}</div>
          )}

          {(status.state === "offline" || status.state === "unsupported") && (
            <>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">{t("showGuide")}</h3>
                  <Button size="sm" variant="ghost" onClick={copyCommands}>
                    {copied ? <CheckCircle2 className="mr-1.5 size-3.5" /> : <Copy className="mr-1.5 size-3.5" />}
                    {t("copy")}
                  </Button>
                </div>
                <pre className="bg-muted/40 overflow-x-auto rounded-md border p-3 font-mono text-xs leading-relaxed">
{BOOT_COMMANDS}
                </pre>
                <Button asChild size="sm" variant="default" className="w-full sm:w-auto">
                  <a href={REPO_URL} target="_blank" rel="noreferrer">
                    <ExternalLink className="mr-1.5 size-3.5" />
                    {t("openRepo")}
                  </a>
                </Button>
              </div>
            </>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={recheck} variant="outline" size="sm">
              <RefreshCw className="mr-1.5 size-3.5" />
              {t("retry")}
            </Button>
            <Button asChild size="sm" variant="ghost">
              <Link href="/tools">{tTools("title")} →</Link>
            </Button>
            <Button asChild size="sm" variant="ghost">
              <Link href="/playground">Playground →</Link>
            </Button>
            <span className="text-muted-foreground ml-auto text-xs">
              {tErrors("needHelp")} <a className="underline" href={`${REPO_URL}/issues`} target="_blank" rel="noreferrer">GitHub</a>
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
