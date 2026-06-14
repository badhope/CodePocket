import { setRequestLocale, getTranslations } from "next-intl/server";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/lib/i18n/navigation";
import {
  Braces,
  Code2,
  Database,
  FileCode,
  ArrowLeftRight,
  Hash,
  KeyRound,
  Palette,
  Sigma,
  Clock,
  Regex,
  GitCompare,
  Type,
  QrCode,
  FileJson,
  FileText,
  Lock,
  Sparkles,
  Wrench,
} from "lucide-react";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  "json-format": FileJson,
  "css-format": Code2,
  "sql-format": Database,
  "html-format": FileCode,
  "yaml-json": ArrowLeftRight,
  "toml-json": ArrowLeftRight,
  "csv-json": ArrowLeftRight,
  "md-html": FileText,
  base64: Lock,
  url: Wrench,
  hash: Hash,
  jwt: KeyRound,
  uuid: Sparkles,
  color: Palette,
  "number-base": Sigma,
  cron: Clock,
  regex: Regex,
  diff: GitCompare,
  lorem: Type,
  qrcode: QrCode,
};

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  format: Braces,
  convert: ArrowLeftRight,
  encode: Lock,
  generate: Sparkles,
  parse: Regex,
};

export default async function ToolsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("tools");
  const slugs = (await getTranslations("tools.items")) as unknown as (k: string) => string;
  void slugs;

  // Build groups from the i18n catalog.
  const itemKeys = [
    "json-format",
    "css-format",
    "sql-format",
    "html-format",
    "yaml-json",
    "toml-json",
    "csv-json",
    "md-html",
    "base64",
    "url",
    "hash",
    "jwt",
    "uuid",
    "color",
    "number-base",
    "cron",
    "regex",
    "diff",
    "lorem",
    "qrcode",
  ] as const;
  const categoryOf: Record<string, "format" | "convert" | "encode" | "generate" | "parse"> = {
    "json-format": "format",
    "css-format": "format",
    "sql-format": "format",
    "html-format": "format",
    "yaml-json": "convert",
    "toml-json": "convert",
    "csv-json": "convert",
    "md-html": "convert",
    base64: "encode",
    url: "encode",
    hash: "encode",
    jwt: "encode",
    uuid: "generate",
    color: "generate",
    "number-base": "generate",
    cron: "parse",
    regex: "parse",
    diff: "parse",
    lorem: "generate",
    qrcode: "generate",
  };

  return (
    <div className="container mx-auto max-w-7xl space-y-8 px-4 py-8 md:py-12">
      <header className="text-center">
        <Badge variant="outline" className="mb-3 gap-1.5">
          <Sparkles className="size-3" />
          100% offline
        </Badge>
        <h1 className="mb-2 text-3xl font-bold tracking-tight md:text-4xl">{t("title")}</h1>
        <p className="text-muted-foreground mx-auto max-w-2xl">{t("subtitle")}</p>
      </header>

      {(["format", "convert", "encode", "generate", "parse"] as const).map((cat) => {
        const items = itemKeys.filter((k) => categoryOf[k] === cat);
        if (items.length === 0) return null;
        const Icon = CATEGORY_ICONS[cat] ?? Wrench;
        return (
          <section key={cat} className="space-y-3">
            <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
              <Icon className="text-muted-foreground size-4" />
              {t(`categories.${cat}`)}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((slug) => {
                const ItemIcon = ICONS[slug] ?? Wrench;
                return (
                  <Link key={slug} href={`/${locale}/tools/${slug}` as never} className="block">
                    <Card className="hover:border-primary/50 h-full transition-colors">
                      <CardHeader>
                        <div className="flex items-center gap-2">
                          <span className="bg-muted text-foreground/80 inline-flex size-8 items-center justify-center rounded-md">
                            <ItemIcon className="size-4" />
                          </span>
                          <CardTitle className="text-base">{t(`items.${slug}.name`)}</CardTitle>
                        </div>
                        <CardDescription className="line-clamp-2">
                          {t(`items.${slug}.description`)}
                        </CardDescription>
                      </CardHeader>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}

      <footer className="text-muted-foreground pt-4 text-center text-xs">
        <p>All tools run locally in your browser. Source available on GitHub.</p>
      </footer>
    </div>
  );
}
