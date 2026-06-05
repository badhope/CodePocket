"use client";
// @ts-nocheck

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { BackendGate } from "@/components/system/backend-gate";
import { Plus, Search, Code2, Heart, Eye, EyeOff } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

interface Snippet {
  id: string;
  title: string;
  description: string | null;
  language: string;
  code: string;
  tags: string[] | null;
  visibility: string;
  isPublic: boolean;
  likeCount: number;
  viewCount: number;
  updatedAt: string;
}

export default function SnippetsPage() {
  const locale = useLocale();
  const [items, setItems] = useState<Snippet[] | null>(null);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    fetch(`/api/snippets?q=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setItems(d.items ?? []);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [q]);

  return (
    <BackendGate feature="snippets.persist">
      <div className="container mx-auto max-w-7xl space-y-6 p-4 md:p-8">
        <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h1 className="text-3xl font-bold">Snippets</h1>
            <p className="text-muted-foreground">Reusable code snippets</p>
          </div>
          <Button asChild>
            <Link href={`/${locale}/snippets/new`}>
              <Plus className="mr-2 size-4" /> New snippet
            </Link>
          </Button>
        </div>

        <div className="relative max-w-md">
          <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search snippets..."
            className="pl-9"
          />
        </div>

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-40 w-full" />
            ))}
          </div>
        ) : items && items.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {items.map((s) => (
              <Card key={s.id} className="hover:border-primary/50 transition-colors">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <Code2 className="text-primary size-5" />
                    <div className="flex items-center gap-1">
                      <Badge variant="outline">{s.language}</Badge>
                      {s.visibility === "public" ? (
                        <Eye className="text-muted-foreground size-3" />
                      ) : (
                        <EyeOff className="text-muted-foreground size-3" />
                      )}
                    </div>
                  </div>
                  <CardTitle className="line-clamp-1 text-base">{s.title}</CardTitle>
                  <CardDescription className="line-clamp-2">
                    {s.description || "No description"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="bg-muted/50 mb-3 line-clamp-3 rounded p-2 font-mono text-xs">{s.code}</div>
                  {s.tags && s.tags.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-1">
                      {s.tags.map((t) => (
                        <Badge key={t} variant="secondary" className="text-xs">
                          {t}
                        </Badge>
                      ))}
                    </div>
                  )}
                  <div className="text-muted-foreground flex items-center gap-3 text-xs">
                    <span className="flex items-center gap-1">
                      <Heart className="size-3" /> {s.likeCount}
                    </span>
                    <span className="flex items-center gap-1">
                      <Eye className="size-3" /> {s.viewCount}
                    </span>
                    <span className="ml-auto">{new Date(s.updatedAt).toLocaleDateString()}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="py-12 text-center">
            <CardContent>
              <Code2 className="text-muted-foreground mx-auto mb-4 size-12" />
              <h3 className="mb-2 text-lg font-semibold">No snippets yet</h3>
              <p className="text-muted-foreground mb-4 text-sm">Save useful code as snippets</p>
              <Button asChild>
                <Link href={`/${locale}/snippets/new`}>
                  <Plus className="mr-2 size-4" /> New snippet
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </BackendGate>
  );
}
