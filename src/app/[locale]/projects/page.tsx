"use client";
// @ts-nocheck

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Search, FileCode } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

interface Project {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  language: string;
  visibility: string;
  updatedAt: string;
}

export default function ProjectsPage() {
  const locale = useLocale();
  const [items, setItems] = useState<Project[] | null>(null);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    fetch(`/api/projects?q=${encodeURIComponent(q)}`)
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
    <div className="container mx-auto max-w-7xl space-y-6 p-4 md:p-8">
      <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-3xl font-bold">Projects</h1>
          <p className="text-muted-foreground">Your multi-file code projects</p>
        </div>
        <Button asChild>
          <Link href={`/${locale}/projects/new`}>
            <Plus className="mr-2 size-4" /> New project
          </Link>
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search projects..."
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
          {items.map((p) => (
            <Link key={p.id} href={`/${locale}/projects/${p.id}`}>
              <Card className="hover:border-primary/50 h-full transition-colors">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <FileCode className="text-primary size-6" />
                    <Badge variant="outline">{p.language}</Badge>
                  </div>
                  <CardTitle className="line-clamp-1">{p.name}</CardTitle>
                  <CardDescription className="line-clamp-2">
                    {p.description || "No description"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground text-xs">
                    Updated {new Date(p.updatedAt).toLocaleDateString()}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card className="py-12 text-center">
          <CardContent>
            <FileCode className="text-muted-foreground mx-auto mb-4 size-12" />
            <h3 className="mb-2 text-lg font-semibold">No projects yet</h3>
            <p className="text-muted-foreground mb-4 text-sm">Create your first project to get started</p>
            <Button asChild>
              <Link href={`/${locale}/projects/new`}>
                <Plus className="mr-2 size-4" /> New project
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
