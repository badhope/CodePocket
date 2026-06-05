import { getTranslations, setRequestLocale } from "next-intl/server"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { FileText, ArrowRight, Upload, Download, Shield, Zap, Globe, FileJson, FileSpreadsheet, FileType, Sparkles, Wrench } from "lucide-react"
import { BackendStatusOverview } from "@/components/system/backend-status-overview"

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations("common")
  const tn = await getTranslations("nav")

  const formats = [
    { icon: FileText, label: "DOCX", color: "text-blue-500" },
    { icon: FileType, label: "PDF", color: "text-red-500" },
    { icon: FileJson, label: "Markdown", color: "text-purple-500" },
    { icon: Globe, label: "HTML", color: "text-orange-500" },
    { icon: FileSpreadsheet, label: "XLSX/CSV", color: "text-green-500" },
    { icon: FileText, label: "TXT/JSON", color: "text-gray-500" },
  ]

  const features = [
    { icon: Zap, title: "Lightning Fast", description: "Convert documents in seconds with our optimized engine" },
    { icon: Shield, title: "Secure & Private", description: "Files are processed securely and deleted after conversion" },
    { icon: Globe, title: "Multi-format", description: "Support for DOCX, PDF, Markdown, HTML, Excel, CSV and more" },
    { icon: Upload, title: "Batch Processing", description: "Convert multiple files simultaneously" },
    { icon: Download, title: "Instant Download", description: "Download your converted files immediately" },
    { icon: Globe, title: "Cross-platform", description: "Works on Web, mobile, and WeChat Mini Program" },
  ]

  const steps = [
    { step: 1, title: "Upload", description: "Drag & drop your document or click to browse" },
    { step: 2, title: "Choose Format", description: "Select your desired output format" },
    { step: 3, title: "Convert", description: "One click to convert your document" },
    { step: 4, title: "Download", description: "Download your converted file instantly" },
  ]

  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative overflow-hidden border-b bg-gradient-to-b from-background to-muted/30">
        <div className="container mx-auto max-w-7xl px-4 py-20 md:py-32">
          <div className="mx-auto max-w-3xl text-center">
            <Badge variant="outline" className="mb-6 gap-1.5">
              <Sparkles className="size-3" />
              v3.0 · Universal Document Converter
            </Badge>
            <h1 className="mb-6 text-4xl font-bold tracking-tight md:text-6xl">
              {t("appName")}
            </h1>
            <p className="mb-8 text-lg text-muted-foreground md:text-xl">{t("tagline")}</p>
            <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button size="lg" asChild>
                <Link href="/convert">
                  <Upload className="mr-2 size-4" />
                  {tn("convert")}
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/sign-up">{t("signUp")}</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Backend status overview */}
      <section className="border-b bg-muted/20 py-12">
        <div className="container mx-auto max-w-7xl px-4">
          <div className="mx-auto max-w-3xl">
            <BackendStatusOverview />
          </div>
        </div>
      </section>

      {/* Formats */}
      <section className="border-b py-16">
        <div className="container mx-auto max-w-7xl px-4">
          <h2 className="mb-8 text-center text-2xl font-bold md:text-3xl">Supported Formats</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
            {formats.map((fmt) => (
              <Card key={fmt.label} className="transition-colors hover:border-primary/50">
                <CardContent className="flex flex-col items-center justify-center p-6 text-center">
                  <fmt.icon className={`mb-3 size-8 ${fmt.color}`} />
                  <div className="font-semibold">{fmt.label}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Quick links */}
      <section className="border-b py-12">
        <div className="container mx-auto max-w-7xl px-4">
          <div className="grid gap-3 md:grid-cols-2">
            <Link href="/tools" className="block">
              <Card className="hover:border-primary/50 h-full transition-colors">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <span className="bg-muted text-foreground/80 inline-flex size-8 items-center justify-center rounded-md">
                      <Wrench className="size-4" />
                    </span>
                    <div>
                      <CardTitle className="text-base">Online Tools</CardTitle>
                      <CardDescription>20+ tools that work 100% in your browser — JSON formatter, Base64, JWT decoder, QR, etc.</CardDescription>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            </Link>
            <Link href="/playground" className="block">
              <Card className="hover:border-primary/50 h-full transition-colors">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <span className="bg-muted text-foreground/80 inline-flex size-8 items-center justify-center rounded-md">
                      <FileType className="size-4" />
                    </span>
                    <div>
                      <CardTitle className="text-base">Code Playground</CardTitle>
                      <CardDescription>Run JS / TS / Python / SQL / Lua / Bash right in the browser. No backend required.</CardDescription>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16">
        <div className="container mx-auto max-w-7xl px-4">
          <h2 className="mb-12 text-center text-2xl font-bold md:text-3xl">Why DocForge?</h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <Card key={f.title}>
                <CardHeader>
                  <f.icon className="mb-2 size-8 text-primary" />
                  <CardTitle>{f.title}</CardTitle>
                  <CardDescription>{f.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t bg-muted/30 py-16">
        <div className="container mx-auto max-w-7xl px-4">
          <h2 className="mb-12 text-center text-2xl font-bold md:text-3xl">How It Works</h2>
          <div className="grid gap-8 md:grid-cols-4">
            {steps.map((s) => (
              <div key={s.step} className="text-center">
                <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground">
                  {s.step}
                </div>
                <h3 className="mb-2 font-semibold">{s.title}</h3>
                <p className="text-sm text-muted-foreground">{s.description}</p>
                {s.step < 4 && (
                  <ArrowRight className="mx-auto mt-3 size-5 text-muted-foreground/50 hidden md:block" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t py-16">
        <div className="container mx-auto max-w-3xl px-4 text-center">
          <h2 className="mb-4 text-2xl font-bold md:text-3xl">Ready to convert your documents?</h2>
          <p className="mb-6 text-muted-foreground">
            Free, fast, and secure. No registration required for basic use.
          </p>
          <Button size="lg" asChild>
            <Link href="/convert">Start Converting Now →</Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container mx-auto max-w-7xl px-4">
          <div className="flex flex-col items-center justify-between gap-4 text-sm text-muted-foreground md:flex-row">
            <div>© {new Date().getFullYear()} {t("appName")}. MIT License.</div>
            <div className="flex gap-6">
              <Link href="/docs" className="hover:text-foreground">Docs</Link>
              <span className="hover:text-foreground cursor-pointer">Privacy</span>
              <span className="hover:text-foreground cursor-pointer">Terms</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}