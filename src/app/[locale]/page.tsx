import { getTranslations, setRequestLocale } from "next-intl/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Code2, Zap, Globe, Shield, Cpu, Layers, Box, Sparkles } from "lucide-react";
import { LANGUAGE_LIST } from "@/lib/execution";

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("common");
  const tn = await getTranslations("nav");

  const features = [
    { icon: Zap, title: "Lightning Fast", description: "Sub-second code execution via Piston API" },
    { icon: Globe, title: "20+ Languages", description: "Python, JS, TS, C++, Rust, Go, Java and more" },
    { icon: Cpu, title: "Cloud Sandboxes", description: "Isolated execution environments" },
    { icon: Layers, title: "Real-time Output", description: "Stream stdout/stderr via SSE" },
    { icon: Shield, title: "Secure by Default", description: "Resource limits and network isolation" },
    { icon: Box, title: "File System", description: "Multi-file projects with version history" },
  ];

  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="from-background to-muted/30 relative overflow-hidden border-b bg-gradient-to-b">
        <div className="container mx-auto max-w-7xl px-4 py-20 md:py-32">
          <div className="mx-auto max-w-3xl text-center">
            <Badge variant="outline" className="mb-6 gap-1.5">
              <Sparkles className="size-3" />
              2026 Edition · v2.0
            </Badge>
            <h1 className="mb-6 text-4xl font-bold tracking-tight md:text-6xl">
              {t("appName")}
            </h1>
            <p className="text-muted-foreground mb-8 text-lg md:text-xl">{t("tagline")}</p>
            <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button size="lg" asChild>
                <Link href="/playground">
                  <Code2 className="mr-2 size-4" />
                  {tn("playground")}
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/sign-up">{t("signUp")}</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Languages */}
      <section className="border-b py-16">
        <div className="container mx-auto max-w-7xl px-4">
          <h2 className="mb-8 text-center text-2xl font-bold md:text-3xl">Supported Languages</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {LANGUAGE_LIST.map((lang) => (
              <Card
                key={lang.id}
                className="hover:border-primary/50 transition-colors"
              >
                <CardContent className="flex flex-col items-center justify-center p-4 text-center">
                  <div className="mb-2 text-3xl">{lang.icon}</div>
                  <div className="text-sm font-medium">{lang.label}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16">
        <div className="container mx-auto max-w-7xl px-4">
          <h2 className="mb-12 text-center text-2xl font-bold md:text-3xl">Features</h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <Card key={f.title}>
                <CardHeader>
                  <f.icon className="text-primary mb-2 size-8" />
                  <CardTitle>{f.title}</CardTitle>
                  <CardDescription>{f.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-muted/30 border-t py-16">
        <div className="container mx-auto max-w-3xl px-4 text-center">
          <h2 className="mb-4 text-2xl font-bold md:text-3xl">Ready to start coding?</h2>
          <p className="text-muted-foreground mb-6">
            No installation. No setup. Just open the browser and code.
          </p>
          <Button size="lg" asChild>
            <Link href="/playground">Start now →</Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container mx-auto max-w-7xl px-4">
          <div className="text-muted-foreground flex flex-col items-center justify-between gap-4 text-sm md:flex-row">
            <div>© {new Date().getFullYear()} {t("appName")}. MIT License.</div>
            <div className="flex gap-6">
              <Link href="/docs" className="hover:text-foreground">
                Docs
              </Link>
              <Link href="/privacy" className="hover:text-foreground">
                Privacy
              </Link>
              <Link href="/terms" className="hover:text-foreground">
                Terms
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
