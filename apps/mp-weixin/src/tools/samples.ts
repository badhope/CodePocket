/**
 * 30 个工具的示例输入。
 * 用 "---" 分隔的输入是 diff 类（json-diff / text-diff）。
 */

export const SAMPLES: Record<string, { input: string; options?: Record<string, unknown> }> = {
  "json-formatter": {
    input: '{"name":"DocForge","tools":30,"languages":19,"offline":true,"tags":["dev","utility"]}',
    options: { op: "format", indent: 2 },
  },
  "css-formatter": {
    input:
      ".btn{color:red;background:#fff;padding:8px 16px;border-radius:4px}.btn:hover{color:#fff;background:red}",
  },
  "html-formatter": {
    input: '<div class="card"><h2>Hello</h2><p>DocForge</p></div>',
  },
  "sql-formatter": {
    input:
      "SELECT u.id, u.name, COUNT(p.id) AS post_count FROM users u LEFT JOIN posts p ON p.author_id = u.id WHERE u.created_at > '2024-01-01' GROUP BY u.id ORDER BY post_count DESC LIMIT 10;",
  },
  "xml-formatter": {
    input:
      '<?xml version="1.0"?><root><item id="1"><name>A</name></item><item id="2"><name>B</name></item></root>',
  },
  "markdown-preview": {
    input:
      "# DocForge\n\nA **developer toolbox** with 30 tools.\n\n- JSON / CSS / HTML / SQL format\n- Base64 / URL / JWT codec\n- UUID / QR generate\n- Playground for 19 languages\n\n```js\nconsole.log('Hello, DocForge!');\n```",
  },
  "markdown-to-html": { input: "# Title\n\nSome **bold** text and `code`." },
  "html-to-markdown": {
    input: "<h1>Title</h1><p>Some <strong>bold</strong> text and <code>code</code>.</p>",
  },
  "document-convert": { input: "(上传 .docx / .pdf / .xlsx 后由后端转换；M1 离线端不支持)" },
  base64: { input: "Hello, DocForge! 你好，世界！", options: { op: "encode" } },
  "url-codec": { input: "https://example.com/path?query=你好世界&page=1", options: { op: "encode" } },
  "jwt-decoder": {
    input:
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NSIsIm5hbWUiOiJEb2NGb3JnZSIsImlhdCI6MTcwMDAwMDAwMCwiZXhwIjo5OTk5OTk5OTk5fQ.signature",
  },
  "uuid-generator": { input: "", options: { count: 8, kind: "uuid" } },
  "json-schema-validator": {
    input: '{"email":"a@b.com","password":"longenough"}',
    options: { schema: "signin" },
  },
  "regex-tester": {
    input: "DocForge v0.1.0 released in 2024-01. 30 tools, 19 languages, 6 locales. The future is now.",
    options: { pattern: "\\b(\\d+)(?=\\s+(?:tools?|languages?|locales?))", flags: "g" },
  },
  "qr-generator": { input: "https://docforge.dev" },
  playground: { input: 'print("Hello, DocForge!")' },
  "json-diff": {
    input:
      '{\n  "name": "DocForge",\n  "version": "0.1.0",\n  "tools": 20,\n  "offline": true\n}\n---\n{\n  "name": "DocForge",\n  "version": "0.2.0",\n  "tools": 30,\n  "offline": false,\n  "license": "MIT"\n}',
  },
  "text-diff": {
    input:
      "line one\nline two\nline three\nline four\n---\nline one\nline TWO\nline three\nline four\nline five",
  },
  "epoch-converter": { input: "1700000000" },
  // 新增 10 个工具
  "yaml-formatter": {
    input: "name: DocForge\ntools: 30\nlanguages:\n  - JavaScript\n  - Python\n  - TypeScript\noffline: true",
    options: { op: "format" },
  },
  "hash-generator": {
    input: "Hello, DocForge!",
    options: { algorithm: "SHA-256" },
  },
  "color-converter": {
    input: "#FF5733",
    options: { mode: "hex" },
  },
  "csv-json": {
    input: "name,age,city\nAlice,30,Beijing\nBob,25,Shanghai\nCharlie,35,Guangzhou",
    options: { op: "csvToJson" },
  },
  "text-utils": {
    input: "banana\napple\ncherry\napple\ndate\nbanana",
    options: { op: "sort" },
  },
  "cron-parser": {
    input: "0 9 * * 1-5",
  },
  "lorem-ipsum": {
    input: "",
    options: { count: 50 },
  },
  "number-base": {
    input: "255",
    options: { fromBase: 10, toBase: 16 },
  },
  jsonpath: {
    input: '{"store":{"book":[{"title":"JavaScript"},{"title":"Python"}]}}',
    options: { path: "$.store.book[*].title" },
  },
  validator: {
    input: "test@example.com",
    options: { type: "email" },
  },
};
