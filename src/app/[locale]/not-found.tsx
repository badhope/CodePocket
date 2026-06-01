import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileQuestion } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/navigation";

export default async function NotFound() {
  const t = await getTranslations("errors");
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <Card className="w-full max-w-md text-center">
        <CardContent className="flex flex-col items-center gap-4 py-10">
          <FileQuestion className="text-muted-foreground size-12" />
          <h1 className="text-2xl font-bold">404</h1>
          <p className="text-muted-foreground text-sm">{t("notFound")}</p>
          <p className="text-muted-foreground text-xs">{t("notFoundDescription")}</p>
          <Button asChild>
            <Link href="/">{t("goHome")}</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
