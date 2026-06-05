"use client"

import { useState, useCallback, useRef, useEffect, useMemo } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
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
} from "lucide-react"
import { formatBytes } from "@/lib/utils"
import { toast } from "sonner"

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

export default function ConvertPage() {
  const t = useTranslations("nav")
  const tc = useTranslations("common")
  void tc // reserved for future use
  const [state, setState] = useState<ConvertState>(INITIAL_STATE)
  const [dragActive, setDragActive] = useState(false)
  const [formats, setFormats] = useState<{
    conversionMap: Record<string, string[]>
    inputFormats: string[]
  } | null>(null)
  const [recentFormats, setRecentFormats] = useState<string[]>([])
  const [retryCount, setRetryCount] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

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
          toast.error("Failed to load supported formats", {
            description: "Please refresh the page or check your connection.",
          })
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

  const handleDrag = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()
      setDragActive(false)
      const files = e.dataTransfer.files
      if (files && files[0]) {
        handleFile(files[0])
      } else {
        toast.warning("No file detected", {
          description: "Please drag and drop a file directly.",
        })
      }
    },
    [handleFile],
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

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8 md:py-12">
      <div className="mb-8 text-center">
        <Badge variant="outline" className="mb-3 gap-1.5">
          <Sparkles className="size-3" />
          {retryCount > 0 ? `Retry attempt ${retryCount}` : "Powered by DocForge"}
        </Badge>
        <h1 className="mb-2 text-3xl font-bold tracking-tight md:text-4xl">{t("convert")}</h1>
        <p className="text-muted-foreground">
          Upload your document and convert it to any supported format
        </p>
      </div>

      {recentFormats.length > 0 && state.stage === "upload" && (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Recent:</span>
          {recentFormats.map((fmt) => (
            <Badge key={fmt} variant="secondary" className="gap-1">
              {FORMAT_ICONS[fmt] ?? "📄"} {FORMAT_LABELS[fmt] ?? fmt}
            </Badge>
          ))}
        </div>
      )}

      {state.stage === "upload" && (
        <Card>
          <CardContent className="p-0">
            <div
              className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 transition-colors ${
                dragActive
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-primary/50"
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  fileInputRef.current?.click()
                }
              }}
              aria-label="Upload file"
            >
              <Upload className="mb-4 size-12 text-muted-foreground" />
              <p className="mb-2 text-lg font-medium">Drag & drop your file here</p>
              <p className="mb-4 text-sm text-muted-foreground">
                or click to browse · Max {formatBytes(MAX_FILE_SIZE)}
              </p>
              <Badge variant="secondary" className="gap-1">
                <FileText className="size-3" />
                DOCX, PDF, MD, HTML, XLSX, CSV, JSON, XML, PPTX
              </Badge>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept={acceptExtensions}
                onChange={handleFileChange}
                aria-label="File input"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {state.stage === "selecting" && state.file && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <span className="text-2xl">{FORMAT_ICONS[state.inputFormat ?? ""] ?? "📄"}</span>
              <span className="flex-1 truncate">{state.file.name}</span>
              <Button variant="ghost" size="icon" onClick={handleReset} aria-label="Remove file">
                <X className="size-4" />
              </Button>
            </CardTitle>
            <CardDescription>
              {formatBytes(state.file.size)} · {FORMAT_LABELS[state.inputFormat ?? ""] ?? state.inputFormat}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label htmlFor="output-format" className="mb-2 block text-sm font-medium">
                Output Format
              </label>
              <Select
                value={state.outputFormat ?? ""}
                onValueChange={(v) => setState((prev) => ({ ...prev, outputFormat: v }))}
              >
                <SelectTrigger id="output-format">
                  <SelectValue placeholder="Select output format..." />
                </SelectTrigger>
                <SelectContent>
                  {state.availableOutputs.map((fmt) => (
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
              <Button variant="outline" onClick={handleReset}>
                Cancel
              </Button>
              <Button onClick={handleConvert} disabled={!state.outputFormat} className="gap-2">
                <ArrowRight className="size-4" />
                Convert to{" "}
                {state.outputFormat ? FORMAT_LABELS[state.outputFormat] ?? state.outputFormat : "..."}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {state.stage === "converting" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <Loader2 className="size-6 animate-spin text-primary" />
              Converting your document...
            </CardTitle>
            <CardDescription>
              {state.file?.name} → {FORMAT_LABELS[state.outputFormat ?? ""] ?? state.outputFormat}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Progress value={state.progress} className="h-2" />
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{state.progressLabel}</span>
              <span className="font-medium tabular-nums">{Math.round(state.progress)}%</span>
            </div>
            <div className="flex justify-center">
              <Button variant="outline" size="sm" onClick={handleReset}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {state.stage === "done" && state.resultBlob && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <CheckCircle2 className="size-6 text-green-500" />
              Conversion Complete!
            </CardTitle>
            <CardDescription className="flex items-center gap-2">
              {state.file?.name} → {state.resultFilename}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="flex items-center justify-between gap-2">
                <code className="flex-1 truncate text-sm" title={state.resultFilename ?? ""}>
                  {state.resultFilename}
                </code>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleCopyFilename}
                  aria-label="Copy filename"
                >
                  <Copy className="size-3.5" />
                </Button>
              </div>
              <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                <span>Size: {formatBytes(state.resultBlob.size)}</span>
                {state.durationMs && (
                  <>
                    <span>·</span>
                    <span className="flex items-center gap-1">
                      <Clock className="size-3" /> {formatDuration(state.durationMs)}
                    </span>
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center justify-center gap-3">
              <Button onClick={handleDownload} size="lg" className="gap-2">
                <Download className="size-4" />
                Download
              </Button>
              <Button variant="outline" size="lg" onClick={handleReset} className="gap-2">
                <RefreshCw className="size-4" />
                Convert Another
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {state.stage === "error" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <AlertCircle className="size-6 text-destructive" />
              Conversion Failed
            </CardTitle>
            <CardDescription className="text-destructive">
              {state.errorMessage}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {state.errorCode && (
              <Alert variant="destructive">
                <FileWarning className="size-4" />
                <AlertTitle>Error code: {state.errorCode}</AlertTitle>
                {state.durationMs && (
                  <AlertDescription>
                    Failed after {formatDuration(state.durationMs)}
                  </AlertDescription>
                )}
              </Alert>
            )}
            <div className="flex justify-center gap-3">
              {state.file && state.outputFormat && retryCount < 3 && (
                <Button onClick={handleRetry} className="gap-2">
                  <RefreshCw className="size-4" />
                  Retry ({3 - retryCount} left)
                </Button>
              )}
              <Button variant="outline" onClick={handleReset}>
                Upload New File
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
