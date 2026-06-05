"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Home, Wrench, Search, ExternalLink } from "lucide-react";
import { useBackendStatus } from "@/lib/system/backend-status";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/navigation";

export default function NotFound() {
  const { status } = useBackendStatus();
  const t = useTranslations("errors");
  const tBs = useTranslations("backendStatus");

  return (
    <div className="container mx-auto max-w-2xl px-4 py-10 md:py-16">
      <Card>
        <CardHeader>
          <div className="mb-2 flex items-center gap-3">
            <span className="bg-muted inline-flex size-10 items-center justify-center rounded-md">
              <Search className="text-muted-foreground size-5" />
            </span>
            <div>
              <CardTitle>{t("notFoundTitle")}</CardTitle>
              <CardDescription className="mt-1">{t("notFoundBody")}</CardDescription>
            </div>
            {status.state !== "online" && (
              <Badge variant="destructive" className="ml-auto">
                {status.state}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {(status.state === "offline" || status.state === "unsupported") && (
            <div className="bg-muted/30 text-muted-foreground rounded-md border p-3 text-xs">
              {tBs("offlineBody")} — {t("pageMayBeLocked")}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild size="sm">
              <Link href="/">
                <Home className="mr-1.5 size-3.5" />
                {t("home")}
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
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
