"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LANGUAGE_LIST } from "@/lib/execution";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

const CodeEditor = dynamic(
  () => import("@/components/editor/code-editor").then((m) => m.CodeEditor),
  {
    ssr: false,
    loading: () => <Skeleton className="h-64 w-full" />,
  },
);

export default function NewSnippetPage() {
  const locale = useLocale();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [language, setLanguage] = useState("python");
  const [code, setCode] = useState("");
  const [tags, setTags] = useState("");
  const [visibility, setVisibility] = useState<"public" | "unlisted" | "private">("private");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) {
      toast.error("Code is required");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/snippets", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: title || "Untitled",
          description,
          language,
          code,
          tags: tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
          visibility,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Failed");
        return;
      }
      router.push(`/${locale}/snippets`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="container mx-auto max-w-4xl space-y-6 p-4 md:p-8">
      <Button variant="ghost" size="sm" asChild>
        <Link href={`/${locale}/snippets`}>
          <ArrowLeft className="mr-2 size-4" /> Back
        </Link>
      </Button>
      <Card>
        <CardHeader>
          <CardTitle>New snippet</CardTitle>
          <CardDescription>Save reusable code</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Quick sort"
                maxLength={200}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                maxLength={2000}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Language</Label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGE_LIST.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.icon} {l.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Visibility</Label>
                <Select value={visibility} onValueChange={(v) => setVisibility(v as never)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="private">🔒 Private</SelectItem>
                    <SelectItem value="unlisted">🔗 Unlisted</SelectItem>
                    <SelectItem value="public">🌍 Public</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tags">Tags (comma separated)</Label>
              <Input
                id="tags"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="sort, algorithm, python"
              />
            </div>
            <div className="space-y-2">
              <Label>Code</Label>
              <div className="overflow-hidden rounded-md border">
                <CodeEditor
                  value={code}
                  onChange={setCode}
                  language={language}
                  height="320px"
                  fontSize={14}
                  wordWrap="on"
                />
              </div>
            </div>
            <Button type="submit" disabled={submitting || !code.trim()} className="w-full">
              {submitting ? "Saving..." : "Save snippet"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
