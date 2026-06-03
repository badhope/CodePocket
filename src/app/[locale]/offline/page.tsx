// @ts-nocheck
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Card, CardContent } from "@/components/ui/card";
import { CloudOff } from "lucide-react";

export default async function OfflinePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("errors");
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md text-center">
        <CardContent className="flex flex-col items-center gap-4 py-10">
          <CloudOff className="text-muted-foreground size-12" />
          <h1 className="text-2xl font-bold">{t("networkError")}</h1>
          <p className="text-muted-foreground text-sm">You are currently offline. Some features may not be available.</p>
        </CardContent>
      </Card>
    </div>
  );
}
