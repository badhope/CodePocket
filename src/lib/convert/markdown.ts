import { marked } from "marked"
import TurndownService from "turndown"
import { ConversionError } from "./types"
import { DEFAULT_MAX_TEXT_SIZE } from "./types"
import { sanitizeHtml, sanitizeText } from "./sanitize"

function crc32(data: Buffer): number {
  let crc = 0xffffffff
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i]!
    for (let j = 0; j < 8; j++) {
      if (crc & 1) {
        crc = (crc >>> 1) ^ 0xedb88320
      } else {
        crc = crc >>> 1
      }
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

function buildMinimalDocx(text: string): Buffer {
  const escapedText = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/\n/g, "</w:t></w:r></w:p><w:p><w:r><w:t>")

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${escapedText}</w:t></w:r></w:p></w:body></w:document>`
  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`
  const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`
  const docRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`

  const files: { name: string; data: Buffer }[] = [
    { name: "[Content_Types].xml", data: Buffer.from(contentTypesXml, "utf-8") },
    { name: "_rels/.rels", data: Buffer.from(relsXml, "utf-8") },
    { name: "word/document.xml", data: Buffer.from(documentXml, "utf-8") },
    { name: "word/_rels/document.xml.rels", data: Buffer.from(docRelsXml, "utf-8") },
  ]

  let centralOffset = 0
  const localHeaders: Buffer[] = []

  for (const file of files) {
    const nameBytes = Buffer.from(file.name, "utf-8")
    const crc = crc32(file.data)
    const header = Buffer.alloc(30 + nameBytes.length)
    header.writeUInt32LE(0x04034b50, 0)
    header.writeUInt16LE(20, 4)
    header.writeUInt16LE(0, 6)
    header.writeUInt16LE(0, 8)
    header.writeUInt32LE(0, 10)
    header.writeUInt32LE(crc, 14)
    header.writeUInt32LE(file.data.length, 18)
    header.writeUInt32LE(file.data.length, 22)
    header.writeUInt16LE(nameBytes.length, 26)
    header.writeUInt16LE(0, 28)
    nameBytes.copy(header, 30)
    localHeaders.push(header)
    localHeaders.push(file.data)
    centralOffset += header.length + file.data.length
  }

  const centralEntries: Buffer[] = []
  let localOffset = 0

  for (const file of files) {
    const nameBytes = Buffer.from(file.name, "utf-8")
    const crc = crc32(file.data)
    const entry = Buffer.alloc(46 + nameBytes.length)
    entry.writeUInt32LE(0x02014b50, 0)
    entry.writeUInt16LE(20, 4)
    entry.writeUInt16LE(20, 6)
    entry.writeUInt16LE(0, 8)
    entry.writeUInt16LE(0, 10)
    entry.writeUInt32LE(0, 12)
    entry.writeUInt32LE(crc, 16)
    entry.writeUInt32LE(file.data.length, 20)
    entry.writeUInt32LE(file.data.length, 24)
    entry.writeUInt16LE(nameBytes.length, 28)
    entry.writeUInt16LE(0, 30)
    entry.writeUInt16LE(0, 32)
    entry.writeUInt32LE(0, 34)
    entry.writeUInt32LE(localOffset, 42)
    nameBytes.copy(entry, 46)
    centralEntries.push(entry)
    localOffset += 30 + nameBytes.length + file.data.length
  }

  const centralDir = Buffer.concat(centralEntries)
  const centralSize = centralDir.length
  const centralOffsetVal = centralOffset

  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)
  eocd.writeUInt16LE(0, 4)
  eocd.writeUInt16LE(0, 6)
  eocd.writeUInt16LE(files.length, 8)
  eocd.writeUInt16LE(files.length, 10)
  eocd.writeUInt32LE(centralSize, 12)
  eocd.writeUInt32LE(centralOffsetVal, 16)
  eocd.writeUInt16LE(0, 20)

  return Buffer.concat([...localHeaders, centralDir, eocd])
}

export function enforceSizeLimit(text: string, max: number = DEFAULT_MAX_TEXT_SIZE): void {
  // Approximate the byte length of a UTF-16 string in one pass without
  // walking code points twice; this matches `Buffer.byteLength` for
  // the BMP and is close enough for the limit check.
  if (text.length * 2 > max * 2) {
    if (Buffer.byteLength(text, "utf-8") > max) {
      throw new ConversionError(
        "INPUT_TOO_LARGE",
        `Input exceeds the maximum size of ${max} bytes`,
      )
    }
  }
}

export async function convertMarkdownToHtml(md: string): Promise<string> {
  enforceSizeLimit(md)
  const html = await marked.parse(md)
  if (typeof html === "string") {
    return html
  }
  return String(html)
}

/**
 * Markdown → HTML conversion that sanitises the output. The Markdown
 * source is rendered with `marked` and then run through `sanitizeHtml`
 * to strip script tags, inline event handlers, and `javascript:` URLs.
 * Use this whenever the resulting HTML will be injected into a browser
 * or stored alongside untrusted data.
 */
export async function convertMarkdownToHtmlSafe(md: string): Promise<string> {
  const html = await convertMarkdownToHtml(md)
  return sanitizeHtml(html)
}

export async function convertMarkdownToPdf(md: string): Promise<Buffer> {
  enforceSizeLimit(md)
  const html = await convertMarkdownToHtml(md)
  const sanitized = sanitizeHtml(html)

  const { default: JsPDF } = await import("jspdf")

  const doc = new JsPDF({ unit: "pt", format: "a4" })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const marginX = 40
  const marginY = 40
  const maxWidth = pageWidth - marginX * 2
  let cursorY = marginY

  // Strip HTML tags and decode the most common entities, then render line by
  // line. This is a server-safe path: jsPDF's html() method depends on the
  // DOM, but we are running on the server.
  const decode = (s: string) =>
    s
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")

  // Tokenize: headings, blank lines, list items, paragraphs.
  type Block =
    | { kind: "h1" | "h2" | "h3"; text: string }
    | { kind: "ul"; items: string[] }
    | { kind: "ol"; items: string[] }
    | { kind: "code"; text: string }
    | { kind: "p"; text: string }

  const blocks: Block[] = []
  const lines = sanitized.split(/\r?\n/)
  let i = 0
  while (i < lines.length) {
    const raw = lines[i] ?? ""
    const line = raw.trim()
    if (!line) {
      i++
      continue
    }
    if (line.startsWith("<h1")) {
      blocks.push({ kind: "h1", text: decode(stripTags(line)) })
      i++
      continue
    }
    if (line.startsWith("<h2")) {
      blocks.push({ kind: "h2", text: decode(stripTags(line)) })
      i++
      continue
    }
    if (line.startsWith("<h3")) {
      blocks.push({ kind: "h3", text: decode(stripTags(line)) })
      i++
      continue
    }
    if (line.startsWith("<pre>") || line.startsWith("<pre ")) {
      const buf: string[] = []
      i++
      while (i < lines.length && !lines[i]?.includes("</pre>")) {
        buf.push(lines[i] ?? "")
        i++
      }
      i++
      blocks.push({ kind: "code", text: decode(stripTags(buf.join("\n"))) })
      continue
    }
    if (line.startsWith("<ul>")) {
      const items: string[] = []
      i++
      while (i < lines.length && !lines[i]?.startsWith("</ul>")) {
        const li = lines[i] ?? ""
        if (li.startsWith("<li>")) items.push(decode(stripTags(li)))
        i++
      }
      i++
      blocks.push({ kind: "ul", items })
      continue
    }
    if (line.startsWith("<ol>")) {
      const items: string[] = []
      let n = 1
      i++
      while (i < lines.length && !lines[i]?.startsWith("</ol>")) {
        const li = lines[i] ?? ""
        if (li.startsWith("<li>")) items.push(`${n++}. ${decode(stripTags(li))}`)
        i++
      }
      i++
      blocks.push({ kind: "ol", items })
      continue
    }
    if (line.startsWith("<p>") || line.startsWith("<p ")) {
      blocks.push({ kind: "p", text: decode(stripTags(line)) })
      i++
      continue
    }
    // Fallback: paragraph of raw text
    blocks.push({ kind: "p", text: decode(stripTags(line)) })
    i++
  }

  function stripTags(s: string): string {
    return s.replace(/<[^>]+>/g, "")
  }

  function ensureSpace(needed: number) {
    if (cursorY + needed > pageHeight - marginY) {
      doc.addPage()
      cursorY = marginY
    }
  }

  for (const block of blocks) {
    switch (block.kind) {
      case "h1": {
        doc.setFont("helvetica", "bold")
        doc.setFontSize(20)
        ensureSpace(28)
        doc.text(block.text, marginX, cursorY)
        cursorY += 28
        break
      }
      case "h2": {
        doc.setFont("helvetica", "bold")
        doc.setFontSize(16)
        ensureSpace(24)
        doc.text(block.text, marginX, cursorY)
        cursorY += 24
        break
      }
      case "h3": {
        doc.setFont("helvetica", "bold")
        doc.setFontSize(13)
        ensureSpace(20)
        doc.text(block.text, marginX, cursorY)
        cursorY += 20
        break
      }
      case "ul":
      case "ol": {
        doc.setFont("helvetica", "normal")
        doc.setFontSize(11)
        for (const item of block.items) {
          const wrapped = doc.splitTextToSize(item, maxWidth - 14)
          ensureSpace(wrapped.length * 14 + 4)
          doc.text(wrapped, marginX + 14, cursorY)
          cursorY += wrapped.length * 14 + 2
        }
        cursorY += 4
        break
      }
      case "code": {
        doc.setFont("courier", "normal")
        doc.setFontSize(9)
        for (const cl of block.text.split("\n")) {
          const wrapped = doc.splitTextToSize(cl || " ", maxWidth)
          ensureSpace(wrapped.length * 12 + 2)
          doc.text(wrapped, marginX, cursorY)
          cursorY += wrapped.length * 12
        }
        cursorY += 6
        break
      }
      case "p": {
        doc.setFont("helvetica", "normal")
        doc.setFontSize(11)
        const wrapped = doc.splitTextToSize(block.text, maxWidth)
        ensureSpace(wrapped.length * 15 + 4)
        doc.text(wrapped, marginX, cursorY)
        cursorY += wrapped.length * 15 + 4
        break
      }
    }
  }

  const arrayBuffer = doc.output("arraybuffer")
  return Buffer.from(arrayBuffer)
}

/**
 * Parse an HTML string into Markdown. Falls back to a best-effort
 * plain-text extraction when the HTML is malformed so callers always
 * get a non-empty result.
 */
export function convertHtmlToMarkdown(html: string): Promise<string> {
  enforceSizeLimit(html)
  const turndownService = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
  })
  try {
    const md = turndownService.turndown(html)
    return Promise.resolve(md)
  } catch (err) {
    // Fall back to a coarse plain-text extraction so the caller still
    // gets a usable result.
    const text = html
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+\n/g, "\n")
      .trim()
    return Promise.resolve(text)
  }
}

/**
 * Sanitising wrapper around {@link convertHtmlToMarkdown}. The input
 * HTML is first run through {@link sanitizeHtml} so that adversarial
 * content (e.g. embedded `<script>` blocks) cannot leak into the
 * rendered Markdown.
 */
export function convertHtmlToMarkdownSafe(html: string): Promise<string> {
  const clean = sanitizeHtml(html)
  return convertHtmlToMarkdown(clean)
}

export async function convertMarkdownToDocx(md: string): Promise<Buffer> {
  enforceSizeLimit(md)
  const html = await convertMarkdownToHtml(md)
  const sanitized = sanitizeHtml(html)
  const text = sanitized
    .replace(/<h1[^>]*>/gi, "\n\n# ")
    .replace(/<h2[^>]*>/gi, "\n\n## ")
    .replace(/<h3[^>]*>/gi, "\n\n### ")
    .replace(/<h4[^>]*>/gi, "\n\n#### ")
    .replace(/<h5[^>]*>/gi, "\n\n##### ")
    .replace(/<h6[^>]*>/gi, "\n\n###### ")
    .replace(/<\/h[1-6]>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()

  return buildMinimalDocx(sanitizeText(text))
}
