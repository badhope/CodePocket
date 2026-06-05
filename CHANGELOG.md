# 变更日志（Changelog）

DocForge 的所有重要变更都记录在此文件。格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
本项目遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

---

## [3.1.0] - 2026-06-05

### 简介
正式确立"**离线优先（offline-first）**"为产品的核心哲学。20 个工具、playground、编辑器、PWA
全部在浏览器中即可工作；后端仅解锁账户、协作和高保真 DOCX/PDF/XLSX 输出。
本版本同时完成"全面深修"——消除所有 TODO/CVE/死代码/不一致描述。

### 新增（Added）

- **`/tools` 与 20 个工具详情页** —— `/[locale]/tools` 列出全部 20 个离线工具，
  `/[locale]/tools/[slug]` 提供单工具页。所有工具都通过 feature gate 路由到本地浏览器执行器，
  不再依赖后端。
- **离线优先状态机**（`src/lib/system/backend-status.ts`）——
  `useSyncExternalStore` 快照 `/api/health`，五态：`unknown / checking / online / degraded / offline`。
- **Feature gate**（`src/lib/system/feature-gate.ts`）—— 把 `FeatureId` 显式映射到
  `"local"` 或 `"remote"`。`LOCAL_FEATURES` 仅保留真正可离线运行的项。
- **`BackendStatusOverview` / `BackendStatusBanner`** —— 在 `/` 与所有顶层页
  显示实时后端状态，状态从硬编码英文路径改用 `<Link href>`，本地化与多语言正确。
- **Collab 服务**（`infra/collab-server/server.mjs`）—— Yjs/Hocuspocus 自托管方案，
  支持可选 `COLLAB_REQUIRE_AUTH` / `COLLAB_SHARED_SECRET` / `COLLAB_MAX_DOCS` /
  `COLLAB_DOC_TTL_MS`。
- **本地 Piston shim**（`infra/piston-shim/server.mjs`）—— 14 个系统工具链
  复用为 Piston 兼容端点（`/api/v2/runtimes` 与 `/api/execute`），替代已停服公开
  Piston。
- **CHANGELOG.md**（本文件）。

### 修复（Fixed）

- **`convert` 页同步 `useMemo` 中调用 `require()` 抛 `SSR ReferenceError`** →
  改为缓存的动态 `import()` + `useEffect+useState`（带 cancelled 守卫）。
- **`client-tools.ts` 中 `htmlToMarkdown` 同步 `require()`** → 改为 async + 缓存的 `import()`。
- **过期依赖 CVE**（10 个 moderate）→ `pnpm.overrides` 强制升级
  `dompurify ≥ 3.3.2` / `uuid ≥ 11.1.1` / `postcss ≥ 8.5.10`，`pnpm audit` 清零。
- **`BackendStatusOverview` 硬编码 ``/en/tools`` 链接** → 改用
  `<Link href="/tools">`，多语言路由正确。
- **`BackendStatusOverview.LOCAL_FEATURES` 列举已删除的 dead features** → 收紧到 `["convert.local"]`。
- **7 个 dead `FeatureId`**（`collab.live`、`convert.docx/pdf/xlsx/pptx/image-ocr/batch-upload`）→
  从 `feature-gate.ts` 移除。
- **`backend-status.ts` 空 `useEffect` 与未导出的 `readBackendStatus`** → 删除。
- **`stores/editor.ts` 残留 `// @ts-nocheck`** → 移除，配合 `void SUPPORTED_LANGUAGES` 解决 lint 噪声。
- **`lib/ratelimit.ts` 4 对未使用的 `_init/_limit` 状态对** → 改写为 `cache + inFlight` Map。
- **`playground.tsx` 未使用的 `backendAvailable`** → 删除。
- **`backend-status-banner.tsx` 无用 `eslint-disable`** → 删除。
- **`static-demo.ts` 未使用的 React 导入** → 删除。
- **`client-tools.ts:353` 未使用的 `peek`** → 删除。
- **Settings 页 "Change password" 显示 "Coming soon" 按钮**（误导）→
  替换为说明性文本（密码修改需后端账户服务支持）。
- **`/offline` 页 503 提示与新架构脱节** → 复检，与 `useBackendStatus` 一致。

### 变更（Changed）

- **`package.json` version** `3.0.0` → `3.1.0`。
- **`package.json` description** —— 旧 "Universal document conversion platform - Web + WeChat
  Mini Program..." 替换为 "Offline-first developer toolbox — 20 browser tools ..."。
- **`package.json` keywords** —— 删除 `pwa/tailwindcss/wechat-miniprogram/taro`；
  新增 `offline-first/frontend-runner/pyodide/monaco-editor/sql.js/fengari/yjs/hocuspocus`。
- **`README.md`** 全面重写：突出 offline-first、20 tools、5 态机架构图；
  测试数从 "26 → 64 + 9 E2E" 修正为 "52 unit + 0 E2E（E2E 仅 scaffold）"；
  环境变量列表更新到与 `.env.example` 一致。
- **`.env.example`** 增补 `NEXT_PUBLIC_STATIC_DEMO` / `NEXT_PUBLIC_COLLAB_URL` /
  `COLLAB_PORT` / `COLLAB_REQUIRE_AUTH` / `COLLAB_SHARED_SECRET` /
  `COLLAB_MAX_DOCS` / `COLLAB_DOC_TTL_MS`。

### 移除（Removed）

- `package.json_backup`（stale 跟踪文件，163 行 diff）—— `git rm`。
- 7 个 dead `FeatureId`（见上）。
- `// @ts-nocheck` 注释、`eslint-disable` 抑制、4 对未用状态对（见上）。

### 验证（Verification）

| 检查         | 结果                              |
| ------------ | --------------------------------- |
| `pnpm typecheck` | 0 errors                       |
| `pnpm lint`      | 0 errors, 0 warnings           |
| `pnpm test`      | 52 / 52 unit tests pass        |
| `pnpm audit`     | 0 vulnerabilities              |
| i18n 校验        | 0 missing / extra keys         |
| `pnpm build`     | 成功（full stack）              |

---

## [3.0.0] - 2026-02-15

- 初始公开发布：以"文档转换 + 微信小程序"为主线，后端必选。
- Piston 通过公共 `emkc.org` 调用（2026-02-15 起仅白名单开放，迫使后续版本
  引入本地 shim 并最终推动 3.1.0 的离线优先重构）。
