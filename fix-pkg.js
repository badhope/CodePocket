const fs = require("fs")
const path = require("path")

const pkg = {
  name: "docforge",
  version: "3.0.0",
  private: true,
  description: "Universal document conversion platform - Web + WeChat Mini Program.",
  homepage: "https://github.com/badhope/DocForge#readme",
  repository: { type: "git", url: "https://github.com/badhope/DocForge.git" },
  license: "MIT",
  author: "DocForge Contributors",
  keywords: ["document-converter", "file-converter", "docx-to-pdf"],
  scripts: {
    dev: "next dev",
    build: "next build",
    start: "next start",
    lint: "eslint",
    "lint:fix": "eslint --fix",
    typecheck: "tsc --noEmit",
    test: "vitest run",
    prepare: "husky",
    postinstall: "pnpm approve-builds || true",
  },
  dependencies: {
    jspdf: "^2.5.2",
    mammoth: "^1.8.0",
    marked: "^15.0.0",
    "pdf-lib": "^1.17.1",
    "pdfjs-dist": "^4.10.38",
    turndown: "^7.2.0",
    xlsx: "^0.18.5",
  },
  devDependencies: {
    typescript: "^5",
  },
}

fs.writeFileSync(path.join(__dirname, "package.json"), JSON.stringify(pkg, null, 2), "utf8")
console.log("package.json written successfully")