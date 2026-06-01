import { getTranslations, setRequestLocale } from "next-intl/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Code2, Terminal, FileCode2, Package, Share2, Settings, Search } from "lucide-react";

export default async function DocsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("nav");

  const sections = [
    {
      icon: Code2,
      title: "Quick Start",
      description: "Get up and running in minutes. Learn how to create projects, write code, and execute it.",
      href: "#",
    },
    {
      icon: FileCode2,
      title: "Editor & Playground",
      description: "Explore the playground, multi-file editor, Monaco editor features, and keyboard shortcuts.",
      href: "#",
    },
    {
      icon: Terminal,
      title: "Code Execution",
      description: "Understand supported languages, runtimes, resource limits, and streaming output via SSE.",
      href: "#",
    },
    {
      icon: Package,
      title: "Package Management",
      description: "Install dependencies for Python, JavaScript, Rust, Go, and more directly in your projects.",
      href: "#",
    },
    {
      icon: Share2,
      title: "Sharing & Collaboration",
      description: "Share code snippets with password protection, burn-after-read, and QR codes.",
      href: "#",
    },
    {
      icon: Settings,
      title: "Configuration",
      description: "Environment variables, project settings, editor preferences, and theme customization.",
      href: "#",
    },
  ];

  return (
    <div className="container mx-auto max-w-7xl px-4 py-12">
      <div className="mx-auto max-w-3xl">
        <div className="mb-10">
          <h1 className="mb-3 text-3xl font-bold tracking-tight md:text-4xl">{t("docs")}</h1>
          <p className="text-muted-foreground text-lg">
            Everything you need to know about OnlineCode — from your first &ldquo;Hello World&rdquo; to advanced project workflows.
          </p>
        </div>

        <div className="relative mb-8">
          <Search className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" />
          <input
            type="search"
            placeholder="Search documentation..."
            className="border-input bg-background w-full rounded-md border py-2 pl-10 pr-4 text-sm outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {sections.map((s) => (
            <Card key={s.title} className="hover:border-primary/50 transition-colors">
              <CardHeader>
                <div className="mb-2">
                  <Badge variant="secondary" className="gap-1.5">
                    <s.icon className="size-3" />
                    <BookOpen className="size-3" />
                  </Badge>
                </div>
                <CardTitle className="text-lg">{s.title}</CardTitle>
                <CardDescription>{s.description}</CardDescription>
              </CardHeader>
              <CardContent />
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
