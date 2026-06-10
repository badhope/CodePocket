"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Search,
  Download,
  FileText,
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowRight,
  Clock,
  History as HistoryIcon,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  X,
  Trash2,
} from "lucide-react";
import { formatBytes, formatRelativeTime } from "@/lib/utils";
import { toast } from "sonner";

const FORMAT_LABELS: Record<string, string> = {
  docx: "DOCX",
  pdf: "PDF",
  md: "MD",
  html: "HTML",
  txt: "TXT",
  xlsx: "XLSX",
  csv: "CSV",
  json: "JSON",
  xml: "XML",
  pptx: "PPTX",
};

interface HistoryRecord {
  id: string;
  inputFormat: string;
  outputFormat: string;
  status: string;
  progress: number | null;
  outputSize: number | null;
  outputFilename: string | null;
  error: string | null;
  durationMs: number | null;
  createdAt: Date;
  completedAt: Date | null;
  filename: string | null;
  inputSize: number | null;
}

export function HistoryList({
  records,
  total,
  page,
  totalPages,
  initialQuery,
  initialStatus,
}: {
  records: HistoryRecord[];
  total: number;
  page: number;
  totalPages: number;
  pageSize: number;
  initialQuery: string;
  initialStatus: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(initialQuery);
  const [isPending, startTransition] = useTransition();
  const [deleting, setDeleting] = useState<HistoryRecord | null>(null);
  const [deleteAll, setDeleteAll] = useState(false);

  const updateParams = (updates: Record<string, string | null | undefined>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v == null || v === "" || v === "all") params.delete(k);
      else params.set(k, v);
    }
    if (!("page" in updates)) params.delete("page");
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    updateParams({ q: query });
  };

  const handleClearSearch = () => {
    setQuery("");
    updateParams({ q: null });
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      const res = await fetch(`/api/conversions/${deleting.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      toast.success("Conversion deleted");
      setDeleting(null);
      router.refresh();
    } catch (e) {
      toast.error("Failed to delete", {
        description: e instanceof Error ? e.message : String(e),
      });
    }
  };

  const handleDeleteAll = async () => {
    try {
      const res = await fetch("/api/conversions", { method: "DELETE" });
      if (!res.ok) throw new Error("Clear failed");
      const data = (await res.json()) as { count?: number };
      toast.success("History cleared", { description: `${data.count ?? 0} items removed` });
      setDeleteAll(false);
      router.refresh();
    } catch (e) {
      toast.error("Failed to clear", {
        description: e instanceof Error ? e.message : String(e),
      });
    }
  };

  const hasFilters = useMemo(() => Boolean(query) || initialStatus !== "all", [query, initialStatus]);

  return (
    <>
      <Card>
        <CardContent className="p-4">
          <form onSubmit={handleSearch} className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input
                placeholder="Search by filename..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pr-9 pl-9"
              />
              {query && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="hover:bg-muted absolute top-1/2 right-2 -translate-y-1/2 rounded p-1"
                  aria-label="Clear search"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
            <Select value={initialStatus} onValueChange={(v) => updateParams({ status: v })}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
            <Button type="submit" disabled={isPending} className="gap-2">
              {isPending ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
              Search
            </Button>
            {hasFilters && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setQuery("");
                  updateParams({ q: null, status: null, page: null });
                }}
              >
                Clear
              </Button>
            )}
          </form>
        </CardContent>
      </Card>

      {records.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            {hasFilters ? (
              <>
                <Search className="text-muted-foreground mb-4 size-12" />
                <h3 className="mb-2 text-lg font-semibold">No results found</h3>
                <p className="text-muted-foreground mb-6 text-sm">Try adjusting your search or filters.</p>
                <Button
                  variant="outline"
                  onClick={() => {
                    setQuery("");
                    updateParams({ q: null, status: null });
                  }}
                >
                  Clear filters
                </Button>
              </>
            ) : (
              <>
                <HistoryIcon className="text-muted-foreground mb-4 size-12" />
                <h3 className="mb-2 text-lg font-semibold">No conversions yet</h3>
                <p className="text-muted-foreground mb-6 text-sm">Start by converting your first document.</p>
                <Button asChild>
                  <Link href="/convert">
                    Start Converting
                    <ArrowRight className="ml-2 size-4" />
                  </Link>
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-2">
            {records.map((record) => (
              <RecordCard key={record.id} record={record} onDelete={() => setDeleting(record)} />
            ))}
          </div>

          {total > 0 && (
            <div className="flex flex-col items-center justify-between gap-3 pt-2 sm:flex-row">
              <div className="text-muted-foreground flex items-center gap-2 text-sm">
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={isPending}
                  onClick={() => router.refresh()}
                  aria-label="Refresh"
                >
                  <RefreshCw className={`size-3.5 ${isPending ? "animate-spin" : ""}`} />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDeleteAll(true)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="mr-1.5 size-3.5" />
                  Clear all
                </Button>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1 || isPending}
                    onClick={() => updateParams({ page: String(page - 1) })}
                  >
                    <ChevronLeft className="size-3.5" />
                    Previous
                  </Button>
                  <span className="text-muted-foreground px-2 text-sm">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages || isPending}
                    onClick={() => updateParams({ page: String(page + 1) })}
                  >
                    Next
                    <ChevronRight className="size-3.5" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this conversion?</AlertDialogTitle>
            <AlertDialogDescription>
              The conversion record for &quot;{deleting?.filename ?? "Unknown file"}&quot; will be permanently
              deleted. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteAll} onOpenChange={setDeleteAll}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear all conversion history?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all {total.toLocaleString()} conversion records. This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAll}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Clear all
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function RecordCard({ record, onDelete }: { record: HistoryRecord; onDelete: () => void }) {
  const handleDownload = async () => {
    try {
      const res = await fetch(`/api/conversions/${record.id}/download`);
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = record.outputFilename ?? "converted";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 100);
    } catch (e) {
      toast.error("Download failed", {
        description: e instanceof Error ? e.message : String(e),
      });
    }
  };

  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-4 p-4">
        <div className="flex min-w-0 items-center gap-3">
          <FileText className="text-muted-foreground size-7 shrink-0" />
          <div className="min-w-0">
            <p className="truncate font-medium">{record.filename ?? "Unknown file"}</p>
            <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-1.5 text-sm">
              <Badge variant="outline" className="text-xs">
                {FORMAT_LABELS[record.inputFormat] ?? record.inputFormat}
              </Badge>
              <ArrowRight className="size-3" />
              <Badge variant="outline" className="text-xs">
                {FORMAT_LABELS[record.outputFormat] ?? record.outputFormat}
              </Badge>
              {record.inputSize != null && <span className="text-xs">{formatBytes(record.inputSize)}</span>}
              {record.durationMs != null && (
                <span className="hidden text-xs sm:inline">· {(record.durationMs / 1000).toFixed(1)}s</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <div className="flex flex-col items-end gap-0.5">
            {record.status === "completed" && (
              <Badge variant="default" className="gap-1 text-xs">
                <CheckCircle2 className="size-3" />
                Done
              </Badge>
            )}
            {record.status === "failed" && (
              <Badge variant="destructive" className="gap-1 text-xs">
                <XCircle className="size-3" />
                Failed
              </Badge>
            )}
            {(record.status === "pending" || record.status === "processing") && (
              <Badge variant="secondary" className="gap-1 text-xs">
                <Loader2 className="size-3 animate-spin" />
                {record.status}
              </Badge>
            )}
            <span className="text-muted-foreground hidden text-xs sm:block">
              <Clock className="mr-1 inline size-3" />
              {formatRelativeTime(record.createdAt)}
            </span>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleDownload}
            disabled={record.status !== "completed"}
            aria-label="Download"
          >
            <Download className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onDelete}
            aria-label="Delete"
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
