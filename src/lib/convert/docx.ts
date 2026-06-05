import mammoth from "mammoth"
import { convertHtmlToMarkdown } from "./markdown"

export async function convertDocxToHtml(buffer: Buffer): Promise<string> {
  const result = await mammoth.convertToHtml({ buffer })
  return result.value
}

export async function convertDocxToMarkdown(buffer: Buffer): Promise<string> {
  const htmlResult = await mammoth.convertToHtml({ buffer })
  return convertHtmlToMarkdown(htmlResult.value)
}

export async function convertDocxToText(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer })
  return result.value
}

export async function convertDocxToPdf(buffer: Buffer): Promise<Buffer> {
  const htmlResult = await mammoth.convertToHtml({ buffer })
  const html = htmlResult.value

  const { default: JsPDF } = await import("jspdf")

  const doc = new JsPDF({ unit: "pt", format: "a4" })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const marginX = 40
  const marginY = 40
  const maxWidth = pageWidth - marginX * 2
  let cursorY = marginY

  const decode = (s: string) =>
    s
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
  const stripTags = (s: string) => s.replace(/<[^>]+>/g, "")

  function ensureSpace(needed: number) {
    if (cursorY + needed > pageHeight - marginY) {
      doc.addPage()
      cursorY = marginY
    }
  }

  function writeWrapped(text: string, font: "helvetica" | "courier" = "helvetica", style: "normal" | "bold" = "normal", size = 11, lineHeight = 15) {
    doc.setFont(font, style)
    doc.setFontSize(size)
    const wrapped = doc.splitTextToSize(text || " ", maxWidth)
    ensureSpace(wrapped.length * lineHeight + 4)
    doc.text(wrapped, marginX, cursorY)
    cursorY += wrapped.length * lineHeight + 2
  }

  for (const raw of html.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) {
      cursorY += 4
      continue
    }
    if (line.startsWith("<h1")) {
      writeWrapped(decode(stripTags(line)), "helvetica", "bold", 20, 26)
    } else if (line.startsWith("<h2")) {
      writeWrapped(decode(stripTags(line)), "helvetica", "bold", 16, 22)
    } else if (line.startsWith("<h3")) {
      writeWrapped(decode(stripTags(line)), "helvetica", "bold", 13, 18)
    } else if (line.startsWith("<li>") || line.startsWith("<li ")) {
      writeWrapped("•  " + decode(stripTags(line)), "helvetica", "normal", 11, 14)
    } else if (line.startsWith("<p") || line.startsWith("<div")) {
      writeWrapped(decode(stripTags(line)), "helvetica", "normal", 11, 15)
    } else {
      writeWrapped(decode(stripTags(line)))
    }
  }

  const arrayBuffer = doc.output("arraybuffer")
  return Buffer.from(arrayBuffer)
}