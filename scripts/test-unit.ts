#!/usr/bin/env node
/**
 * 单元测试 - 覆盖转换引擎核心模块
 * 测试 sanitize / cache / formats / engine / markdown / streaming
 */
import { pathToFileURL } from "node:url"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, "..")

async function load(rel: string) {
  return import(pathToFileURL(path.join(root, rel)).href)
}

interface Test {
  name: string
  fn: () => void | Promise<void>
}

const tests: Test[] = []
function test(name: string, fn: () => void | Promise<void>) {
  tests.push({ name, fn })
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg)
}

function assertEq<T>(actual: T, expected: T, msg?: string) {
  if (actual !== expected) {
    throw new Error(msg ?? `Expected ${String(expected)} but got ${String(actual)}`)
  }
}

function assertThrows(fn: () => unknown, codeIncludes: string, msg?: string) {
  let err: unknown
  try { fn() } catch (e) { err = e }
  if (!err) throw new Error(msg ?? "expected function to throw")
  // The thrown object may be a ConversionError (with `.code`) or a generic
  // Error (with `.message`). Check both for a case-insensitive match.
  const code = (err as { code?: string }).code ?? ""
  const text = err instanceof Error ? err.message : String(err)
  if (!code.toLowerCase().includes(codeIncludes.toLowerCase()) &&
      !text.toLowerCase().includes(codeIncludes.toLowerCase())) {
    throw new Error(`expected error to include "${codeIncludes}", got code="${code}" message="${text}"`)
  }
}

// =============================
// 1. Cache
// =============================
test("cache: hit / miss / LRU eviction", async () => {
  const { ConversionCache } = await load("src/lib/convert/index.ts")
  ConversionCache.resetInstance()
  const cache = new ConversionCache(2)
  const buf = (s: string) => Buffer.from(s)
  const opts = (f: string) => ({ inputFormat: "md" as const, outputFormat: "html" as const, filename: f })

  // Miss then hit
  assert(cache.get(buf("a"), opts("a")) === null, "first get should miss")
  cache.set(buf("a"), opts("a"), { outputBuffer: buf("X"), mimeType: "text/html", outputFilename: "a.html", outputFormat: "html" })
  const hit = cache.get(buf("a"), opts("a"))
  assert(hit !== null, "second get should hit")
  assertEq(Buffer.from(hit!.outputBuffer).toString(), "X")
  assertEq(cache.stats.hits, 1)
  assertEq(cache.stats.misses, 1)

  // Fill to capacity, then push one more -> LRU evicts "a"
  cache.set(buf("b"), opts("b"), { outputBuffer: buf("Y"), mimeType: "text/html", outputFilename: "b.html", outputFormat: "html" })
  cache.set(buf("c"), opts("c"), { outputBuffer: buf("Z"), mimeType: "text/html", outputFilename: "c.html", outputFormat: "html" })
  assertEq(cache.stats.evictions, 1)
  assertEq(cache.stats.size, 2)
  assertEq(cache.stats.maxSize, 2)
  assert(cache.stats.memoryBytes > 0, "memory should be tracked")
})

test("cache: hitRate calculation", async () => {
  const { ConversionCache } = await load("src/lib/convert/index.ts")
  ConversionCache.resetInstance()
  const cache = new ConversionCache(10)
  const buf = Buffer.from("x")
  const opts = { inputFormat: "md" as const, outputFormat: "html" as const, filename: "x" }
  cache.set(buf, opts, { outputBuffer: Buffer.from("Y"), mimeType: "text/html", outputFilename: "x.html", outputFormat: "html" })
  cache.get(buf, opts)
  cache.get(buf, opts)
  cache.get(buf, opts)
  assertEq(cache.stats.hits, 3)
  assertEq(cache.stats.misses, 0)
  assertEq(cache.stats.hitRate, 1)
})

test("cache: clear resets all stats", async () => {
  const { ConversionCache } = await load("src/lib/convert/index.ts")
  const cache = new ConversionCache(2)
  cache.set(Buffer.from("a"), { inputFormat: "md", outputFormat: "html", filename: "a" }, { outputBuffer: Buffer.from("x"), mimeType: "text/html", outputFilename: "a.html", outputFormat: "html" })
  cache.get(Buffer.from("a"), { inputFormat: "md", outputFormat: "html", filename: "a" })
  assertEq(cache.stats.hits, 1)
  cache.clear()
  assertEq(cache.stats.hits, 0)
  assertEq(cache.stats.misses, 0)
  assertEq(cache.stats.size, 0)
  assertEq(cache.stats.memoryBytes, 0)
})

// =============================
// 2. Sanitize
// =============================
test("sanitize: strips script tags and inline handlers", async () => {
  const { sanitizeHtml } = await load("src/lib/convert/index.ts")
  const dirty = '<p>hi</p><script>alert(1)</script><img src=x onerror="x">'
  const clean = sanitizeHtml(dirty)
  assert(!clean.includes("<script"), "script removed")
  assert(!clean.includes("onerror"), "onerror removed")
  assert(clean.includes("<p>hi</p>"), "p kept")
})

test("sanitize: blocks javascript: and data: URLs", async () => {
  const { sanitizeHtml } = await load("src/lib/convert/index.ts")
  const dirty = '<a href="javascript:alert(1)">x</a><a href="data:text/html,bad">y</a>'
  const clean = sanitizeHtml(dirty)
  assert(!clean.toLowerCase().includes("javascript:"), "javascript: blocked")
  assert(!clean.toLowerCase().includes("data:"), "data: blocked")
})

test("sanitize: validateInputBuffer detects PDF magic and rejects garbage", async () => {
  const { validateInputBuffer, detectMimeFromBuffer } = await load("src/lib/convert/index.ts")
  const pdf = Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(100, 0)])
  const garbage = Buffer.from("not a real file")

  assertEq(detectMimeFromBuffer(pdf), "application/pdf")
  assertEq(detectMimeFromBuffer(garbage), "application/octet-stream")

  // Successful validation returns void (no throw)
  validateInputBuffer(pdf, "pdf")
  // Failed validation throws ConversionError with code MAGIC_NUMBER_MISMATCH
  assertThrows(() => validateInputBuffer(garbage, "pdf"), "magic_number_mismatch")
  // Plain text formats never throw
  validateInputBuffer(Buffer.from("hello world"), "txt")
  validateInputBuffer(Buffer.from("{}"), "json")
})

// =============================
// 3. Formats
// =============================
test("formats: validateFormatPair rejects unknown / unsupported", async () => {
  const { validateFormatPair, getAllSupportedConversions } = await load("src/lib/convert/index.ts")
  // Valid pair - no throw
  validateFormatPair("md", "html")
  // Unsupported pair - throws UNSUPPORTED_PAIR (md -> xlsx is not in the matrix)
  assertThrows(() => validateFormatPair("md", "xlsx"), "unsupported_pair")
  // Unknown input format
  assertThrows(() => validateFormatPair("unknown" as never, "html"), "unsupported_pair")
  const all = getAllSupportedConversions()
  assert(Array.isArray(all), "returns array")
  assert(all.length > 0, "at least one conversion")
})

test("formats: getFormatInfo returns complete metadata", async () => {
  const { getFormatInfo } = await load("src/lib/convert/index.ts")
  const info = getFormatInfo("md")
  assertEq(info.format, "md")
  assert(info.mimeType.length > 0, "mime set")
  assert(info.extension.length > 0, "ext set")
  assert(info.supportedOutputs.length > 0, "has outputs")
})

// =============================
// 4. Engine
// =============================
test("engine: rejects unsupported format pair", async () => {
  const { convert } = await load("src/lib/convert/index.ts")
  const result = await convert(Buffer.from("x"), {
    inputFormat: "pdf" as never,
    outputFormat: "docx" as never,
    filename: "x.pdf",
  })
  assertEq(result.success, false)
  assert(result.error !== undefined, "should have error")
})

test("engine: success path returns outputBuffer + metadata", async () => {
  const { convert } = await load("src/lib/convert/index.ts")
  const result = await convert(Buffer.from("# T"), {
    inputFormat: "md",
    outputFormat: "html",
    filename: "x.md",
  })
  assertEq(result.success, true)
  assert(result.outputBuffer !== undefined, "outputBuffer present")
  assert(result.outputFilename !== undefined, "outputFilename present")
  assert(result.mimeType !== undefined, "mimeType present")
  assertEq(result.mimeType, "text/html")
})

// =============================
// 5. Markdown
// =============================
test("markdown: md -> html preserves headings/links/code", async () => {
  const { convertMarkdownToHtmlSafe } = await load("src/lib/convert/index.ts")
  const html = await convertMarkdownToHtmlSafe("# H\n\n[link](https://a.com)\n\n`code`")
  assert(html.includes("<h1"), "h1")
  assert(html.includes('href="https://a.com"'), "link href")
  assert(html.includes("<code>"), "code tag")
  // Strips script
  const withScript = await convertMarkdownToHtmlSafe("text\n\n<script>bad()</script>")
  assert(!withScript.includes("<script"), "script stripped")
})

test("markdown: enforceSizeLimit throws on oversized input", async () => {
  const { enforceSizeLimit } = await load("src/lib/convert/index.ts")
  // small input passes
  enforceSizeLimit("ok", 100)
  // oversized input throws
  const large = "x".repeat(2000)
  assertThrows(() => enforceSizeLimit(large, 100), "input_too_large")
})

// =============================
// 6. Streaming
// =============================
test("streaming: BufferStream reads chunks correctly", async () => {
  const { BufferStream } = await load("src/lib/convert/index.ts")
  const buf = Buffer.from("hello world!")
  const stream = new BufferStream(buf)
  const chunks: Buffer[] = []
  for await (const c of stream) chunks.push(c as Buffer)
  assertEq(Buffer.concat(chunks).toString(), "hello world!")
  assertEq(stream.isEnded, true)
  assertEq(stream.bytesRead, buf.length)
})

test("streaming: chunkProcess respects concurrency and order", async () => {
  const { chunkProcess } = await load("src/lib/convert/index.ts")
  const items = [1, 2, 3, 4, 5]
  const results = await chunkProcess(items, async (n) => n * 2, { concurrency: 2 })
  assertEq(JSON.stringify(results), "[2,4,6,8,10]")
})

// =============================
// Run
// =============================
async function main() {
  console.log("=".repeat(60))
  console.log("DocForge 单元测试")
  console.log("=".repeat(60))

  let pass = 0
  const failed: Array<{ name: string; err: string }> = []

  for (const t of tests) {
    process.stdout.write(`  • ${t.name} ... `)
    try {
      await t.fn()
      console.log("✅")
      pass++
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      console.log("❌")
      console.log(`      ${msg}`)
      failed.push({ name: t.name, err: msg })
    }
  }

  console.log("=".repeat(60))
  console.log(`结果: ${pass}/${tests.length} 通过`)
  console.log("=".repeat(60))
  if (failed.length > 0) {
    console.log("\n失败用例:")
    for (const f of failed) console.log(`  - ${f.name}: ${f.err}`)
    process.exit(1)
  } else {
    console.log("🎉 全部通过！")
  }
}

main().catch((e) => {
  console.error("Fatal:", e)
  process.exit(1)
})
