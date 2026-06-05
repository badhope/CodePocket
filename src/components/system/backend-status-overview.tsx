"use client";

import { useBackendStatus } from "@/lib/system/backend-status";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/lib/i18n/navigation";
import { useTranslations } from "next-intl";
import {
  CheckCircle2,
  AlertTriangle,
  CircleDashed,
  CloudOff,
  Sparkles,
  ArrowRight,
  ServerOff,
  Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Features that work fully in the browser — they show as "available" even
// when the backend is offline. This list MUST stay disjoint from
// `REQUIRES_BACKEND` in `@/lib/system/feature-gate` so the overview never
// claims a backend-only feature is locally available. (The playground has
// a frontend-runner fallback, but the gated feature "playground.piston"
// specifically refers to the server-side Piston runtime, so it stays on
// the server-required side.)
const LOCAL_FEATURES = ["convert.local"] as const;

const SERVER_FEATURES = [
  "playground.python-packages",
  "convert.server",
  "auth.sign-up",
  "snippets.create",
  "snippets.persist",
  "projects.create",
  "projects.persist",
  "history.view",
  "dashboard.view",
  "share.create",
] as const;

export function BackendStatusOverview({ className }: { className?: string }) {
  const { status, recheck } = useBackendStatus();
  const t = useTranslations("backendStatus");
  const tTools = useTranslations("tools");

  const totalFeatures = LOCAL_FEATURES.length + SERVER_FEATURES.length;
  const availableCount =
    status.state === "online" || status.state === "degraded" ? totalFeatures : LOCAL_FEATURES.length;
  const colorClass =
    status.state === "online"
      ? "text-emerald-600 dark:text-emerald-400"
      : status.state === "degraded"
        ? "text-amber-600 dark:text-amber-400"
        : status.state === "offline" || status.state === "unsupported"
          ? "text-red-600 dark:text-red-400"
          : "text-muted-foreground";
  const ringClass =
    status.state === "online"
      ? "ring-emerald-500/20 bg-emerald-500/5"
      : status.state === "degraded"
        ? "ring-amber-500/20 bg-amber-500/5"
        : status.state === "offline" || status.state === "unsupported"
          ? "ring-red-500/20 bg-red-500/5"
          : "ring-border bg-muted/30";
  const StatusIcon =
    status.state === "online"
      ? CheckCircle2
      : status.state === "degraded"
        ? AlertTriangle
        : status.state === "offline" || status.state === "unsupported"
          ? CloudOff
          : CircleDashed;

  return (
    <Card className={cn("ring-1", ringClass, className)}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <StatusIcon className={cn("size-5 shrink-0", colorClass)} />
          <CardTitle className="text-base">
            {status.state === "checking" ? t("checking") : t(status.state)}
          </CardTitle>
          {status.state !== "checking" && (
            <Button
              size="icon"
              variant="ghost"
              className="ml-auto size-6"
              onClick={recheck}
              aria-label={t("retry")}
            >
              <Sparkles className="size-3.5" />
            </Button>
          )}
        </div>
        <CardDescription>
          {status.state === "online" || status.state === "degraded"
            ? t("onlineBody")
            : status.state === "unsupported"
              ? t("unsupportedBody")
              : t("offlineBody")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat
            value={availableCount}
            label={t("featuresAvailable", { count: availableCount, total: totalFeatures })}
            colorClass={colorClass}
            icon={<CheckCircle2 className="size-3" />}
          />
          <Stat
            value={totalFeatures - availableCount}
            label={t("featuresLocked", { count: totalFeatures - availableCount })}
            colorClass={
              status.state === "online" || status.state === "degraded"
                ? "text-muted-foreground"
                : "text-red-600 dark:text-red-400"
            }
            icon={<Lock className="size-3" />}
          />
          <Stat
            value={status.latencyMs ?? "—"}
            label={t("latency")}
            colorClass="text-muted-foreground"
            icon={<ServerOff className="size-3" />}
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Badge
            variant={
              status.state === "online"
                ? "default"
                : status.state === "degraded"
                  ? "secondary"
                  : "destructive"
            }
          >
            {status.state}
          </Badge>
          {status.server?.version && (
            <Badge variant="outline" className="font-mono text-xs">
              v{status.server.version}
            </Badge>
          )}
          {status.lastChecked > 0 && (
            <span className="text-muted-foreground text-xs">
              {t("lastChecked", { when: new Date(status.lastChecked).toLocaleTimeString() })}
            </span>
          )}
        </div>

        {(status.state === "offline" || status.state === "unsupported") && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button asChild size="sm">
              <Link href="/tools">
                {tTools("title")}
                <ArrowRight className="ml-1.5 size-3.5" />
              </Link>
            </Button>
            <Button size="sm" variant="outline" onClick={recheck}>
              {t("retry")}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({
  value,
  label,
  colorClass,
  icon,
}: {
  value: number | string;
  label: string;
  colorClass: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-background/60 rounded-lg border p-3">
      <div className={cn("flex items-center gap-1 text-2xl font-bold tabular-nums", colorClass)}>{value}</div>
      <div className="text-muted-foreground mt-1 flex items-center gap-1 text-xs">
        {icon}
        {label}
      </div>
    </div>
  );
}
