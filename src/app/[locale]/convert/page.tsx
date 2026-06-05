"use client"

import { useState, useCallback, useRef, useEffect, useMemo } from "react"
import { useTranslations, useLocale } from "next-intl"
import { Link } from "@/lib/i18n/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { LockedOverlay } from "@/components/system/locked-overlay"
import { useBackendStatus } from "@/lib/system/backend-status"
import { formatBytes } from "@/lib/utils"
import { toast } from "sonner"
import {
  jsonToCsv,
  csvToJson,
  jsonToYaml,
  yamlToJson,
  jsonToToml,
  tomlToJson,
  markdownToHtml,
  htmlToMarkdown,
  encodeBase64,
  decodeBase64,
  encodeUrl,
  decodeUrl,
} from "@/lib/tools/client-tools"
import {
  Upload,
  X,
  FileText,
  ArrowRight,
  Download,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FileWarning,
  Clock,
  Sparkles,
  RefreshCw,
  Copy,
  ExternalLink,
  FileSpreadsheet,
  ScanText,
  Database,
  ArrowLeftRight,
  Wand2,
  CloudOff,
  Zap,
} from "lucide-react"

const MAX_FILE_SIZE = 50 * 1024 * 1024
const MAX_CONVERT_DURATION_MS = 60_000
const ACCEPT_ATTR =
  ".docx,.doc,.pdf,.md,.markdown,.html,.htm,.txt,.text,.xlsx,.xls,.csv,.json,.xml,.pptx,.ppt"

const FORMAT_LABELS: Record<string, string> = {
  docx: "Word (DOCX)",
  pdf: "PDF",
  md: "Markdown",
  html: "HTML",
  txt: "Plain Text",
  xlsx: "Excel (XLSX)",
  csv: "CSV",
  json: "JSON",
  xml: "XML",
  pptx: "PowerPoint (PPTX)",
}

const FORMAT_ICONS: Record<string, string> = {
  docx: "📄",
  pdf: "📑",
  md: "📝",
  html: "🌐",
  txt: "📋",
  xlsx: "📊",
  csv: "📈",
  json: "🔧",
  xml: "📰",
  pptx: "🎞️",
}

const INPUT_EXTENSIONS: Record<string, string[]> = {
  docx: [".docx", ".doc"],
  pdf: [".pdf"],
  md: [".md", ".markdown"],
  html: [".html", ".htm"],
  txt: [".txt", ".text"],
  xlsx: [".xlsx", ".xls"],
  csv: [".csv"],
  json: [".json"],
  xml: [".xml"],
  pptx: [".pptx", ".ppt"],
}

const EXT_MAP: Record<string, string> = {
  docx: "docx",
  doc: "docx",
  pdf: "pdf",
  md: "md",
  markdown: "md",
  html: "html",
  htm: "html",
  txt: "txt",
  text: "txt",
  xlsx: "xlsx",
  xls: "xlsx",
  csv: "csv",
  json: "json",
  xml: "xml",
  pptx: "pptx",
  ppt: "pptx",
}

type Stage = "upload" | "selecting" | "converting" | "done" | "error"

interface ConvertState {
  stage: Stage
  file: File | null
  inputFormat: string | null
  outputFormat: string | null
  availableOutputs: string[]
  progress: number
  progressLabel: string
  errorMessage: string | null
  errorCode: string | null
  resultBlob: Blob | null
  resultFilename: string | null
  startedAt: number | null
  durationMs: number | null
}

const INITIAL_STATE: ConvertState = {
  stage: "upload",
  file: null,
  inputFormat: null,
  outputFormat: null,
  availableOutputs: [],
  progress: 0,
  progressLabel: "Initializing...",
  errorMessage: null,
  errorCode: null,
  resultBlob: null,
  resultFilename: null,
  startedAt: null,
  durationMs: null,
}

// ─── Client-side conversion catalog ──────────────────────────────────
// Each entry is a (input → output) transformation that runs entirely in
// the browser using @/lib/tools/client-tools. The shape is intentionally
// flat (not a graph) so the user picks a single operation at a time and
// the output area updates instantly.

type ClientConv = {
  id: string
  from: string
  to: string
  run: (input: string) => { ok: true; output: string } | { ok: false; error: string }
  toolSlug: string
  inputLabel: string
  outputLabel: string
}

const CLIENT_CONVERSIONS: ClientConv[] = [
  { id: "json-yaml", from: "json", to: "yaml", run: jsonToYaml, toolSlug: "yaml-json", inputLabel: "JSON", outputLabel: "YAML" },
  { id: "json-toml", from: "json", to: "toml", run: jsonToToml, toolSlug: "toml-json", inputLabel: "JSON", outputLabel: "TOML" },
  { id: "json-csv", from: "json", to: "csv", run: jsonToCsv, toolSlug: "csv-json", inputLabel: "JSON", outputLabel: "CSV" },
  { id: "yaml-json", from: "yaml", to: "json", run: yamlToJson, toolSlug: "yaml-json", inputLabel: "YAML", outputLabel: "JSON" },
  { id: "toml-json", from: "toml", to: "json", run: tomlToJson, toolSlug: "toml-json", inputLabel: "TOML", outputLabel: "JSON" },
  { id: "csv-json", from: "csv", to: "json", run: csvToJson, toolSlug: "csv-json", inputLabel: "CSV", outputLabel: "JSON" },
  { id: "md-html", from: "md", to: "html", run: (i) => ({ ok: true as const, output: markdownToHtml(i) }), toolSlug: "md-html", inputLabel: "Markdown", outputLabel: "HTML" },
  { id: "html-md", from: "html", to: "md", run: (i) => ({ ok: true as const, output: htmlToMarkdown(i) }), toolSlug: "md-html", inputLabel: "HTML", outputLabel: "Markdown" },
  { id: "text-base64", from: "text", to: "base64", run: (i) => ({ ok: true as const, output: encodeBase64(i) }), toolSlug: "base64", inputLabel: "Text", outputLabel: "Base64" },
  { id: "base64-text", from: "base64", to: "text", run: decodeBase64, toolSlug: "base64", inputLabel: "Base64", outputLabel: "Text" },
  { id: "text-url", from: "text", to: "url", run: (i) => ({ ok: true as const, output: encodeUrl(i) }), toolSlug: "url", inputLabel: "Text", outputLabel: "URL-encoded" },
  { id: "url-text", from: "url", to: "text", run: decodeUrl, toolSlug: "url", inputLabel: "URL-encoded", outputLabel: "Text" },
]

const CLIENT_INPUT_PLACEHOLDERS: Record<string, string> = {
  json: '[{"name":"Ada","age":36},{"name":"Bo","age":24}]',
  yaml: "name: Ada\nage: 36\n",
  toml: 'name = "Ada"\nage = 36\n',
  csv: "name,age\nAda,36\nBo,24\n",
  md: "# Hello\n\nThis is **markdown**.\n",
  html: "<h1>Hello</h1>\n<p>This is <strong>HTML</strong>.</p>\n",
  text: "Hello world!",
  base64: "SGVsbG8gd29ybGQh",
  url: "Hello%20world%21",
}

type TabId = "document" | "spreadsheet" | "text" | "ocr"

export default function ConvertPage() {
  const t = useTranslations("nav")
  const tc = useTranslations("convert")
  const locale = useLocale()
  const { backendAvailable } = useBackendStatus()
  const [tab, setTab] = useState<TabId>("text")
  const [state, setState] = useState<ConvertState>(INITIAL_STATE)
  const [formats, setFormats] = useState<{
    conversionMap: Record<string, string[]>
    inputFormats: string[]
  } | null>(null)
  const [recentFormats, setRecentFormats] = useState<string[]>([])
  const [retryCount, setRetryCount] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Client-side tool state
  const [clientConvId, setClientConvId] = useState<string>(
    CLIENT_CONVERSIONS[0]?.id ?? "json-yaml",
  )
  const [clientInput, setClientInput] = useState<string>("")

  const clientConv = useMemo(
    () => CLIENT_CONVERSIONS.find((c) => c.id === clientConvId) ?? CLIENT_CONVERSIONS[0]!,
    [clientConvId],
  )

  // Derive the client output synchronously from input + selection. Doing
  // it via useMemo instead of useEffect avoids a cascading render.
  const clientResult = useMemo<
    { ok: true; output: string } | { ok: false; error: string }
  >(() => {
    if (!clientInput) return { ok: true, output: "" }
    return clientConv.run(clientInput)
  }, [clientInput, clientConv])

  const clientOutput = clientResult.ok ? clientResult.output : ""
  const clientError = clientResult.ok ? null : clientResult.error

  useEffect(() => {
    let cancelled = false
    fetch("/api/convert/formats")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setFormats(data)
      })
      .catch((err) => {
        console.error("Failed to load formats:", err)
        if (!cancelled) {
          // Non-fatal: server-required tabs show their own locked state
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    try {
      const stored = localStorage.getItem("docforge:recent-formats")
      if (stored) {
        // Reading localStorage on mount and hydrating state is the canonical
        // SSR-safe pattern; React's "cascading render" warning does not apply
        // because the effect has an empty dep array.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setRecentFormats(JSON.parse(stored))
      }
    } catch {
      // localStorage unavailable
    }
  }, [])

  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort()
      if (progressTimerRef.current) clearInterval(progressTimerRef.current)
    }
  }, [])

  // Reset both client and server state when the user switches tabs so a
  // half-finished conversion never leaks across categories.
  const handleTabChange = useCallback((next: string) => {
    if (abortRef.current) abortRef.current.abort()
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current)
      progressTimerRef.current = null
    }
    setState(INITIAL_STATE)
    setRetryCount(0)
    setClientInput("")
    setTab(next as TabId)
  }, [])

  const detectInputFormat = useCallback((filename: string): string | null => {
    const ext = filename.split(".").pop()?.toLowerCase()
    if (!ext) return null
    return EXT_MAP[ext] ?? null
  }, [])

  const rememberFormat = useCallback((format: string) => {
    setRecentFormats((prev) => {
      const next = [format, ...prev.filter((f) => f !== format)].slice(0, 3)
      try {
        localStorage.setItem("docforge:recent-formats", JSON.stringify(next))
      } catch {
        // localStorage unavailable
      }
      return next
    })
  }, [])

  const handleFile = useCallback(
    (file: File) => {
      if (file.size === 0) {
        setState((prev) => ({
          ...prev,
          stage: "error",
          errorMessage: "File is empty. Please select a non-empty file.",
          errorCode: "EMPTY_FILE",
          file: null,
          inputFormat: null,
        }))
        return
      }

      if (file.size > MAX_FILE_SIZE) {
        setState((prev) => ({
          ...prev,
          stage: "error",
          errorMessage: `File is too large (${formatBytes(file.size)}). Maximum size is ${formatBytes(MAX_FILE_SIZE)}.`,
          errorCode: "FILE_TOO_LARGE",
          file: null,
          inputFormat: null,
        }))
        return
      }

      const format = detectInputFormat(file.name)
      if (!format) {
        setState((prev) => ({
          ...prev,
          stage: "error",
          errorMessage: `Unsupported file format ".${file.name.split(".").pop()}". Supported formats: ${formats?.inputFormats.join(", ") ?? "DOCX, PDF, MD, HTML, XLSX, CSV, JSON, XML, PPTX"}.`,
          errorCode: "UNSUPPORTED_FORMAT",
          file: null,
          inputFormat: null,
        }))
        return
      }

      const available = formats?.conversionMap[format] ?? []
      if (available.length === 0) {
        setState((prev) => ({
          ...prev,
          stage: "error",
          errorMessage: `No conversion targets available for ${FORMAT_LABELS[format]}.`,
          errorCode: "NO_TARGETS",
          file: null,
          inputFormat: null,
        }))
        return
      }

      setState({
        ...INITIAL_STATE,
        stage: "selecting",
        file,
        inputFormat: format,
        availableOutputs: available,
      })

      rememberFormat(format)
    },
    [detectInputFormat, formats, rememberFormat],
  )

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files
      if (files && files[0]) {
        handleFile(files[0])
        if (fileInputRef.current) fileInputRef.current.value = ""
      }
    },
    [handleFile],
  )

  const startProgressSimulation = useCallback(() => {
    if (progressTimerRef.current) clearInterval(progressTimerRef.current)
    progressTimerRef.current = setInterval(() => {
      setState((prev) => {
        if (prev.stage !== "converting") return prev
        const elapsed = Date.now() - (prev.startedAt ?? Date.now())
        const stages = [
          { until: 2000, max: 30, label: "Uploading..." },
          { until: 4000, max: 70, label: "Processing document..." },
          { until: 8000, max: 90, label: "Converting formats..." },
        ]
        const stage = stages.find((s) => elapsed < s.until) ?? stages[stages.length - 1]!
        const increment = Math.random() * 4 + 1
        const next = Math.min(prev.progress + increment, stage.max)
        return { ...prev, progress: next, progressLabel: stage.label }
      })
    }, 200)
  }, [])

  const handleConvert = useCallback(async () => {
    if (!state.file || !state.outputFormat) return

    setState((prev) => ({
      ...prev,
      stage: "converting",
      progress: 5,
      progressLabel: "Uploading...",
      errorMessage: null,
      errorCode: null,
      startedAt: Date.now(),
      durationMs: null,
    }))

    const formData = new FormData()
    formData.append("file", state.file)
    formData.append("outputFormat", state.outputFormat)

    const controller = new AbortController()
    abortRef.current = controller

    const timeoutId = setTimeout(() => {
      controller.abort("timeout")
    }, MAX_CONVERT_DURATION_MS)

    startProgressSimulation()

    try {
      const res = await fetch("/api/convert", {
        method: "POST",
        body: formData,
        signal: controller.signal,
      })

      clearTimeout(timeoutId)
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current)
        progressTimerRef.current = null
      }

      if (!res.ok) {
        const errData = (await res.json().catch(() => ({}))) as {
          error?: { message?: string; code?: string } | string
          message?: string
        }
        let msg = "Conversion failed"
        let code = "UNKNOWN_ERROR"
        if (typeof errData.error === "string") {
          msg = errData.error
        } else if (errData.error && typeof errData.error === "object") {
          msg = errData.error.message ?? msg
          code = errData.error.code ?? code
        } else if (typeof errData.message === "string") {
          msg = errData.message
        }

        if (res.status === 413) {
          msg = "File is too large for the server. Please use a smaller file."
          code = "FILE_TOO_LARGE"
        } else if (res.status === 429) {
          msg = "Rate limit exceeded. Please wait a moment before trying again."
          code = "RATE_LIMITED"
        } else if (res.status === 400) {
          code = "BAD_REQUEST"
        } else if (res.status === 500) {
          code = "SERVER_ERROR"
        }

        const duration = Date.now() - (state.startedAt ?? Date.now())
        setState((prev) => ({
          ...prev,
          stage: "error",
          errorMessage: msg,
          errorCode: code,
          progress: 0,
          durationMs: duration,
        }))
        toast.error("Conversion failed", { description: msg })
        return
      }

      const blob = await res.blob()
      const disposition = res.headers.get("Content-Disposition")
      let filename = "converted"
      if (disposition) {
        const match = disposition.match(/filename="?([^"]+)"?/)
        if (match && match[1]) filename = match[1]
      }

      const duration = Date.now() - (state.startedAt ?? Date.now())
      setState((prev) => ({
        ...prev,
        stage: "done",
        progress: 100,
        progressLabel: "Complete!",
        resultBlob: blob,
        resultFilename: filename,
        durationMs: duration,
      }))
      toast.success("Conversion complete!", {
        description: `${filename} is ready to download.`,
      })
    } catch (err) {
      clearTimeout(timeoutId)
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current)
        progressTimerRef.current = null
      }
      const error = err as Error
      if (error.name === "AbortError" || controller.signal.aborted) {
        if (state.startedAt && Date.now() - state.startedAt > MAX_CONVERT_DURATION_MS - 1000) {
          toast.error("Conversion timed out", {
            description: "The file took too long to process. Try a smaller file.",
          })
          setState((prev) => ({
            ...prev,
            stage: "error",
            errorMessage: "Conversion timed out. Please try with a smaller file.",
            errorCode: "TIMEOUT",
          }))
        }
        return
      }
      const msg = error.message || "Network error. Please check your connection and try again."
      setState((prev) => ({
        ...prev,
        stage: "error",
        errorMessage: msg,
        errorCode: "NETWORK_ERROR",
      }))
      toast.error("Network error", { description: msg })
    }
  }, [state.file, state.outputFormat, state.startedAt, startProgressSimulation])

  const handleDownload = useCallback(() => {
    if (!state.resultBlob || !state.resultFilename) return
    const url = URL.createObjectURL(state.resultBlob)
    const a = document.createElement("a")
    a.href = url
    a.download = state.resultFilename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 100)
    toast.success("Download started", { description: state.resultFilename })
  }, [state.resultBlob, state.resultFilename])

  const handleReset = useCallback(() => {
    if (abortRef.current) abortRef.current.abort()
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current)
      progressTimerRef.current = null
    }
    setRetryCount(0)
    setState(INITIAL_STATE)
  }, [])

  const handleRetry = useCallback(() => {
    if (retryCount >= 3) {
      toast.error("Maximum retry attempts reached", {
        description: "Please start over with a new file.",
      })
      return
    }
    setRetryCount((c) => c + 1)
    handleConvert()
  }, [retryCount, handleConvert])

  const handleCopyFilename = useCallback(() => {
    if (!state.resultFilename) return
    navigator.clipboard
      .writeText(state.resultFilename)
      .then(() => toast.success("Filename copied"))
      .catch(() => toast.error("Failed to copy"))
  }, [state.resultFilename])

  const acceptExtensions = useMemo(() => {
    if (!formats?.inputFormats) return ACCEPT_ATTR
    return formats.inputFormats.flatMap((f) => INPUT_EXTENSIONS[f] ?? []).join(",")
  }, [formats])

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(1)}s`
  }

  const copyClientOutput = useCallback(() => {
    if (!clientOutput) return
    navigator.clipboard
      .writeText(clientOutput)
      .then(() => toast.success("Copied to clipboard"))
      .catch(() => toast.error("Failed to copy"))
  }, [clientOutput])

  const downloadClientOutput = useCallback(() => {
    if (!clientOutput) return
    const ext = clientConv.to === "text" ? "txt" : clientConv.to
    const mime =
      clientConv.to === "json"
        ? "application/json"
        : clientConv.to === "html"
          ? "text/html"
          : clientConv.to === "csv"
            ? "text/csv"
            : "text/plain"
    const blob = new Blob([clientOutput], { type: mime })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `converted.${ext}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 100)
  }, [clientOutput, clientConv])

  const docServerProps = {
    state,
    recentFormats,
    formats,
    acceptExtensions,
    fileInputRef,
    formatDuration,
    onFileChange: handleFileChange,
    onReset: handleReset,
    onConvert: handleConvert,
    onDownload: handleDownload,
    onCopyFilename: handleCopyFilename,
    onRetry: handleRetry,
    onSelectOutput: (v: string) =>
      setState((prev) => ({ ...prev, outputFormat: v })),
    retryCount,
  }

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8 md:py-12">
      <div className="mb-6 text-center">
        <Badge variant="outline" className="mb-3 gap-1.5">
          <Sparkles className="size-3" />
          {retryCount > 0 ? `Retry attempt ${retryCount}` : "Powered by DocForge"}
        </Badge>
        <h1 className="mb-2 text-3xl font-bold tracking-tight md:text-4xl">{t("convert")}</h1>
        <p className="text-muted-foreground">{tc("description")}</p>
      </div>

      <Alert className="mb-6">
        <Wand2 className="size-4" />
        <AlertTitle className="text-sm">{tc("offlineBannerTitle")}</AlertTitle>
        <AlertDescription className="text-muted-foreground text-sm">
          {tc("offlineBannerBody")}
        </AlertDescription>
      </Alert>

      <Tabs value={tab} onValueChange={handleTabChange} className="gap-4">
        <TabsList className="w-full">
          <TabsTrigger value="document" className="gap-1.5">
            <FileText className="size-3.5" />
            {tc("tabs.document")}
          </TabsTrigger>
          <TabsTrigger value="spreadsheet" className="gap-1.5">
            <FileSpreadsheet className="size-3.5" />
            {tc("tabs.spreadsheet")}
          </TabsTrigger>
          <TabsTrigger value="text" className="gap-1.5">
            <Database className="size-3.5" />
            {tc("tabs.text")}
          </TabsTrigger>
          <TabsTrigger value="ocr" className="gap-1.5">
            <ScanText className="size-3.5" />
            {tc("tabs.ocr")}
          </TabsTrigger>
        </TabsList>

        {/* ── Document tab (server) ─────────────────────────── */}
        <TabsContent value="document" className="space-y-4">
          {backendAvailable ? (
            <DocumentTabContent {...docServerProps} />
          ) : (
            <LockedOverlay feature="convert.server">
              <DocumentTabContent {...docServerProps} disabled />
            </LockedOverlay>
          )}
        </TabsContent>

        {/* ── Spreadsheet tab (CSV client, XLSX server) ─────── */}
        <TabsContent value="spreadsheet" className="space-y-4">
          <SpreadsheetTab
            locale={locale}
            clientConvId={clientConvId}
            csvInput={clientConv.id === "csv-json" ? clientInput : ""}
            jsonToCsvInput={clientConv.id === "json-csv" ? clientInput : ""}
            csvOutput={clientConv.id === "csv-json" ? clientOutput : ""}
            jsonToCsvOutput={clientConv.id === "json-csv" ? clientOutput : ""}
            csvError={
              clientConv.id === "csv-json" || clientConv.id === "json-csv"
                ? clientError
                : null
            }
            onCsvInputChange={(v) => {
              setClientConvId("csv-json")
              setClientInput(v)
            }}
            onJsonToCsvInputChange={(v) => {
              setClientConvId("json-csv")
              setClientInput(v)
            }}
            onCopyClient={copyClientOutput}
            onDownloadClient={downloadClientOutput}
            serverState={state}
            serverAccept={acceptExtensions}
            fileInputRef={fileInputRef}
            serverLocked={!backendAvailable}
            formatDuration={formatDuration}
            onFileChange={handleFileChange}
            onServerReset={handleReset}
            onServerConvert={handleConvert}
            onServerDownload={handleDownload}
            onServerCopyFilename={handleCopyFilename}
            onServerRetry={handleRetry}
            onServerSelectOutput={(v) =>
              setState((prev) => ({ ...prev, outputFormat: v }))
            }
            retryCount={retryCount}
          />
        </TabsContent>

        {/* ── Text & Data tab (always client) ───────────────── */}
        <TabsContent value="text" className="space-y-4">
          <TextTab
            conv={clientConv}
            convs={CLIENT_CONVERSIONS}
            input={clientInput}
            setInput={setClientInput}
            output={clientOutput}
            error={clientError}
            placeholder={CLIENT_INPUT_PLACEHOLDERS[clientConv.from] ?? ""}
            onPickConv={setClientConvId}
            onCopy={copyClientOutput}
            onDownload={downloadClientOutput}
            locale={locale}
          />
        </TabsContent>

        {/* ── OCR tab (server, locked) ──────────────────────── */}
        <TabsContent value="ocr" className="space-y-4">
          {backendAvailable ? (
            <OcrTab
              state={state}
              acceptExtensions={acceptExtensions}
              fileInputRef={fileInputRef}
              formatDuration={formatDuration}
              onFileChange={handleFileChange}
              onReset={handleReset}
              onConvert={handleConvert}
              onDownload={handleDownload}
              onCopyFilename={handleCopyFilename}
              onRetry={handleRetry}
              onSelectOutput={(v) => setState((prev) => ({ ...prev, outputFormat: v }))}
              retryCount={retryCount}
            />
          ) : (
            <LockedOverlay feature="convert.server" />
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ─── Sub-components ────────────────────────────────────────────────

function DocumentTabContent(props: {
  state: ConvertState
  recentFormats: string[]
  formats: { conversionMap: Record<string, string[]>; inputFormats: string[] } | null
  acceptExtensions: string
  fileInputRef: React.RefObject<HTMLInputElement | null>
  formatDuration: (ms: number) => string
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onReset: () => void
  onConvert: () => void
  onDownload: () => void
  onCopyFilename: () => void
  onRetry: () => void
  onSelectOutput: (v: string) => void
  retryCount: number
  disabled?: boolean
}) {
  const tc = useTranslations("convert")
  return (
    <>
      {props.recentFormats.length > 0 && props.state.stage === "upload" && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Recent:</span>
          {props.recentFormats.map((fmt) => (
            <Badge key={fmt} variant="secondary" className="gap-1">
              {FORMAT_ICONS[fmt] ?? "📄"} {FORMAT_LABELS[fmt] ?? fmt}
            </Badge>
          ))}
        </div>
      )}

      {props.state.stage === "upload" && (
        <ServerUploadDrop
          fileInputRef={props.fileInputRef}
          accept={props.acceptExtensions}
          onFileChange={props.onFileChange}
          disabled={props.disabled}
          label="Drag & drop your file here, or click to browse"
        />
      )}

      {props.state.stage === "selecting" && props.state.file && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <span className="text-2xl">
                {FORMAT_ICONS[props.state.inputFormat ?? ""] ?? "📄"}
              </span>
              <span className="flex-1 truncate">{props.state.file.name}</span>
              <Button variant="ghost" size="icon" onClick={props.onReset} aria-label="Remove file">
                <X className="size-4" />
              </Button>
            </CardTitle>
            <CardDescription>
              {formatBytes(props.state.file.size)} ·{" "}
              {FORMAT_LABELS[props.state.inputFormat ?? ""] ?? props.state.inputFormat}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label htmlFor="output-format" className="mb-2 block text-sm font-medium">
                {tc("outputFormat")}
              </label>
              <Select
                value={props.state.outputFormat ?? ""}
                onValueChange={props.onSelectOutput}
                disabled={props.disabled}
              >
                <SelectTrigger id="output-format">
                  <SelectValue placeholder="Select output format..." />
                </SelectTrigger>
                <SelectContent>
                  {props.state.availableOutputs.map((fmt) => (
                    <SelectItem key={fmt} value={fmt}>
                      <span className="mr-2">{FORMAT_ICONS[fmt] ?? ""}</span>
                      {FORMAT_LABELS[fmt] ?? fmt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Separator />
            <div className="flex items-center justify-between gap-3">
              <Button variant="outline" onClick={props.onReset}>
                {tc("cancel")}
              </Button>
              <Button
                onClick={props.onConvert}
                disabled={!props.state.outputFormat || props.disabled}
                className="gap-2"
              >
                <ArrowRight className="size-4" />
                {tc("startConversion")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {props.state.stage === "converting" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <Loader2 className="size-6 animate-spin text-primary" />
              {tc("converting")}
            </CardTitle>
            <CardDescription>
              {props.state.file?.name} →{" "}
              {FORMAT_LABELS[props.state.outputFormat ?? ""] ?? props.state.outputFormat}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Progress value={props.state.progress} className="h-2" />
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{props.state.progressLabel}</span>
              <span className="font-medium tabular-nums">
                {Math.round(props.state.progress)}%
              </span>
            </div>
            <div className="flex justify-center">
              <Button variant="outline" size="sm" onClick={props.onReset}>
                {tc("cancel")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {props.state.stage === "done" && props.state.resultBlob && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <CheckCircle2 className="size-6 text-green-500" />
              {tc("converted")}
            </CardTitle>
            <CardDescription className="flex items-center gap-2">
              {props.state.file?.name} → {props.state.resultFilename}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="flex items-center justify-between gap-2">
                <code
                  className="flex-1 truncate text-sm"
                  title={props.state.resultFilename ?? ""}
                >
                  {props.state.resultFilename}
                </code>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={props.onCopyFilename}
                  aria-label="Copy filename"
                >
                  <Copy className="size-3.5" />
                </Button>
              </div>
              <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                <span>Size: {formatBytes(props.state.resultBlob.size)}</span>
                {props.state.durationMs && (
                  <>
                    <span>·</span>
                    <span className="flex items-center gap-1">
                      <Clock className="size-3" /> {props.formatDuration(props.state.durationMs)}
                    </span>
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center justify-center gap-3">
              <Button onClick={props.onDownload} size="lg" className="gap-2">
                <Download className="size-4" />
                {tc("downloadResult")}
              </Button>
              <Button variant="outline" size="lg" onClick={props.onReset} className="gap-2">
                <RefreshCw className="size-4" />
                Convert Another
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {props.state.stage === "error" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <AlertCircle className="size-6 text-destructive" />
              {tc("failed")}
            </CardTitle>
            <CardDescription className="text-destructive">
              {props.state.errorMessage}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {props.state.errorCode && (
              <Alert variant="destructive">
                <FileWarning className="size-4" />
                <AlertTitle>Error code: {props.state.errorCode}</AlertTitle>
                {props.state.durationMs && (
                  <AlertDescription>
                    Failed after {props.formatDuration(props.state.durationMs)}
                  </AlertDescription>
                )}
              </Alert>
            )}
            <div className="flex justify-center gap-3">
              {props.state.file && props.state.outputFormat && props.retryCount < 3 && (
                <Button onClick={props.onRetry} className="gap-2">
                  <RefreshCw className="size-4" />
                  Retry ({3 - props.retryCount} left)
                </Button>
              )}
              <Button variant="outline" onClick={props.onReset}>
                Upload New File
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  )
}

function SpreadsheetTab(props: {
  locale: string
  clientConvId: string
  csvInput: string
  jsonToCsvInput: string
  csvOutput: string
  jsonToCsvOutput: string
  csvError: string | null
  onCsvInputChange: (v: string) => void
  onJsonToCsvInputChange: (v: string) => void
  onCopyClient: () => void
  onDownloadClient: () => void
  serverState: ConvertState
  serverAccept: string
  fileInputRef: React.RefObject<HTMLInputElement | null>
  serverLocked: boolean
  formatDuration: (ms: number) => string
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onServerReset: () => void
  onServerConvert: () => void
  onServerDownload: () => void
  onServerCopyFilename: () => void
  onServerRetry: () => void
  onServerSelectOutput: (v: string) => void
  retryCount: number
}) {
  const tc = useTranslations("convert")
  return (
    <div className="space-y-4">
      {/* CSV client-side block */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Database className="size-4" />
            {tc("spreadsheet.csvTitle")}
            <Badge variant="secondary" className="ml-2 gap-1">
              <Zap className="size-3" />
              {tc("clientSide")}
            </Badge>
          </CardTitle>
          <CardDescription>{tc("spreadsheet.csvDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* CSV → JSON */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">CSV</label>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => props.onCsvInputChange("")}
                >
                  {tc("clear")}
                </Button>
              </div>
              <Textarea
                value={props.csvInput}
                onChange={(e) => props.onCsvInputChange(e.target.value)}
                placeholder={"name,age\nAda,36\nBo,24"}
                className="min-h-[140px] font-mono text-xs"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">JSON</label>
                <div className="flex gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={props.onCopyClient}
                    disabled={!props.csvOutput}
                    aria-label="Copy"
                  >
                    <Copy className="size-3.5" />
                  </Button>
                </div>
              </div>
              <Textarea
                readOnly
                value={props.csvError ? `// ${props.csvError}` : props.csvOutput}
                className="min-h-[140px] font-mono text-xs"
              />
            </div>
          </div>
          {/* JSON → CSV */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">JSON</label>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => props.onJsonToCsvInputChange("")}
                >
                  {tc("clear")}
                </Button>
              </div>
              <Textarea
                value={props.jsonToCsvInput}
                onChange={(e) => props.onJsonToCsvInputChange(e.target.value)}
                placeholder={'[{"name":"Ada","age":36}]'}
                className="min-h-[140px] font-mono text-xs"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">CSV</label>
                <div className="flex gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={props.onCopyClient}
                    disabled={!props.jsonToCsvOutput}
                    aria-label="Copy"
                  >
                    <Copy className="size-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={props.onDownloadClient}
                    disabled={!props.jsonToCsvOutput}
                    aria-label="Download"
                  >
                    <Download className="size-3.5" />
                  </Button>
                </div>
              </div>
              <Textarea
                readOnly
                value={props.csvError ? `// ${props.csvError}` : props.jsonToCsvOutput}
                className="min-h-[140px] font-mono text-xs"
              />
            </div>
          </div>
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="text-muted-foreground inline-flex items-center gap-1.5">
              <CloudOff className="size-3" />
              {tc("instantClientHint")}
            </span>
            <Button asChild size="sm" variant="outline">
              <Link href={`/${props.locale}/tools/csv-json` as never}>
                {tc("openInTools")}
                <ExternalLink className="ml-1.5 size-3" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* XLSX server-side block */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileSpreadsheet className="size-4" />
            {tc("spreadsheet.xlsxTitle")}
            <Badge variant="outline" className="ml-2 gap-1">
              {tc("serverSide")}
            </Badge>
          </CardTitle>
          <CardDescription>{tc("spreadsheet.xlsxDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          {props.serverLocked ? (
            <LockedOverlay feature="convert.server" />
          ) : (
            <div className="space-y-4">
              {props.serverState.stage === "upload" && (
                <ServerUploadDrop
                  fileInputRef={props.fileInputRef}
                  accept={props.serverAccept}
                  onFileChange={props.onFileChange}
                />
              )}
              {props.serverState.stage === "selecting" && props.serverState.file && (
                <ServerSelectStage
                  state={props.serverState}
                  onSelectOutput={props.onServerSelectOutput}
                  onReset={props.onServerReset}
                  onConvert={props.onServerConvert}
                />
              )}
              {props.serverState.stage === "converting" && (
                <ServerProgressStage state={props.serverState} onReset={props.onServerReset} />
              )}
              {props.serverState.stage === "done" && props.serverState.resultBlob && (
                <ServerDoneStage
                  state={props.serverState}
                  formatDuration={props.formatDuration}
                  onDownload={props.onServerDownload}
                  onCopy={props.onServerCopyFilename}
                  onReset={props.onServerReset}
                />
              )}
              {props.serverState.stage === "error" && (
                <ServerErrorStage
                  state={props.serverState}
                  formatDuration={props.formatDuration}
                  onRetry={props.onServerRetry}
                  onReset={props.onServerReset}
                  retryCount={props.retryCount}
                />
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function TextTab(props: {
  conv: ClientConv
  convs: ClientConv[]
  input: string
  setInput: (v: string) => void
  output: string
  error: string | null
  placeholder: string
  onPickConv: (id: string) => void
  onCopy: () => void
  onDownload: () => void
  locale: string
}) {
  const tc = useTranslations("convert")
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Wand2 className="size-4" />
            {tc("textTabTitle")}
            <Badge variant="secondary" className="ml-2 gap-1">
              <Zap className="size-3" />
              {tc("clientSide")}
            </Badge>
          </CardTitle>
          <CardDescription>{tc("textTabDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
            <div className="space-y-1">
              <label className="text-muted-foreground text-xs font-medium">
                {tc("inputFormat")}
              </label>
              <Select value={props.conv.id} onValueChange={props.onPickConv}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {props.convs.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.from.toUpperCase()} → {c.to.toUpperCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <ArrowLeftRight className="text-muted-foreground mx-auto hidden size-4 sm:block" />
            <div className="space-y-1">
              <label className="text-muted-foreground text-xs font-medium">
                {tc("outputFormat")}
              </label>
              <div className="border-input bg-muted/30 flex h-9 items-center rounded-md border px-3 text-sm font-medium">
                {props.conv.outputLabel}
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">{props.conv.inputLabel}</label>
                <Button size="sm" variant="ghost" onClick={() => props.setInput("")}>
                  {tc("clear")}
                </Button>
              </div>
              <Textarea
                value={props.input}
                onChange={(e) => props.setInput(e.target.value)}
                placeholder={props.placeholder}
                className="min-h-[280px] font-mono text-xs"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">{props.conv.outputLabel}</label>
                <div className="flex gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={props.onCopy}
                    disabled={!props.output}
                    aria-label="Copy"
                  >
                    <Copy className="size-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={props.onDownload}
                    disabled={!props.output}
                    aria-label="Download"
                  >
                    <Download className="size-3.5" />
                  </Button>
                </div>
              </div>
              <Textarea
                readOnly
                value={props.error ? `// ${props.error}` : props.output}
                className="min-h-[280px] font-mono text-xs"
              />
            </div>
          </div>
          {props.error && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertTitle>{tc("conversionError")}</AlertTitle>
              <AlertDescription className="font-mono text-xs">{props.error}</AlertDescription>
            </Alert>
          )}
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="text-muted-foreground inline-flex items-center gap-1.5">
              <CloudOff className="size-3" />
              {tc("instantClientHint")}
            </span>
            <Button asChild size="sm" variant="outline">
              <Link href={`/${props.locale}/tools/${props.conv.toolSlug}` as never}>
                {tc("openInTools")}
                <ExternalLink className="ml-1.5 size-3" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function OcrTab(props: {
  state: ConvertState
  acceptExtensions: string
  fileInputRef: React.RefObject<HTMLInputElement | null>
  formatDuration: (ms: number) => string
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onReset: () => void
  onConvert: () => void
  onDownload: () => void
  onCopyFilename: () => void
  onRetry: () => void
  onSelectOutput: (v: string) => void
  retryCount: number
}) {
  const tc = useTranslations("convert")
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ScanText className="size-4" />
          {tc("ocrTitle")}
          <Badge variant="outline" className="ml-2 gap-1">
            {tc("serverSide")}
          </Badge>
        </CardTitle>
        <CardDescription>{tc("ocrDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        {props.state.stage === "upload" && (
          <ServerUploadDrop
            fileInputRef={props.fileInputRef}
            accept={props.acceptExtensions}
            onFileChange={props.onFileChange}
            label={tc("ocrUploadHint")}
          />
        )}
        {props.state.stage === "selecting" && props.state.file && (
          <ServerSelectStage
            state={props.state}
            onSelectOutput={props.onSelectOutput}
            onReset={props.onReset}
            onConvert={props.onConvert}
          />
        )}
        {props.state.stage === "converting" && (
          <ServerProgressStage state={props.state} onReset={props.onReset} />
        )}
        {props.state.stage === "done" && props.state.resultBlob && (
          <ServerDoneStage
            state={props.state}
            formatDuration={props.formatDuration}
            onDownload={props.onDownload}
            onCopy={props.onCopyFilename}
            onReset={props.onReset}
          />
        )}
        {props.state.stage === "error" && (
          <ServerErrorStage
            state={props.state}
            formatDuration={props.formatDuration}
            onRetry={props.onRetry}
            onReset={props.onReset}
            retryCount={props.retryCount}
          />
        )}
      </CardContent>
    </Card>
  )
}

function ServerUploadDrop(props: {
  fileInputRef: React.RefObject<HTMLInputElement | null>
  accept: string
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  disabled?: boolean
  label?: string
}) {
  const [dragActive, setDragActive] = useState(false)
  return (
    <div
      className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-10 transition-colors ${
        dragActive
          ? "border-primary bg-primary/5"
          : "border-muted-foreground/25 hover:border-primary/50"
      } ${props.disabled ? "pointer-events-none" : ""}`}
      onDragEnter={(e) => {
        e.preventDefault()
        e.stopPropagation()
        if (!props.disabled) setDragActive(true)
      }}
      onDragLeave={(e) => {
        e.preventDefault()
        e.stopPropagation()
        setDragActive(false)
      }}
      onDragOver={(e) => {
        e.preventDefault()
        e.stopPropagation()
        if (!props.disabled) setDragActive(true)
      }}
      onDrop={(e) => {
        e.preventDefault()
        setDragActive(false)
        if (props.disabled) return
        const files = e.dataTransfer.files
        if (files && files[0]) {
          const dt = new DataTransfer()
          dt.items.add(files[0])
          const input = props.fileInputRef.current
          if (input) {
            // Mutating the FileList of a hidden <input> from a drop handler is
            // the canonical way to forward a drag-and-dropped file to the
            // input's onChange event. The react-hooks lint rules flag it but
            // it is correct.
            // eslint-disable-next-line react-hooks/immutability
            input.files = dt.files
            input.dispatchEvent(new Event("change", { bubbles: true }))
          }
        }
      }}
      onClick={() => !props.disabled && props.fileInputRef.current?.click()}
      role="button"
      tabIndex={0}
    >
      <Upload className="mb-3 size-10 text-muted-foreground" />
      <p className="text-sm font-medium">
        {props.label ?? "Drag & drop your file here, or click to browse"}
      </p>
      {/* eslint-disable react-hooks/refs */}
      <input
        ref={props.fileInputRef}
        type="file"
        className="hidden"
        accept={props.accept}
        onChange={props.onFileChange}
        aria-label="File input"
      />
      {/* eslint-enable react-hooks/refs */}
    </div>
  )
}

function ServerSelectStage(props: {
  state: ConvertState
  onSelectOutput: (v: string) => void
  onReset: () => void
  onConvert: () => void
}) {
  const tc = useTranslations("convert")
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-2xl">
          {FORMAT_ICONS[props.state.inputFormat ?? ""] ?? "📄"}
        </span>
        <div className="flex-1 truncate text-sm">
          <div className="font-medium">{props.state.file?.name}</div>
          <div className="text-muted-foreground text-xs">
            {props.state.file ? formatBytes(props.state.file.size) : ""} ·{" "}
            {FORMAT_LABELS[props.state.inputFormat ?? ""] ?? props.state.inputFormat}
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={props.onReset} aria-label="Remove file">
          <X className="size-4" />
        </Button>
      </div>
      <div>
        <label htmlFor="server-output-format" className="mb-2 block text-sm font-medium">
          {tc("outputFormat")}
        </label>
        <Select
          value={props.state.outputFormat ?? ""}
          onValueChange={props.onSelectOutput}
        >
          <SelectTrigger id="server-output-format">
            <SelectValue placeholder="Select output format..." />
          </SelectTrigger>
          <SelectContent>
            {props.state.availableOutputs.map((fmt) => (
              <SelectItem key={fmt} value={fmt}>
                <span className="mr-2">{FORMAT_ICONS[fmt] ?? ""}</span>
                {FORMAT_LABELS[fmt] ?? fmt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center justify-between gap-3">
        <Button variant="outline" onClick={props.onReset}>
          {tc("cancel")}
        </Button>
        <Button onClick={props.onConvert} disabled={!props.state.outputFormat} className="gap-2">
          <ArrowRight className="size-4" />
          {tc("startConversion")}
        </Button>
      </div>
    </div>
  )
}

function ServerProgressStage(props: { state: ConvertState; onReset: () => void }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Loader2 className="size-5 animate-spin text-primary" />
        <span className="text-sm font-medium">Converting…</span>
      </div>
      <Progress value={props.state.progress} className="h-2" />
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{props.state.progressLabel}</span>
        <span className="font-medium tabular-nums">{Math.round(props.state.progress)}%</span>
      </div>
      <div className="flex justify-center">
        <Button variant="outline" size="sm" onClick={props.onReset}>
          Cancel
        </Button>
      </div>
    </div>
  )
}

function ServerDoneStage(props: {
  state: ConvertState
  formatDuration: (ms: number) => string
  onDownload: () => void
  onCopy: () => void
  onReset: () => void
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <CheckCircle2 className="size-6 text-green-500" />
        <div className="flex-1 truncate text-sm">
          <div className="font-medium">Done</div>
          <div className="text-muted-foreground truncate text-xs">
            {props.state.file?.name} → {props.state.resultFilename}
          </div>
        </div>
      </div>
      <div className="rounded-lg border bg-muted/30 p-4">
        <div className="flex items-center justify-between gap-2">
          <code
            className="flex-1 truncate text-sm"
            title={props.state.resultFilename ?? ""}
          >
            {props.state.resultFilename}
          </code>
          <Button variant="ghost" size="icon" onClick={props.onCopy} aria-label="Copy filename">
            <Copy className="size-3.5" />
          </Button>
        </div>
        <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
          <span>Size: {props.state.resultBlob ? formatBytes(props.state.resultBlob.size) : ""}</span>
          {props.state.durationMs && (
            <>
              <span>·</span>
              <span className="flex items-center gap-1">
                <Clock className="size-3" /> {props.formatDuration(props.state.durationMs)}
              </span>
            </>
          )}
        </div>
      </div>
      <div className="flex items-center justify-center gap-3">
        <Button onClick={props.onDownload} size="lg" className="gap-2">
          <Download className="size-4" />
          Download
        </Button>
        <Button variant="outline" size="lg" onClick={props.onReset} className="gap-2">
          <RefreshCw className="size-4" />
          Convert Another
        </Button>
      </div>
    </div>
  )
}

function ServerErrorStage(props: {
  state: ConvertState
  formatDuration: (ms: number) => string
  onRetry: () => void
  onReset: () => void
  retryCount: number
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <AlertCircle className="size-6 text-destructive" />
        <div className="flex-1 truncate text-sm">
          <div className="font-medium text-destructive">Conversion Failed</div>
          <div className="text-muted-foreground text-xs">{props.state.errorMessage}</div>
        </div>
      </div>
      {props.state.errorCode && (
        <Alert variant="destructive">
          <FileWarning className="size-4" />
          <AlertTitle>Error code: {props.state.errorCode}</AlertTitle>
          {props.state.durationMs && (
            <AlertDescription>
              Failed after {props.formatDuration(props.state.durationMs)}
            </AlertDescription>
          )}
        </Alert>
      )}
      <div className="flex justify-center gap-3">
        {props.state.file && props.state.outputFormat && props.retryCount < 3 && (
          <Button onClick={props.onRetry} className="gap-2">
            <RefreshCw className="size-4" />
            Retry ({3 - props.retryCount} left)
          </Button>
        )}
        <Button variant="outline" onClick={props.onReset}>
          Upload New File
        </Button>
      </div>
    </div>
  )
}
