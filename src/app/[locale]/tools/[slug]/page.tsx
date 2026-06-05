import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { ToolRunner } from "@/components/tools/tool-runner";

const TOOL_IDS = [
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

type ToolId = (typeof TOOL_IDS)[number];

export function generateStaticParams() {
  return TOOL_IDS.map((slug) => ({ slug }));
}

export default async function ToolPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  if (!(TOOL_IDS as readonly string[]).includes(slug)) notFound();
  const t = await getTranslations("tools");
  const tItems = await getTranslations(`tools.items.${slug}`);
  return (
    <ToolRunner
      slug={slug as ToolId}
      title={tItems("name")}
      description={tItems("description")}
      breadcrumbLabel={t("title")}
    />
  );
}
