"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useEditorStore } from "@/stores/editor";
import { toast } from "sonner";
import { User, Lock, Palette, Code2, Settings as SettingsIcon } from "lucide-react";
import { useFeatureGate } from "@/lib/system/feature-gate";
import { LockedOverlay } from "@/components/system/locked-overlay";

interface UserData {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  role: string;
  locale: string | null;
  theme: string | null;
  twoFactorEnabled: boolean | null;
  createdAt: string;
}

export default function SettingsPage() {
  const locale = useLocale();
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const {
    fontSize,
    setFontSize,
    wordWrap,
    setWordWrap,
    minimap,
    setMinimap,
    autoSave,
    setAutoSave,
    theme,
    setTheme,
  } = useEditorStore();
  const gate = useFeatureGate("auth.sign-in");

  useEffect(() => {
    if (!gate.enabled) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setUser(d.user);
        setName(d.user?.name ?? "");
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [gate.enabled]);

  if (!gate.enabled) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-8 md:py-12">
        <LockedOverlay feature="auth.sign-in" />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container mx-auto max-w-4xl space-y-4 p-4 md:p-8">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container mx-auto max-w-2xl p-8">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Please sign in to view settings</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  async function saveProfile() {
    setSaving(true);
    try {
      const res = await fetch("/api/me", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        toast.success("Saved");
      } else {
        toast.error("Failed");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="container mx-auto max-w-4xl space-y-6 p-4 md:p-8">
      <div className="flex items-center gap-2">
        <SettingsIcon className="size-6" />
        <h1 className="text-3xl font-bold">Settings</h1>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <User className="size-5" />
            <CardTitle>Profile</CardTitle>
          </div>
          <CardDescription>Your account information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            {user.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.image} alt="" className="size-16 rounded-full" referrerPolicy="no-referrer" />
            ) : (
              <div className="bg-muted flex size-16 items-center justify-center rounded-full text-2xl font-bold">
                {user.name?.[0] ?? user.email[0]?.toUpperCase()}
              </div>
            )}
            <div className="flex-1 space-y-1">
              <p className="font-medium">{user.name ?? "—"}</p>
              <p className="text-muted-foreground text-sm">{user.email}</p>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{user.role}</Badge>
                <span className="text-muted-foreground text-xs">
                  Joined {new Date(user.createdAt).toLocaleDateString(locale)}
                </span>
              </div>
            </div>
          </div>
          <Separator />
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Display name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={user.email} disabled />
            </div>
          </div>
          <Button onClick={saveProfile} disabled={saving}>
            {saving ? "Saving..." : "Save profile"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Lock className="size-5" />
            <CardTitle>Security</CardTitle>
          </div>
          <CardDescription>Account security</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Two-factor authentication</p>
              <p className="text-muted-foreground text-sm">Add an extra layer of security</p>
            </div>
            <Badge variant={user.twoFactorEnabled ? "default" : "outline"}>
              {user.twoFactorEnabled ? "Enabled" : "Disabled"}
            </Badge>
          </div>
          <Separator />
          <div className="text-muted-foreground text-sm">
            密码修改需在后端账户服务中实现（不在当前前端范围内）。
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Palette className="size-5" />
            <CardTitle>Appearance</CardTitle>
          </div>
          <CardDescription>Customize the look and feel</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Theme</Label>
            <div className="flex gap-2">
              {(["light", "dark", "system"] as const).map((t) => (
                <Button
                  key={t}
                  variant={theme === t ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTheme(t)}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Code2 className="size-5" />
            <CardTitle>Editor</CardTitle>
          </div>
          <CardDescription>Code editor preferences</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Font size: {fontSize}px</Label>
            <input
              type="range"
              min={10}
              max={24}
              value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
              className="w-full"
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Word wrap</p>
              <p className="text-muted-foreground text-sm">Wrap long lines</p>
            </div>
            <Button
              variant={wordWrap ? "default" : "outline"}
              size="sm"
              onClick={() => setWordWrap(!wordWrap)}
            >
              {wordWrap ? "On" : "Off"}
            </Button>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Minimap</p>
              <p className="text-muted-foreground text-sm">Show code overview</p>
            </div>
            <Button variant={minimap ? "default" : "outline"} size="sm" onClick={() => setMinimap(!minimap)}>
              {minimap ? "On" : "Off"}
            </Button>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Auto-save</p>
              <p className="text-muted-foreground text-sm">Save files automatically</p>
            </div>
            <Button
              variant={autoSave ? "default" : "outline"}
              size="sm"
              onClick={() => setAutoSave(!autoSave)}
            >
              {autoSave ? "On" : "Off"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
