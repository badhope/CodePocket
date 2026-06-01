"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Plus, Trash2, Package as PackageIcon, Copy } from "lucide-react";
import { toast } from "sonner";
import { ECOSYSTEMS, PackageEcosystem, PackageRecord, renderManifest } from "@/lib/packages";
import { cn } from "@/lib/utils";

export interface PackageManagerProps {
  projectId: string;
  className?: string;
}

export function PackageManager({ projectId, className }: PackageManagerProps) {
  const [packages, setPackages] = useState<PackageRecord[] | null>(null);
  const [ecosystem, setEcosystem] = useState<PackageEcosystem>("npm");
  const [name, setName] = useState("");
  const [version, setVersion] = useState("");
  const [dev, setDev] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/packages`);
      if (!res.ok) {
        setPackages([]);
        return;
      }
      const data = (await res.json()) as { packages: PackageRecord[] };
      setPackages(data.packages);
    } catch {
      setPackages([]);
    }
  }, [projectId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const filtered = useMemo(
    () => (packages ?? []).filter((p) => p.ecosystem === ecosystem),
    [packages, ecosystem],
  );

  const add = useCallback(async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/packages`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ecosystem,
          name: name.trim(),
          version: version.trim() || undefined,
          dev,
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? "add_failed");
      }
      setName("");
      setVersion("");
      setDev(false);
      await load();
      toast.success(`Added ${name}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }, [name, version, dev, ecosystem, projectId, load]);

  const remove = useCallback(
    async (p: PackageRecord) => {
      try {
        const res = await fetch(`/api/projects/${projectId}/packages`, {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ecosystem: p.ecosystem, name: p.name }),
        });
        if (!res.ok) throw new Error("remove_failed");
        await load();
        toast.success(`Removed ${p.name}`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed");
      }
    },
    [projectId, load],
  );

  const copyManifest = useCallback(async () => {
    const content = renderManifest(ecosystem, filtered);
    try {
      await navigator.clipboard.writeText(content);
      toast.success("Manifest copied");
    } catch {
      toast.error("Copy failed");
    }
  }, [ecosystem, filtered]);

  if (packages === null) {
    return (
      <div className={cn("space-y-2 p-4", className)}>
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  return (
    <div className={cn("flex h-full flex-col gap-3 p-3", className)}>
      <Tabs
        value={ecosystem}
        onValueChange={(v) => setEcosystem(v as PackageEcosystem)}
        className="flex-1"
      >
        <TabsList>
          {Object.values(ECOSYSTEMS).map((e) => (
            <TabsTrigger key={e.id} value={e.id}>
              {e.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {Object.values(ECOSYSTEMS).map((e) => (
          <TabsContent key={e.id} value={e.id} className="space-y-3">
            <div className="space-y-2 rounded-md border p-3">
              <div className="flex gap-2">
                <div className="flex-1 space-y-1">
                  <Label htmlFor={`pkg-name-${e.id}`}>Name</Label>
                  <Input
                    id={`pkg-name-${e.id}`}
                    value={name}
                    onChange={(ev) => setName(ev.target.value)}
                    placeholder={e.placeholder}
                    onKeyDown={(ev) => {
                      if (ev.key === "Enter") void add();
                    }}
                  />
                </div>
                <div className="w-24 space-y-1">
                  <Label htmlFor={`pkg-ver-${e.id}`}>Version</Label>
                  <Input
                    id={`pkg-ver-${e.id}`}
                    value={version}
                    onChange={(ev) => setVersion(ev.target.value)}
                    placeholder="*"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Switch id={`pkg-dev-${e.id}`} checked={dev} onCheckedChange={setDev} />
                  <Label htmlFor={`pkg-dev-${e.id}`} className="text-xs">
                    dev dependency
                  </Label>
                </div>
                <Button size="sm" onClick={add} disabled={busy || !name.trim()}>
                  <Plus className="size-4" /> Add
                </Button>
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-muted-foreground flex items-center justify-between text-xs">
                <span>
                  {filtered.length} package{filtered.length === 1 ? "" : "s"} · manifest:{" "}
                  <code className="bg-muted rounded px-1">{e.manifestFile}</code>
                </span>
                <Button size="sm" variant="ghost" onClick={copyManifest} disabled={filtered.length === 0}>
                  <Copy className="size-3" /> Copy manifest
                </Button>
              </div>
              {filtered.length === 0 ? (
                <p className="text-muted-foreground py-6 text-center text-xs">
                  No packages yet — add one above.
                </p>
              ) : (
                <div className="divide-y rounded-md border">
                  {filtered.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center gap-2 px-2 py-1.5 text-sm"
                    >
                      <PackageIcon className="text-muted-foreground size-3.5" />
                      <span className="font-mono">{p.name}</span>
                      {p.version && (
                        <Badge variant="outline" className="font-mono">
                          {p.version}
                        </Badge>
                      )}
                      {p.dev && <Badge variant="secondary">dev</Badge>}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="ml-auto size-6"
                        onClick={() => void remove(p)}
                        aria-label="Remove"
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-muted-foreground text-[10px]">
                Run <code className="bg-muted rounded px-1">{e.installCmd}</code> locally to install.
              </p>
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
