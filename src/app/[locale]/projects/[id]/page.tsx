import { setRequestLocale, getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ProjectEditor } from "@/components/project/project-editor";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("nav");
  const session = await auth();
  if (!session?.user) redirect(`/${locale}/sign-in?callbackUrl=/${locale}/projects/${id}`);

  return (
    <div>
      <title>{t("projects")}</title>
      <ProjectEditor id={id} />
    </div>
  );
}
