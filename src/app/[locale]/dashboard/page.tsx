import Link from "next/link";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { projects, snippets, executions } from "@/lib/db/schema";
import { eq, desc, count } from "drizzle-orm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Code2, FileCode, Zap } from "lucide-react";

export default async function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("nav");

  const session = await auth();
  if (!session?.user) redirect(`/${locale}/sign-in?callbackUrl=/${locale}/dashboard`);

  const [projectCount, snippetCount, execCount, recentProjects, recentExecutions] = await Promise.all([
    db.select({ count: count() }).from(projects).where(eq(projects.ownerId, session.user.id)),
    db.select({ count: count() }).from(snippets).where(eq(snippets.authorId, session.user.id)),
    db.select({ count: count() }).from(executions).where(eq(executions.userId, session.user.id)),
    db.query.projects.findMany({
      where: eq(projects.ownerId, session.user.id),
      orderBy: [desc(projects.updatedAt)],
      limit: 5,
    }),
    db.query.executions.findMany({
      where: eq(executions.userId, session.user.id),
      orderBy: [desc(executions.createdAt)],
      limit: 5,
    }),
  ]);

  return (
    <div className="container mx-auto max-w-7xl space-y-8 p-4 md:p-8">
      <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("dashboard")}</h1>
          <p className="text-muted-foreground">
            Welcome back, {session.user.name ?? session.user.email}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link href={`/${locale}/projects`}>
              <Plus className="mr-2 size-4" /> New project
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/${locale}/playground`}>
              <Code2 className="mr-2 size-4" /> {t("playground")}
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Projects</CardTitle>
            <FileCode className="text-muted-foreground size-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{projectCount[0]?.count ?? 0}</div>
            <p className="text-muted-foreground text-xs">All time</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Snippets</CardTitle>
            <Code2 className="text-muted-foreground size-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{snippetCount[0]?.count ?? 0}</div>
            <p className="text-muted-foreground text-xs">Saved code</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Executions</CardTitle>
            <Zap className="text-muted-foreground size-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{execCount[0]?.count ?? 0}</div>
            <p className="text-muted-foreground text-xs">Code runs</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent projects</CardTitle>
            <CardDescription>Your most recently updated</CardDescription>
          </CardHeader>
          <CardContent>
            {recentProjects.length === 0 ? (
              <p className="text-muted-foreground text-sm">No projects yet</p>
            ) : (
              <ul className="space-y-2">
                {recentProjects.map((p) => (
                  <li key={p.id} className="flex items-center justify-between">
                    <Link href={`/${locale}/projects/${p.id}`} className="hover:underline">
                      <div className="flex items-center gap-2">
                        <FileCode className="size-4" />
                        <span className="font-medium">{p.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {p.language}
                        </Badge>
                      </div>
                    </Link>
                    <span className="text-muted-foreground text-xs">
                      {new Date(p.updatedAt).toLocaleDateString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recent runs</CardTitle>
            <CardDescription>Your last code executions</CardDescription>
          </CardHeader>
          <CardContent>
            {recentExecutions.length === 0 ? (
              <p className="text-muted-foreground text-sm">No executions yet</p>
            ) : (
              <ul className="space-y-2">
                {recentExecutions.map((e) => (
                  <li key={e.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={e.status === "completed" ? "default" : "destructive"}
                        className="font-mono text-xs"
                      >
                        {e.exitCode ?? "—"}
                      </Badge>
                      <span className="text-sm">{e.language}</span>
                    </div>
                    <span className="text-muted-foreground text-xs">
                      {e.wallTimeMs ? `${e.wallTimeMs}ms` : "—"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
