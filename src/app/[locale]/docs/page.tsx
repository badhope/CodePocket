import { getTranslations, setRequestLocale } from "next-intl/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, FileText, Upload, Download, Shield, Settings, Search, FileOutput } from "lucide-react";
import { BackendStatusOverview } from "@/components/system/backend-status-overview";

export default async function DocsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("nav");

  const sections = [
    {
      icon: Upload,
      title: "Uploading Files",
      description:
        "Learn how to upload documents via drag & drop, browse, or API. Supported formats and size limits.",
      href: "#",
    },
    {
      icon: FileOutput,
      title: "Conversion Guide",
      description:
        "Understand the conversion process, supported format pairs, quality settings, and output options.",
      href: "#",
    },
    {
      icon: Download,
      title: "Downloading Results",
      description: "How to download converted files, batch downloads, and managing your conversion history.",
      href: "#",
    },
    {
      icon: FileText,
      title: "Format Reference",
      description:
        "Detailed reference for each supported format: DOCX, PDF, Markdown, HTML, Excel, CSV, JSON, and more.",
      href: "#",
    },
    {
      icon: Shield,
      title: "Security & Privacy",
      description:
        "How we handle your files securely, encryption, automatic deletion, and data retention policies.",
      href: "#",
    },
    {
      icon: Settings,
      title: "API Reference",
      description:
        "Complete API documentation for programmatic access, authentication, rate limits, and endpoints.",
      href: "#",
    },
  ];

  return (
    <div className="container mx-auto max-w-7xl px-4 py-12">
      <div className="mx-auto max-w-3xl">
        <div className="mb-10">
          <h1 className="mb-3 text-3xl font-bold tracking-tight md:text-4xl">{t("docs")}</h1>
          <p className="text-muted-foreground text-lg">
            Everything you need to know about DocForge — from uploading your first document to advanced API
            integration.
          </p>
        </div>

        <div className="mb-8">
          <BackendStatusOverview />
        </div>

        <div className="relative mb-8">
          <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <input
            type="search"
            placeholder="Search documentation..."
            className="border-input bg-background w-full rounded-md border py-2 pr-4 pl-10 text-sm outline-none focus:ring-1 focus:ring-blue-500"
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
