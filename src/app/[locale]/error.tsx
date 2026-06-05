"use client";

import { useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, RefreshCw, Home, Wrench, ExternalLink } from "lucide-react";
import { useBackendStatus } from "@/lib/system/backend-status";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/navigation";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { status, recheck } = useBackendStatus();
  const t = useTranslations("errors");
  const tBs = useTranslations("backendStatus");

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("[docforge:error-boundary]", error);
  }, [error]);

  return (
    <div className="container mx-auto max-w-2xl px-4 py-10 md:py-16">
      <Card>
        <CardHeader>
          <div className="mb-2 flex items-center gap-3">
            <span className="bg-muted inline-flex size-10 items-center justify-center rounded-md">
              <AlertTriangle className="size-5 text-red-600 dark:text-red-400" />
            </span>
            <div>
              <CardTitle>{t("title")}</CardTitle>
              <CardDescription className="mt-1">{t("body")}</CardDescription>
            </div>
            {status.state !== "online" && (
              <Badge variant="destructive" className="ml-auto">
                {status.state}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {error.message && (
            <pre className="bg-muted/40 max-h-48 overflow-auto rounded-md border p-3 font-mono text-xs">
              {error.message}
            </pre>
          )}
          {error.digest && <p className="text-muted-foreground font-mono text-xs">digest: {error.digest}</p>}
          {(status.state === "offline" || status.state === "unsupported") && (
            <div className="bg-muted/30 text-muted-foreground rounded-md border p-3 text-xs">
              {tBs("offlineBody")}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={reset} size="sm">
              <RefreshCw className="mr-1.5 size-3.5" />
              {t("retry")}
            </Button>
            <Button onClick={recheck} variant="outline" size="sm">
              {tBs("retry")}
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/">
                <Home className="mr-1.5 size-3.5" />
                {t("home")}
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/tools">
                <Wrench className="mr-1.5 size-3.5" />
                {t("offlineTools")}
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <a href="https://github.com/badhope/OnlineCode/issues" target="_blank" rel="noreferrer">
                <ExternalLink className="mr-1.5 size-3.5" />
                {t("reportIssue")}
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
