import Link from "next/link"
import { setRequestLocale, getTranslations } from "next-intl/server"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { conversions, documents } from "@/lib/db/schema"
import { eq, desc, count, and, gte, sql } from "drizzle-orm"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Plus, FileText, ArrowRight, Upload, CheckCircle2, XCircle, Clock, BarChart3, Activity, TrendingUp, FileStack } from "lucide-react"
import { formatBytes } from "@/lib/utils"
import { TrendChart } from "@/components/dashboard/trend-chart"
import { FormatDistribution } from "@/components/dashboard/format-distribution"

const FORMAT_LABELS: Record<string, string> = {
  docx: "DOCX", pdf: "PDF", md: "MD", html: "HTML",
  txt: "TXT", xlsx: "XLSX", csv: "CSV", json: "JSON",
  xml: "XML", pptx: "PPTX",
}

export const dynamic = "force-dynamic"

export default async function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations("nav")

  const session = await auth()
  if (!session?.user) redirect(`/${locale}/sign-in?callbackUrl=/${locale}/dashboard`)

  const now = new Date()
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)

  const sevenDaysAgo = new Date(now)
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)
  sevenDaysAgo.setHours(0, 0, 0, 0)

  const thirtyDaysAgo = new Date(now)
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29)
  thirtyDaysAgo.setHours(0, 0, 0, 0)

  const [
    totalConversionsResult,
    todayConversionsResult,
    completedResult,
    failedResult,
    totalDocsResult,
    recentConversions,
    dailyTrend,
    formatDistribution,
    storageResult,
  ] = await Promise.all([
    db.select({ count: count() }).from(conversions).where(eq(conversions.userId, session.user.id)),
    db.select({ count: count() }).from(conversions).where(
      and(eq(conversions.userId, session.user.id), gte(conversions.createdAt, today))
    ),
    db.select({ count: count() }).from(conversions).where(
      and(eq(conversions.userId, session.user.id), eq(conversions.status, "completed"))
    ),
    db.select({ count: count() }).from(conversions).where(
      and(eq(conversions.userId, session.user.id), eq(conversions.status, "failed"))
    ),
    db.select({ count: count() }).from(documents).where(eq(documents.userId, session.user.id)),
    db.query.conversions.findMany({
      where: eq(conversions.userId, session.user.id),
      orderBy: [desc(conversions.createdAt)],
      limit: 8,
      with: { document: true },
    }),
    db
      .select({
        day: sql<string>`to_char(${conversions.createdAt}, 'YYYY-MM-DD')`.as("day"),
        total: count().as("total"),
        completed: sql<number>`sum(case when ${conversions.status} = 'completed' then 1 else 0 end)`.as("completed"),
      })
      .from(conversions)
      .where(and(eq(conversions.userId, session.user.id), gte(conversions.createdAt, sevenDaysAgo)))
      .groupBy(sql`to_char(${conversions.createdAt}, 'YYYY-MM-DD')`)
      .orderBy(sql`to_char(${conversions.createdAt}, 'YYYY-MM-DD')`),
    db
      .select({
        format: conversions.outputFormat,
        count: count().as("count"),
      })
      .from(conversions)
      .where(and(eq(conversions.userId, session.user.id), gte(conversions.createdAt, thirtyDaysAgo)))
      .groupBy(conversions.outputFormat)
      .orderBy(sql`count desc`)
      .limit(8),
    db
      .select({ total: sql<number>`coalesce(sum(${documents.size}), 0)`.as("total") })
      .from(documents)
      .where(eq(documents.userId, session.user.id)),
  ])

  const totalCount = totalConversionsResult[0]?.count ?? 0
  const completedCount = completedResult[0]?.count ?? 0
  const failedCount = failedResult[0]?.count ?? 0
  const todayCount = todayConversionsResult[0]?.count ?? 0
  const successRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0
  const totalStorage = Number(storageResult[0]?.total ?? 0)

  const trendByDay = new Map<string, { day: string; total: number; completed: number }>()
  for (let i = 0; i < 7; i++) {
    const d = new Date(sevenDaysAgo)
    d.setDate(d.getDate() + i)
    const key = d.toISOString().slice(0, 10)
    trendByDay.set(key, { day: key, total: 0, completed: 0 })
  }
  for (const row of dailyTrend) {
    const existing = trendByDay.get(row.day)
    if (existing) {
      existing.total = Number(row.total)
      existing.completed = Number(row.completed)
    }
  }
  const trendData = Array.from(trendByDay.values()).map((d) => ({
    date: new Date(d.day).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    conversions: d.total,
    successful: d.completed,
  }))

  const formatDistData = formatDistribution.map((r) => ({
    name: FORMAT_LABELS[r.format] ?? r.format.toUpperCase(),
    value: Number(r.count),
  }))

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
            <Link href={`/${locale}/convert`}>
              <Upload className="mr-2 size-4" />
              {t("convert")}
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/${locale}/history`}>
              <Clock className="mr-2 size-4" />
              {t("history")}
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Conversions"
          value={totalCount.toLocaleString()}
          subtitle="All time"
          icon={<BarChart3 className="size-4 text-muted-foreground" />}
        />
        <StatCard
          title="Today"
          value={todayCount.toLocaleString()}
          subtitle="Conversions in last 24h"
          icon={<Activity className="size-4 text-muted-foreground" />}
        />
        <StatCard
          title="Success Rate"
          value={`${successRate}%`}
          subtitle={`${completedCount} completed · ${failedCount} failed`}
          icon={<CheckCircle2 className="size-4 text-muted-foreground" />}
          trend={successRate >= 80 ? "good" : successRate >= 50 ? "neutral" : "bad"}
        />
        <StatCard
          title="Documents"
          value={totalDocsResult[0]?.count?.toLocaleString() ?? "0"}
          subtitle={formatBytes(totalStorage)}
          icon={<FileStack className="size-4 text-muted-foreground" />}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Conversion Trend</CardTitle>
                <CardDescription>Last 7 days · Total vs. Successful</CardDescription>
              </div>
              <TrendingUp className="size-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            {trendData.every((d) => d.conversions === 0) ? (
              <EmptyChartState
                message="No conversions in the last 7 days"
                cta="Start Converting"
                ctaHref={`/${locale}/convert`}
              />
            ) : (
              <TrendChart data={trendData} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Output Formats</CardTitle>
            <CardDescription>Last 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            {formatDistData.length === 0 ? (
              <EmptyChartState
                message="No data yet"
                cta="Start Converting"
                ctaHref={`/${locale}/convert`}
              />
            ) : (
              <FormatDistribution data={formatDistData} />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Recent Conversions</CardTitle>
              <CardDescription>Your most recent document conversions</CardDescription>
            </div>
            {recentConversions.length > 0 && (
              <Button asChild variant="ghost" size="sm">
                <Link href={`/${locale}/history`}>
                  View all
                  <ArrowRight className="ml-1 size-3" />
                </Link>
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {recentConversions.length === 0 ? (
            <EmptyState
              icon={<FileText className="size-10 text-muted-foreground" />}
              title="No conversions yet"
              description="Get started by converting your first document."
              actionLabel="Start Converting"
              actionHref={`/${locale}/convert`}
            />
          ) : (
            <div className="space-y-2">
              {recentConversions.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText className="size-5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {c.document?.originalName ?? "Unknown file"}
                      </p>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span>{FORMAT_LABELS[c.inputFormat] ?? c.inputFormat}</span>
                        <ArrowRight className="size-3" />
                        <span>{FORMAT_LABELS[c.outputFormat] ?? c.outputFormat}</span>
                        {c.durationMs && (
                          <>
                            <span>·</span>
                            <span>{(c.durationMs / 1000).toFixed(1)}s</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {c.status === "completed" && (
                      <Badge variant="default" className="gap-1 text-xs">
                        <CheckCircle2 className="size-3" /> Done
                      </Badge>
                    )}
                    {c.status === "failed" && (
                      <Badge variant="destructive" className="gap-1 text-xs">
                        <XCircle className="size-3" /> Failed
                      </Badge>
                    )}
                    {c.status === "processing" && (
                      <Badge variant="secondary" className="gap-1 text-xs">
                        Processing
                      </Badge>
                    )}
                    {c.status === "pending" && (
                      <Badge variant="outline" className="gap-1 text-xs">
                        Pending
                      </Badge>
                    )}
                    <span className="hidden text-xs text-muted-foreground sm:inline">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function StatCard({
  title,
  value,
  subtitle,
  icon,
  trend,
}: {
  title: string
  value: string
  subtitle: string
  icon: React.ReactNode
  trend?: "good" | "neutral" | "bad"
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div
          className={`text-2xl font-bold ${
            trend === "good"
              ? "text-green-600"
              : trend === "bad"
                ? "text-red-600"
                : ""
          }`}
        >
          {value}
        </div>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </CardContent>
    </Card>
  )
}

function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  actionHref,
}: {
  icon: React.ReactNode
  title: string
  description: string
  actionLabel: string
  actionHref: string
}) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="mb-3">{icon}</div>
      <p className="text-sm font-medium">{title}</p>
      <p className="mb-4 text-xs text-muted-foreground">{description}</p>
      <Button asChild variant="outline" size="sm">
        <Link href={actionHref}>{actionLabel}</Link>
      </Button>
    </div>
  )
}

function EmptyChartState({
  message,
  cta,
  ctaHref,
}: {
  message: string
  cta: string
  ctaHref: string
}) {
  return (
    <div className="flex h-64 flex-col items-center justify-center text-center">
      <Skeleton className="mb-3 size-12 rounded-full" />
      <p className="mb-3 text-sm text-muted-foreground">{message}</p>
      <Button asChild variant="outline" size="sm">
        <Link href={ctaHref}>{cta}</Link>
      </Button>
    </div>
  )
}
