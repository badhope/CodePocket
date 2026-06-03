// @ts-nocheck
"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Share2, Copy, Trash2, Eye, EyeOff, Link2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

let QRCodeModule: typeof import("qrcode") | null = null;
async function getQRModule() {
  if (!QRCodeModule) {
    QRCodeModule = await import("qrcode");
  }
  return QRCodeModule;
}

export interface ShareDialogProps {
  projectId?: string;
  snippetId?: string;
  trigger?: React.ReactNode;
  className?: string;
}

interface ShareRecord {
  id: string;
  shortId: string;
  visibility: "public" | "password" | "burn_after_read";
  burned: boolean;
  expiresAt: string | null;
  viewCount: number;
  createdAt: string;
}

const EXPIRY_OPTIONS: { value: string; label: string; seconds: number | null }[] = [
  { value: "1h", label: "1 hour", seconds: 3600 },
  { value: "1d", label: "1 day", seconds: 86400 },
  { value: "7d", label: "7 days", seconds: 604800 },
  { value: "30d", label: "30 days", seconds: 2_592_000 },
  { value: "never", label: "Never", seconds: 0 },
];

export function ShareDialog({ projectId, snippetId, trigger, className }: ShareDialogProps) {
  const [open, setOpen] = useState(false);
  const [visibility, setVisibility] = useState<"public" | "password" | "burn_after_read">("public");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [expiry, setExpiry] = useState("7d");
  const [creating, setCreating] = useState(false);
  const [shares, setShares] = useState<ShareRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  const target = useMemo(
    () =>
      projectId
        ? { projectId }
        : snippetId
          ? { snippetId }
          : null,
    [projectId, snippetId],
  );

  const loadShares = useCallback(async () => {
    if (!target) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if ("projectId" in target && target.projectId) {
        params.set("projectId", target.projectId);
      } else if ("snippetId" in target && target.snippetId) {
        params.set("snippetId", target.snippetId);
      }
      const qs = params.toString();
      const res = await fetch(`/api/share?${qs}`);
      if (res.ok) {
        const data = (await res.json()) as { shares: ShareRecord[] };
        setShares(data.shares);
      }
    } catch {
      // noop
    } finally {
      setLoading(false);
    }
  }, [target]);

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void loadShares();
    }
  }, [open, loadShares]);

  const create = useCallback(async () => {
    if (!target) return;
    setCreating(true);
    try {
      const expiresIn =
        EXPIRY_OPTIONS.find((o) => o.value === expiry)?.seconds ?? 0;
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...target,
          visibility,
          password: visibility === "password" ? password : undefined,
          expiresIn,
        }),
      });
      if (!res.ok) throw new Error("create_failed");
      const data = (await res.json()) as { shortId: string };
      const url = `${window.location.origin}/s/${data.shortId}`;
      setCreatedUrl(url);
      try {
        const qrModule = await getQRModule();
        const dataUrl = await qrModule.toDataURL(url, { width: 256, margin: 1 });
        setQrDataUrl(dataUrl);
      } catch {
        setQrDataUrl(null);
      }
      await navigator.clipboard.writeText(url).catch(() => {});
      toast.success("Link copied to clipboard");
      await loadShares();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create share");
    } finally {
      setCreating(false);
    }
  }, [target, visibility, password, expiry, loadShares]);

  const revoke = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/share/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error("revoke_failed");
        await loadShares();
        toast.success("Share revoked");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to revoke");
      }
    },
    [loadShares],
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" variant="ghost" className={className} aria-label="Share">
            <Share2 className="size-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="size-5" /> Share
          </DialogTitle>
          <DialogDescription>
            Create a link anyone can use to view this {target && "projectId" in target ? "project" : "snippet"}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="share-visibility">Visibility</Label>
              <Select
                value={visibility}
                onValueChange={(v) =>
                  setVisibility(v as "public" | "password" | "burn_after_read")
                }
              >
                <SelectTrigger id="share-visibility">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">Public link</SelectItem>
                  <SelectItem value="password">Password</SelectItem>
                  <SelectItem value="burn_after_read">Burn after read</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="share-expiry">Expires</Label>
              <Select value={expiry} onValueChange={setExpiry}>
                <SelectTrigger id="share-expiry">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPIRY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {visibility === "password" && (
            <div className="space-y-1.5">
              <Label htmlFor="share-password">Password</Label>
              <div className="flex gap-2">
                <Input
                  id="share-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 4 characters"
                />
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </Button>
              </div>
            </div>
          )}

          <Button
            onClick={create}
            disabled={creating || (visibility === "password" && password.length < 4)}
            className="w-full"
          >
            {creating ? "Creating…" : "Create share link"}
          </Button>

          {createdUrl && (
            <div className="bg-muted/40 space-y-3 rounded-md border p-3">
              <div className="flex items-center gap-2">
                <Input value={createdUrl} readOnly className="font-mono text-xs" />
                <Button
                  size="icon"
                  variant="outline"
                  onClick={async () => {
                    await navigator.clipboard.writeText(createdUrl);
                    toast.success("Copied");
                  }}
                  aria-label="Copy"
                >
                  <Copy className="size-4" />
                </Button>
              </div>
              {qrDataUrl && (
                <div className="flex justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrDataUrl}
                    alt="QR code"
                    className="border-background border-2"
                    width={180}
                    height={180}
                  />
                </div>
              )}
            </div>
          )}

          {shares.length > 0 && (
            <div className="space-y-2">
              <p className="text-muted-foreground text-xs font-medium uppercase">
                Existing shares
              </p>
              <div className="max-h-40 space-y-1 overflow-auto">
                {shares.map((s) => (
                  <div
                    key={s.id}
                    className={cn(
                      "flex items-center gap-2 rounded border px-2 py-1.5 text-xs",
                      s.burned && "opacity-50",
                    )}
                  >
                    <span className="font-mono">/s/{s.shortId}</span>
                    <span className="text-muted-foreground">· {s.visibility}</span>
                    <span className="text-muted-foreground">· {s.viewCount} views</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="ml-auto size-6"
                      onClick={() => revoke(s.id)}
                      aria-label="Revoke"
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {loading && (
            <p className="text-muted-foreground text-center text-xs">Loading…</p>
          )}
        </div>

        <DialogFooter />
      </DialogContent>
    </Dialog>
  );
}
