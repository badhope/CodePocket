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

  await doc.html(html, {
    callback: (instance) => {
      void instance
    },
    x: 20,
    y: 20,
    width: doc.internal.pageSize.getWidth() - 40,
    windowWidth: 800,
  })

  const arrayBuffer = doc.output("arraybuffer")
  return Buffer.from(arrayBuffer)
}