"use client";
// @ts-nocheck -- third-party types are incomplete

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale } from "next-intl";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { LockedOverlay } from "@/components/system/locked-overlay";
import { useFeatureGate } from "@/lib/system/feature-gate";
import { AlertCircle, Clock, Code2, Lock } from "lucide-react";

interface ShareData {
  share: {
    id: string;
    shortId: string;
    projectId: string | null;
    snippetId: string | null;
    visibility: string;
    burned: boolean;
    expiresAt: string | null;
    createdAt: string;
    viewCount: number;
  };
  content: {
    title?: string;
    name?: string;
    description?: string | null;
    language?: string;
    code?: string;
    files?: Array<{ path: string; content: string | null; type: string }>;
  } | null;
}

export interface ShareViewClientProps {
  shortId: string;
}

export default function ShareViewClient({ shortId }: ShareViewClientProps) {
  const locale = useLocale();
  const gate = useFeatureGate("share.resolve");
  const [data, setData] = useState<ShareData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!shortId) return;
    if (!gate.enabled) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    fetch(`/api/s/${shortId}`)
      .then(async (r) => {
        if (r.status === 404) throw new Error("not_found");
        if (r.status === 401) throw new Error("unauthorized");
        if (r.status === 410) throw new Error("expired");
        if (!r.ok) throw new Error("load_failed");
        return r.json();
      })
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "unknown");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [shortId, gate.enabled]);

  if (!gate.enabled) {
    return (
      <div className="container mx-auto max-w-4xl p-4 md:p-8">
        <LockedOverlay feature="share.resolve" />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container mx-auto max-w-4xl space-y-4 p-4 md:p-8">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto max-w-2xl p-8">
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <AlertCircle className="text-destructive size-12" />
            <h2 className="text-lg font-semibold">
              {error === "not_found"
                ? "Share not found"
                : error === "expired"
                  ? "Link expired"
                  : error === "unauthorized"
                    ? "Password required"
                    : "Failed to load"}
            </h2>
            <Button asChild>
              <Link href={`/${locale}`}>Go home</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  const c = data.content;
  const isProject = !!data.share.projectId;
  const title = c?.title ?? c?.name ?? "Shared code";
  const language = c?.language ?? "plaintext";
  const description = c?.description;

  return (
    <div className="container mx-auto max-w-4xl space-y-6 p-4 md:p-8">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Code2 className="text-primary size-5" />
            <CardTitle>{title}</CardTitle>
            <Badge variant="outline">{language}</Badge>
            {data.share.visibility === "password" && <Lock className="text-muted-foreground size-4" />}
          </div>
          {description && <CardDescription>{description}</CardDescription>}
          {data.share.expiresAt && (
            <p className="text-muted-foreground flex items-center gap-1 text-xs">
              <Clock className="size-3" /> Expires {new Date(data.share.expiresAt).toLocaleString()}
            </p>
          )}
          <p className="text-muted-foreground text-xs">
            {data.share.viewCount} view{data.share.viewCount === 1 ? "" : "s"} · {isProject ? "Project" : "Snippet"}
          </p>
        </CardHeader>
        <CardContent>
          {c?.code && (
            <pre className="bg-muted overflow-x-auto rounded p-4 text-xs">
              <code>{c.code}</code>
            </pre>
          )}
          {c?.files && c.files.length > 0 && (
            <div className="space-y-3">
              {c.files
                .filter((f) => f.type === "file")
                .map((f) => (
                  <div key={f.path}>
                    <p className="mb-1 font-mono text-xs font-medium">{f.path}</p>
                    <pre className="bg-muted overflow-x-auto rounded p-3 text-xs">
                      <code>{f.content ?? ""}</code>
                    </pre>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
