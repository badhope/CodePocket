import { ConversionError } from "./types"
import type { InputFormat, OutputFormat } from "./types"
import { CONVERSION_MAP, EXTENSIONS, INPUT_FORMATS, MIME_TYPES } from "./types"

const EXTENSION_ALIASES: Record<string, InputFormat> = {
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

export function detectFormat(filename: string): InputFormat | null {
  const ext = filename.split(".").pop()?.toLowerCase()
  if (!ext) return null

  const format = EXTENSION_ALIASES[ext]
  if (format && (INPUT_FORMATS as readonly string[]).includes(format)) {
    return format
  }

  return null
}

export function getMimeType(format: string): string {
  return MIME_TYPES[format] ?? "application/octet-stream"
}

export function getExtension(format: string): string {
  return EXTENSIONS[format] ?? ""
}

export function getOutputFilename(inputFilename: string, outputFormat: OutputFormat): string {
  const dotIndex = inputFilename.lastIndexOf(".")
  const baseName = dotIndex > 0 ? inputFilename.slice(0, dotIndex) : inputFilename
  const ext = getExtension(outputFormat)
  return `${baseName}${ext}`
}

export function isConversionSupported(from: InputFormat, to: OutputFormat): boolean {
  const supportedOutputs = CONVERSION_MAP[from]
  if (!supportedOutputs) return false
  return supportedOutputs.includes(to)
}

export function getAvailableOutputs(from: InputFormat): OutputFormat[] {
  return (CONVERSION_MAP[from] as OutputFormat[]) ?? []
}

/* ------------------------------------------------------------------ */
/*                          Enhanced helpers                           */
/* ------------------------------------------------------------------ */

/**
 * Strict variant of `isConversionSupported` that throws a typed
 * `ConversionError` instead of returning `false`. Useful for code paths
 * that have already validated the input format and want to short-circuit
 * the conversion with a meaningful error.
 */
export function validateFormatPair(from: InputFormat, to: OutputFormat): void {
  if (!(INPUT_FORMATS as readonly string[]).includes(from)) {
    throw new ConversionError("UNSUPPORTED_PAIR", `Unsupported input format: ${from}`)
  }
  if (!isConversionSupported(from, to)) {
    throw new ConversionError(
      "UNSUPPORTED_PAIR",
      `Conversion from ${from} to ${to} is not supported`,
    )
  }
}

export interface FormatInfo {
  format: string
  mimeType: string
  extension: string
  isInput: boolean
  isOutput: boolean
  supportedOutputs: string[]
  description: string
  category: FormatCategory
}

export type FormatCategory = "document" | "spreadsheet" | "presentation" | "text" | "data" | "markup"

/**
 * Resolve all known metadata about a format in one call. The result is
 * useful for surfacing help text, building UI selectors, or reporting
 * the capabilities of a particular conversion.
 */
export function getFormatInfo(format: string): FormatInfo {
  const lower = format.toLowerCase() as InputFormat | OutputFormat
  const mimeType = MIME_TYPES[lower] ?? "application/octet-stream"
  const extension = EXTENSIONS[lower] ?? ""
  return {
    format: lower,
    mimeType,
    extension,
    isInput: (INPUT_FORMATS as readonly string[]).includes(lower),
    isOutput: !!(CONVERSION_MAP[lower]?.length),
    supportedOutputs: CONVERSION_MAP[lower] ?? [],
    description: getFormatDescription(lower),
    category: getCategory(lower),
  }
}

/**
 * Enumerate every `from -> to` pair that the engine knows how to
 * convert. Returned as `{ from, to }` tuples in a stable order.
 */
export function getAllSupportedConversions(): Array<{ from: InputFormat; to: OutputFormat }> {
  const pairs: Array<{ from: InputFormat; to: OutputFormat }> = []
  for (const from of Object.keys(CONVERSION_MAP) as InputFormat[]) {
    const targets = CONVERSION_MAP[from] ?? []
    for (const to of targets) {
      pairs.push({ from, to: to as OutputFormat })
    }
  }
  return pairs
}

const DESCRIPTIONS: Record<string, string> = {
  docx: "Microsoft Word Open XML document",
  pdf: "Portable Document Format",
  md: "Markdown plain-text markup",
  html: "HyperText Markup Language",
  txt: "Plain text",
  xlsx: "Microsoft Excel Open XML workbook",
  csv: "Comma-separated values",
  json: "JavaScript Object Notation",
  xml: "Extensible Markup Language",
  pptx: "Microsoft PowerPoint Open XML presentation",
}

function getCategory(format: string): FormatCategory {
  switch (format) {
    case "docx":
    case "pdf":
      return "document"
    case "xlsx":
    case "csv":
      return "spreadsheet"
    case "pptx":
      return "presentation"
    case "md":
    case "txt":
      return "text"
    case "json":
      return "data"
    case "html":
    case "xml":
      return "markup"
    default:
      return "text"
  }
}

/**
 * Human-readable description for a format. Falls back to the raw format
 * name (capitalized) when no description is registered.
 */
export function getFormatDescription(format: string): string {
  return DESCRIPTIONS[format] ?? `${format.charAt(0).toUpperCase()}${format.slice(1)} file`
}
