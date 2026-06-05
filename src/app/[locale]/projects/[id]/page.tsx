import { setRequestLocale, getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ProjectEditor } from "@/components/project/project-editor";
import { BackendGate } from "@/components/system/backend-gate";

// Project routes require auth + a server-side data layer that is not
// available in a static export. A single placeholder pre-render is
// enough to satisfy the build; the client will hydrate with real data
// only for the actual project ids.
export function generateStaticParams() {
  return [{ id: "_" }];
}

export default async function ProjectPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("nav");
  const session = await auth();
  if (!session?.user) redirect(`/${locale}/sign-in?callbackUrl=/${locale}/projects/${id}`);

  return (
    <BackendGate feature="projects.persist">
      <div>
        <title>{t("projects")}</title>
        <ProjectEditor id={id} />
      </div>
    </BackendGate>
  );
}
