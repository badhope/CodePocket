#!/usr/bin/env node
/**
 * 端到端验证 - 测试文档转换引擎核心功能
 */
import { pathToFileURL } from "node:url";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

async function load(rel: string) {
  return import(pathToFileURL(path.join(root, rel)).href);
}

async function main() {
  console.log("=".repeat(60));
  console.log("DocForge 端到端验证");
  console.log("=".repeat(60));

  let pass = 0;
  const errors: string[] = [];

  // 1
  console.log("\n[1/6] 测试转换引擎模块加载...");
  try {
    const engine = await load("src/lib/convert/index.ts");
    for (const exp of [
      "convert",
      "detectFormat",
      "getOutputFilename",
      "isConversionSupported",
      "MIME_TYPES",
      "EXTENSIONS",
      "CONVERSION_MAP",
    ]) {
      if (engine[exp] === undefined) throw new Error(`Missing: ${exp}`);
    }
    console.log("  ✅ 模块导出完整");
    pass++;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log("  ❌", msg);
    errors.push(msg);
  }

  // 2
  console.log("\n[2/6] 测试格式检测...");
  try {
    const { detectFormat } = await load("src/lib/convert/index.ts");
    const cases: Array<[string, string]> = [
      ["report.docx", "docx"],
      ["data.xlsx", "xlsx"],
      ["presentation.pptx", "pptx"],
      ["notes.md", "md"],
      ["page.html", "html"],
      ["config.json", "json"],
      ["data.csv", "csv"],
      ["document.pdf", "pdf"],
      ["readme.txt", "txt"],
      ["feed.xml", "xml"],
    ];
    for (const [filename, expected] of cases) {
      const detected = detectFormat(filename);
      if (detected !== expected)
        throw new Error(`detectFormat(${filename}) -> ${detected}, expected ${expected}`);
    }
    console.log(`  ✅ ${cases.length} 个格式检测全部正确`);
    pass++;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log("  ❌", msg);
    errors.push(msg);
  }

  // 3
  console.log("\n[3/6] 测试转换支持矩阵...");
  try {
    const { isConversionSupported } = await load("src/lib/convert/index.ts");
    if (!isConversionSupported("docx", "pdf")) throw new Error("docx→pdf should be supported");
    if (!isConversionSupported("md", "html")) throw new Error("md→html should be supported");
    if (!isConversionSupported("xlsx", "csv")) throw new Error("xlsx→csv should be supported");
    if (!isConversionSupported("json", "csv")) throw new Error("json→csv should be supported");
    if (!isConversionSupported("html", "md")) throw new Error("html→md should be supported");
    console.log("  ✅ 转换支持矩阵正确");
    pass++;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log("  ❌", msg);
    errors.push(msg);
  }

  // 4
  console.log("\n[4/6] 测试 Markdown → HTML 转换...");
  try {
    const { convert } = await load("src/lib/convert/index.ts");
    const md = "# Hello\n\nThis is **bold** text.";
    const result = await convert(Buffer.from(md, "utf-8"), {
      inputFormat: "md",
      outputFormat: "html",
      filename: "test.md",
    });
    if (!result.success) throw new Error("Failed: " + result.error);
    if (!result.outputBuffer) throw new Error("No output");
    const html = Buffer.from(result.outputBuffer).toString("utf-8");
    if (!html.includes("<h1")) throw new Error("Missing <h1>");
    if (!html.includes("<strong>")) throw new Error("Missing <strong>");
    console.log(`  ✅ MD→HTML 成功 (${result.outputBuffer.length} bytes)`);
    pass++;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log("  ❌", msg);
    errors.push(msg);
  }

  // 5
  console.log("\n[5/6] 测试 HTML → Markdown 转换...");
  try {
    const { convert } = await load("src/lib/convert/index.ts");
    const html = "<h1>Title</h1><p>Para with <strong>bold</strong>.</p>";
    const result = await convert(Buffer.from(html, "utf-8"), {
      inputFormat: "html",
      outputFormat: "md",
      filename: "test.html",
    });
    if (!result.success) throw new Error("Failed: " + result.error);
    const md = Buffer.from(result.outputBuffer).toString("utf-8");
    if (!md.includes("# Title")) throw new Error("Missing # Title");
    if (!md.includes("**bold**")) throw new Error("Missing **bold**");
    console.log(`  ✅ HTML→MD 成功 (${md.length} chars)`);
    pass++;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log("  ❌", msg);
    errors.push(msg);
  }

  // 6
  console.log("\n[6/6] 测试 JSON ↔ CSV 循环转换...");
  try {
    const { convert } = await load("src/lib/convert/index.ts");
    const json = '[{"name":"Alice","age":30},{"name":"Bob","age":25}]';
    const toCsv = await convert(Buffer.from(json, "utf-8"), {
      inputFormat: "json",
      outputFormat: "csv",
      filename: "data.json",
    });
    if (!toCsv.success) throw new Error("JSON→CSV failed: " + toCsv.error);
    const csv = Buffer.from(toCsv.outputBuffer).toString("utf-8");
    if (!csv.includes("name")) throw new Error("CSV missing header");
    if (!csv.includes("Alice")) throw new Error("CSV missing data");

    const back = await convert(toCsv.outputBuffer, {
      inputFormat: "csv",
      outputFormat: "json",
      filename: "data.csv",
    });
    if (!back.success) throw new Error("CSV→JSON failed: " + back.error);
    const rt = JSON.parse(Buffer.from(back.outputBuffer).toString("utf-8"));
    if (!Array.isArray(rt) || rt.length !== 2) throw new Error("Round-trip failed");
    console.log(`  ✅ JSON→CSV→JSON 循环成功 (${rt.length} records)`);
    pass++;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log("  ❌", msg);
    errors.push(msg);
  }

  console.log("\n" + "=".repeat(60));
  console.log(`结果: ${pass}/6 通过`);
  console.log("=".repeat(60));
  if (errors.length > 0) {
    process.exit(1);
  } else {
    console.log("🎉 全部测试通过！");
  }
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
