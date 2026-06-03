import * as XLSX from "xlsx"

export async function convertExcelToCsv(buffer: Buffer): Promise<string> {
  const workbook = XLSX.read(buffer, { type: "buffer" })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) {
    throw new Error("No sheets found in the Excel file")
  }
  const sheet = workbook.Sheets[sheetName]
  if (!sheet) {
    throw new Error(`Sheet "${sheetName}" not found`)
  }
  const csv = XLSX.utils.sheet_to_csv(sheet)
  return csv
}

export async function convertExcelToJson(buffer: Buffer): Promise<string> {
  const workbook = XLSX.read(buffer, { type: "buffer" })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) {
    throw new Error("No sheets found in the Excel file")
  }
  const sheet = workbook.Sheets[sheetName]
  if (!sheet) {
    throw new Error(`Sheet "${sheetName}" not found`)
  }
  const data = XLSX.utils.sheet_to_json(sheet)
  return JSON.stringify(data, null, 2)
}

export async function convertCsvToJson(csv: string): Promise<string> {
  const workbook = XLSX.read(csv, { type: "string" })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) {
    throw new Error("No sheets found in the CSV data")
  }
  const sheet = workbook.Sheets[sheetName]
  if (!sheet) {
    throw new Error(`Sheet "${sheetName}" not found`)
  }
  const data = XLSX.utils.sheet_to_json(sheet)
  return JSON.stringify(data, null, 2)
}

export async function convertJsonToCsv(json: string): Promise<string> {
  const data = JSON.parse(json)
  const arr = Array.isArray(data) ? data : [data]
  const worksheet = XLSX.utils.json_to_sheet(arr)
  const csv = XLSX.utils.sheet_to_csv(worksheet)
  return csv
}

export async function convertCsvToExcel(csv: string): Promise<Buffer> {
  const workbook = XLSX.read(csv, { type: "string" })
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" })
  return Buffer.from(buffer)
}

export async function convertExcelToHtml(buffer: Buffer): Promise<string> {
  const workbook = XLSX.read(buffer, { type: "buffer" })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) {
    throw new Error("No sheets found in the Excel file")
  }
  const sheet = workbook.Sheets[sheetName]
  if (!sheet) {
    throw new Error(`Sheet "${sheetName}" not found`)
  }
  const html = XLSX.utils.sheet_to_html(sheet)
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Excel Data</title></head><body>${html}</body></html>`
}

export async function convertCsvToHtml(csv: string): Promise<string> {
  const workbook = XLSX.read(csv, { type: "string" })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) {
    throw new Error("No sheets found in the CSV data")
  }
  const sheet = workbook.Sheets[sheetName]
  if (!sheet) {
    throw new Error(`Sheet "${sheetName}" not found`)
  }
  const html = XLSX.utils.sheet_to_html(sheet)
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>CSV Data</title></head><body>${html}</body></html>`
}

export async function convertJsonToCsvBuffer(json: string): Promise<Buffer> {
  const csv = await convertJsonToCsv(json)
  const workbook = XLSX.read(csv, { type: "string" })
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" })
  return Buffer.from(buffer)
}

export async function convertJsonToHtml(json: string): Promise<string> {
  const csv = await convertJsonToCsv(json)
  return convertCsvToHtml(csv)
}

export async function convertExcelToPdf(buffer: Buffer): Promise<Buffer> {
  const html = await convertExcelToHtml(buffer)

  const { default: JsPDF } = await import("jspdf")

  const doc = new JsPDF({ orientation: "landscape", unit: "pt", format: "a4" })

  await doc.html(html, {
    callback: (instance) => {
      void instance
    },
    x: 10,
    y: 10,
    width: doc.internal.pageSize.getWidth() - 20,
    windowWidth: 1200,
  })

  const arrayBuffer = doc.output("arraybuffer")
  return Buffer.from(arrayBuffer)
}