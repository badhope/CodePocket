import { setRequestLocale, getTranslations } from "next-intl/server"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { conversions, documents } from "@/lib/db/schema"
import { eq, desc, count, and, like, or } from "drizzle-orm"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { History as HistoryIcon, ArrowRight, FileText, Sparkles } from "lucide-react"
import Link from "next/link"
import { HistoryList } from "@/components/history/history-list"

interface SearchParams {
  q?: string
  status?: string
  page?: string
}

const PAGE_SIZE = 20

export const dynamic = "force-dynamic"

export default async function HistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<SearchParams>
}) {
  const { locale } = await params
  const sp = await searchParams
  setRequestLocale(locale)
  const t = await getTranslations("nav")

  const session = await auth()
  if (!session?.user) redirect(`/${locale}/sign-in?callbackUrl=/${locale}/history`)

  const query = (sp.q ?? "").trim()
  const statusFilter = sp.status ?? "all"
  const page = Math.max(1, Number(sp.page ?? 1) || 1)

  const conditions = [eq(conversions.userId, session.user.id)]
  if (query) {
    const pattern = `%${query}%`
    conditions.push(
      or(
        like(documents.originalName, pattern),
        like(conversions.outputFilename, pattern),
      )!,
    )
  }
  if (statusFilter !== "all" && ["pending", "processing", "completed", "failed"].includes(statusFilter)) {
    conditions.push(eq(conversions.status, statusFilter as "pending" | "processing" | "completed" | "failed"))
  }
  const whereClause = and(...conditions)

  const [records, totalResult] = await Promise.all([
    db
      .select({
        id: conversions.id,
        inputFormat: conversions.inputFormat,
        outputFormat: conversions.outputFormat,
        status: conversions.status,
        progress: conversions.progress,
        outputSize: conversions.outputSize,
        outputFilename: conversions.outputFilename,
        error: conversions.error,
        durationMs: conversions.durationMs,
        createdAt: conversions.createdAt,
        completedAt: conversions.completedAt,
        filename: documents.originalName,
        inputSize: documents.size,
      })
      .from(conversions)
      .leftJoin(documents, eq(conversions.documentId, documents.id))
      .where(whereClause)
      .orderBy(desc(conversions.createdAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db
      .select({ total: count() })
      .from(conversions)
      .leftJoin(documents, eq(conversions.documentId, documents.id))
      .where(whereClause),
  ])

  const total = totalResult[0]?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="container mx-auto max-w-5xl space-y-6 p-4 md:p-8">
      <div>
        <h1 className="mb-2 flex items-center gap-3 text-3xl font-bold tracking-tight md:text-4xl">
          <HistoryIcon className="size-8" />
          {t("history")}
        </h1>
        <p className="text-muted-foreground">
          {total === 0
            ? "View your document conversion history"
            : `${total.toLocaleString()} total conversion${total === 1 ? "" : "s"}`}
        </p>
      </div>

      <HistoryList
        records={records}
        total={total}
        page={page}
        totalPages={totalPages}
        pageSize={PAGE_SIZE}
        initialQuery={query}
        initialStatus={statusFilter}
      />
    </div>
  )
}
