import { getDocument } from "pdfjs-dist"
import { PDFDocument, StandardFonts, rgb } from "pdf-lib"

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
  let centralStart = 0

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
    entry.writeUInt32LE(centralStart, 42)
    nameBytes.copy(entry, 46)
    centralEntries.push(entry)
    centralStart += 30 + nameBytes.length + file.data.length
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

export async function convertPdfToText(buffer: Buffer): Promise<string> {
  const loadingTask = getDocument({ data: new Uint8Array(buffer) })
  const pdf = await loadingTask.promise
  const pages: string[] = []

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const textContent = await page.getTextContent()
    const text = textContent.items.map((item) => ("str" in item ? item.str : "")).join(" ")
    pages.push(text)
  }

  return pages.join("\n\n")
}

export async function convertPdfToHtml(buffer: Buffer): Promise<string> {
  const text = await convertPdfToText(buffer)
  const paragraphs = text.split("\n\n").filter(Boolean)
  const htmlParagraphs = paragraphs.map((p) => `<p>${escapeHtml(p.replace(/\n/g, "<br>"))}</p>`)
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>PDF Content</title></head><body>${htmlParagraphs.join("\n")}</body></html>`
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

export async function convertPdfToDocx(buffer: Buffer): Promise<Buffer> {
  const text = await convertPdfToText(buffer)
  return buildMinimalDocx(text)
}