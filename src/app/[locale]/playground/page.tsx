// @ts-nocheck
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Playground } from "@/components/editor/playground";

export default async function PlaygroundPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("playground");
  return (
    <div>
      <title>{t("title")}</title>
      <Playground />
    </div>
  );
}
