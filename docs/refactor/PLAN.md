# DocForge 重构 — 详细计划 (PLAN)

> 配套 `SPEC.md` 的阶段化实施计划。从单端 Next.js 演进到跨端 uni-app monorepo。

---

## 阶段总览

| 阶段   | 名称              | 目标                           | 状态         |
| ------ | ----------------- | ------------------------------ | ------------ |
| **M0** | 基础设施          | monorepo / CI / 共享包骨架     | **立即开始** |
| **M1** | H5 核心 20 工具   | Web H5 端工具 1:1 复刻         |              |
| **M2** | H5 沙盒 + 转换    | Web 端沙盒 + 文档转换打通      |              |
| **M3** | 微信小程序        | 微信端核心功能对齐 H5          |              |
| **M4** | 账户 / 协作 / PWA | 用户系统 + Yjs 协作 + 离线强化 |              |
| **M5** | App 化            | Android / iOS 端               |              |
| **M6** | 其它小程序        | 支付宝 / 抖音                  |              |
| **M7** | 灰度切换          | 域名灰度 + 旧栈 archive        |              |

> **节奏**：每阶段交付后用 1-2 个迭代做"线上验证 + 旧栈回归"，再开下一阶段。

---

## M0 — 基础设施

### 目标

建立 monorepo 骨架，让"壳"和"核"可以并行开发，CI 能对每个包独立校验。

### 任务

1. **仓库拆分**
   - [ ] 现有 `badhope/OnlineCode` 仓库保留为 `backend`（含 `src/lib/{auth,db,collab}` 与 `src/app/api/*`）
   - [ ] 新建 `badhope/DocForge` 仓库（apps/_ + packages/_ + infra/）
   - [ ] 在旧仓库 README 顶部加迁移横幅
2. **包管理**
   - [ ] `pnpm-workspace.yaml`：`apps/*`、`packages/*`、`infra/*`
   - [ ] `tsconfig.base.json`：strict、ES2022、paths
   - [ ] `package.json` 顶层：`engines.pnpm=10`、`engines.node=22`
3. **共享包骨架**
   - [ ] `packages/shared` 初始化；目录：`tools/ convert/ execution/ system/ api-client/ i18n/ validators/ types/`
   - [ ] `packages/ui` 初始化；目录：`components/ composables/ styles/`
   - [ ] `packages/storage` 初始化；`storage/adapters/{h5,mp,app}.ts`
4. **CI**
   - [ ] `.github/workflows/ci.yml`：matrix = `[shared, ui, h5, mp-weixin, backend]`；每个 job `pnpm -F <pkg> lint typecheck test build`
   - [ ] `gitleaks`、`labeler`、`dependabot` 复用旧配置
   - [ ] 新增 `E2E` job：仅当 H5 build 成功时跑 Playwright
5. **文档**
   - [ ] 新仓库 `README.md` 写清 monorepo 结构
   - [ ] `CONTRIBUTING.md` 强调："在 `packages/shared` 写业务，在 `apps/*` 写壳"

### 验收

- `pnpm -r lint typecheck test` 全绿
- `pnpm --filter @docforge/h5 build` 产出 H5 静态包（即使是空壳）
- 旧仓库 CI 不受新仓库影响

### 风险

- 旧仓库的 `src/lib/tools`、`src/lib/convert` 与新 `packages/shared/{tools,convert}` 短期并存
- 解决：M0 末做一次 `git mv` 把"框架无关"代码搬到新仓库；旧仓库仅留框架相关引用

---

## M1 — H5 核心 20 工具

### 目标

Web H5 端 20 个工具 1:1 复刻；功能 100% 等价于旧 Next.js。

### 任务

1. **壳工程**
   - [ ] `apps/h5` 用 uni-app Vue 3 模板初始化
   - [ ] 路由：`pages/index` `pages/tools/[id]` `pages/about` `pages/settings`
   - [ ] 主题：暗色 / 亮色 / 跟随系统；CSS 变量
2. **工具移植**（20 个，每个 ~0.5-1 人天）
   - [ ] JSON 格式化（beautify / minify / escape）
   - [ ] JSON ↔ YAML、TOML、CSV、TSV
   - [ ] CSS 格式化 / 压缩 / 校验
   - [ ] SQL 格式化 / 压缩（多方言）
   - [ ] HTML 格式化 / 压缩
   - [ ] Markdown ↔ HTML
   - [ ] Base64 编码 / 解码
   - [ ] URL 编码 / 解码
   - [ ] SHA-1 / SHA-256 / SHA-512
   - [ ] HMAC
   - [ ] JWT 解析 / 签名（HS256/RS256）
   - [ ] UUID v1/v4/v7 生成
   - [ ] 颜色 HEX/RGB/HSL/CMYK 互转
   - [ ] 进制转换（2-36）
   - [ ] Lorem Ipsum 生成
   - [ ] QR Code 生成
   - [ ] Cron 解析 + 下次执行时间
   - [ ] 正则测试 + 替换
   - [ ] Diff（行 / 词 / 字符）
3. **i18n**
   - [ ] 复用 `src/messages/*.json`（6 种语言）
   - [ ] `packages/shared/i18n` 用 vue-i18n
4. **离线存储**
   - [ ] 历史记录：`storage.set('history', ...)`
   - [ ] 收藏夹：`storage.set('favorites', ...)`
5. **PWA**
   - [ ] `manifest.webmanifest` + Service Worker（vite-plugin-pwa）
   - [ ] 离线 fallback 页

### 验收

- 20 工具在 H5 端功能 100% 等价（旧仓库跑过 52 个单测，新仓库用相同 fixture 跑通）
- Lighthouse：Performance > 90、Accessibility > 95、PWA 通过
- 包体积：主包 < 300 KB gzipped

### 风险

- Vue 3 响应式系统与 React 思维差异
- 解决：M1 内强制 codereview；坑点入 `docs/refactor/learnings.md`

---

## M2 — H5 沙盒 + 文档转换

> 目标：H5 端 Playground 真跑（19 种语言）；DocumentConvert 真转换（9 种格式对）。
> 沙盒优先走后端 Piston，离线时降级 Pyodide / Web Worker。

### M2.1 Code Sandbox（沙盒协议已就绪，M2 落地 wiring）

- [ ] `packages/shared/execution/backends/piston.ts` — Piston API 适配
- [ ] `packages/shared/execution/backends/pyodide.ts` — Pyodide 客户端适配（懒加载）
- [ ] `packages/shared/execution/backends/worker.ts` — Web Worker JS 沙盒
- [ ] `apps/h5/src/sandbox/` — 沙盒目录（worker proxy、Pyodide loader）
- [ ] `apps/h5/src/pages/PlaygroundPage.vue` 接入真执行：
  - 默认走 Piston → 失败/离线降级到 Pyodide → 最后回 Worker
  - stdout / stderr 实时流（chunk by chunk）
  - 取消按钮（AbortController）
- [ ] 沙盒测试：
  - Piston mock → 6 语言跑通
  - Worker → JS / TS / Lua / SQL 跑通
  - Pyodide → Python "hello" + 简单循环

### M2.2 文档转换（9 种格式对）

- [x] `packages/shared/convert/` 框架无关协议：
  - `formats.ts` — 11 对（9 本地 + 2 backend-only），FORMAT_MIME、findPair、listSupportedPairs
  - `converters.ts` — 9 个纯函数（mdToHtml / htmlToMd / mdToTxt / txtToMd / htmlToJson / jsonToHtml / jsonToXml / xmlToJson / htmlToPdf）
  - `engine.ts` — convert() 调度器 + BackendConverter 接口 + ProgressFn 回调
  - `index.ts` — 公共 re-export
- [x] 纯 JS 库适配：
  - `marked`（MD → HTML，已有）
  - `turndown`（HTML → MD，已有）
  - `fast-xml-parser`（XML ↔ JSON，新增）
  - `pdf-lib`（HTML → PDF，新增）
- [x] 后端 fallback：DOCX / XLSX 走 `BackendConverter` 接口（M2.2 占位实现）
- [x] `apps/h5/src/pages/DocumentConvertPage.vue` 真转换：
  - 文件拖放 + 自动推断 source format
  - 目标格式选择（按 source 过滤 available targets）
  - 进度条 + stage 文本（starting → converting → done）
  - 文本结果预览（前 4000 字符）+ 二进制字节数
  - 下载按钮（保留原文件名 + 新扩展名）
- [x] 文档转换测试：`packages/shared/test/convert.test.ts` 20 测试（每格式对 1-2 案例 + engine 调度 + backend fallback）
- [x] Vite manualChunks：`vendor-pdf` 429KB（按需懒加载）+ `vendor-xml` 36KB

### M2.3 Streaming & 进度

- [x] `packages/shared/src/execution/abort.ts` — 取消工具集
  - `AbortError`（带 `override readonly name = "AbortError"`）
  - `throwIfAborted(signal)` — 长循环主动检查
  - `withAbort(source, signal)` — 异步迭代器绑 signal
  - `linkAbort(parent, child)` — 级联取消
  - `delay(ms, signal)` — 可中断延时
- [x] `PistonBackend.stream()` 增强：fetch 错误 + body 空 + 循环中检查 signal，abort 转 error event + 回退 execute
- [x] `PyodideBackend.stream()` 增强：throwIfAborted（3 个时点）+ abort 后 yield `aborted` error + `execute()` 抛 AbortError
- [x] `WorkerBackend.execute()` 增强：pre-aborted 抛 AbortError；stream 中的 `aborted` code 透传
- [x] `convert()` 加 `signal?: AbortSignal`：pre-aborted 转 `{ ok: false, aborted: true }`；PDF 渲染周期性检查
- [x] `BackendConverter` 接口加 signal 参数
- [x] `useCancelable()` composable — 维护 AbortController + `run(fn)` 包装 + onUnmount 自动 cancel
- [x] `PlaygroundPage` 改造：useCancelable + 取消按钮 + 阶段文本（selecting → starting → running → done/cancelled）
- [x] `DocumentConvertPage` 改造：useCancelable + 取消按钮 + AbortError 提示
- [x] `common.cancel` × 6 语言 i18n
- [x] M2.3 测试 11 个：abort utils（5）+ Piston abort（1）+ Pyodide abort（1）+ Worker abort（1）+ convert abort（3）

### M2.4 缓存层

- [x] 工具结果缓存：tool-result 键 + 输入哈希，TTL 1h，存储在 `@docforge/storage`
- [x] LRU 限 100 条

#### M2.4 落地产物

- `packages/shared/src/cache/{hash,lru,result-cache,index}.ts`（~290 行）
  - `hash.ts`：Web Crypto SHA-256 优先，FNV-1a 兜底
  - `lru.ts`：泛型 LRU + TTL，stats: { hits, misses, evictions, expirations }
  - `result-cache.ts`：`createResultCache` + `memoRun`（错误不入缓存 + L2 回填 + ns 隔离）
- `packages/shared/test/cache.test.ts` 15 测试
- `apps/h5/src/composables/useResultCache.ts`：单例 L1(LRU) + L2(localStorage via h5Adapter)
- 4 工具页集成（`memo(slug, input, fn, { options })`）：
  - `ToolRunnerPage.vue`（json/css/html/sql/md/base64/url/sha/jwt/uuid/color/base/lorem/cron/diff 等 16 个通用工具）
  - `QrPage.vue`（qr-generator，options = { ec, size }）
  - `RegexPage.vue`（regex-tester，options = { pattern, flags }）
  - `MarkdownPreviewPage.vue`（markdown-preview，无 options）
- 总测试数 110（shared 105 + storage 4 + h5 1）
- `useResultCache` 拆独立 chunk 17.82 kB（gzip 7.54 kB）

### M2.5 验证

- [ ] `pnpm typecheck:all / test:all / build:h5 / lint:all` 全部通过
- [ ] 浏览器手测：Playground 跑 6 种语言 + 转换 3 种格式对
- [ ] 离线模式：禁用后端后，Pyodide + Worker 仍可跑

## M3 — 微信小程序 (mp-weixin)

### 目标

H5 端打通代码沙盒与文档转换，行为对齐旧栈。

### 任务

1. **代码沙盒**
   - [ ] Python：Pyodide 0.26+（Web Worker，懒加载）
   - [ ] JS / TS：原生 Web Worker + `tsc` 转译
   - [ ] Lua：fengari
   - [ ] SQL：sql.js
   - [ ] 14 种后端语言：调用 Piston-shim `POST /api/v2/execute`
2. **文档转换**
   - [ ] DOCX → MD / HTML：mammoth
   - [ ] MD → DOCX：docx
   - [ ] PDF → MD / TXT：pdfjs-dist（动态 import）
   - [ ] MD / HTML → PDF：pdf-lib
   - [ ] XLSX → JSON / CSV：exceljs
   - [ ] JSON / CSV → XLSX：exceljs
   - [ ] XML ↔ JSON：fast-xml-parser
   - [ ] PPTX → MD：zip + XML 解析
3. **流式输出**
   - [ ] 大文件分块：IndexedDB 中转 + 进度回调
   - [ ] 取消 / 断点续传
4. **共享缓存**
   - [ ] `convert` 结果 LRU 缓存（按内容哈希）
5. **降级策略**
   - [ ] H5 端库失败 → 调后端 `/api/convert`；保留旧栈 100% 兼容

### 验收

- 9 种格式双向转换在 H5 通过（与旧栈同 fixture）
- 沙盒 4 种语言在 H5 可执行；14 种通过 Piston-shim 可执行
- 50MB 文件不卡死（流式 + Worker）

### 风险

- Pyodide 主包 6 MB，H5 包体积爆
- 解决：CDN 懒加载 + Service Worker 缓存；主包不内嵌
- pdfjs-dist 在 Web Worker 中全局 API 缺失
- 解决：用 `GlobalWorkerOptions.workerSrc` 显式指定 worker 路径

---

## M3 — 微信小程序 (mp-weixin)

### 目标

微信小程序端核心 20 工具 + 沙盒 + 转换对齐 H5。

### M3 起步验证（已完成，2026-06-11）

`apps/mp-weixin` 壳工程已建，uni-app x + Vue 3 + Vite 编译链打通，业务核心 0 重复复用。

**关键产物**：
- `apps/mp-weixin/{package.json, vite.config.ts, tsconfig.json, eslint.config.mjs, index.html}`
- `apps/mp-weixin/src/{App.vue, main.ts, manifest.json, pages.json, shims.d.ts}`
- `apps/mp-weixin/src/pages/index/index.vue`（冒烟页，调 `listTools()` + `mpAdapter`）

**依赖选型**（关键经验）：
- `@dcloudio/*` 用 `vue3` dist-tag → 3.0.0-alpha-5010320260611001（2026-06-11）
  - 注意：latest tag 拉到的 vite-plugin-uni 仍是 2021 年 alpha 不可用
  - vue3 tag 是 DCloud 官方维护的 Vue 3 + Vite 5 兼容线
- `vue` 锁 3.4.21（uni-app x 兼容线）
- `pdf-lib` 链上的 `tslib` / `pako` / `strnum` 在 shared 包统一 external
- `build.target: "esnext"` 绕过 esbuild chrome87 限制
- `vue-i18n` 不需要用（shared 自带 `tFor`），避免 @intlify 包版本不一致
- `index.html` 模板必须放在 apps/mp-weixin 根目录，vite-plugin-uni 会注入主入口

**双端 build 验证通过**：
| 端 | 命令 | 产物 | 大小 |
|---|---|---|---|
| H5 | `pnpm build:h5` | `dist/build/h5/{index.html, assets/*}` | 336K |
| 微信 | `pnpm build:mp-weixin` | `dist/build/mp-weixin/{app.js, app.json, app.wxss, pages/index/*}` | 296K |

**全局验证**：
- `pnpm typecheck:all` ✅ 5/5 包
- `pnpm lint:all` ✅ 5/5 包
- `pnpm test:all` ✅ 110 测试（shared 105 + storage 4 + h5 1）

**未做**（后续 M3 主线）：
- 20 工具页迁移到 `apps/mp-weixin/src/pages/tools/*`（用 uni-app `<view>` 写）
- vue-router 改 `uni.navigateTo` 包装
- `v-html` 改 `<rich-text>`（H5 端保留 v-html）
- 微信 API 适配：`wx.login` `wx.scanCode` `wx.share` `wx.openDocument`
- Pyodide 跳过（按 PLAN，H5 端可用）
- 沙盒 JS 走小程序 `Worker`
- 文档转换：PDF 走后端 fallback，DOCX/XLSX/PPTX 用 mammoth/exceljs/jszip
- 包体积治理：subPackages 分包，主包 < 1.5MB
- 微信开发者工具真机验证

### 任务

1. **壳工程** ✅
   - [x] `apps/mp-weixin` uni-app 模板
   - [x] `manifest.json`：`mp-weixin.appid`、`miniprogramRoot`
   - [ ] 微信登录：`uni.login` + 后端 `/api/auth/wechat`
2. **工具移植**
   - [ ] 20 工具复用 `packages/shared/tools`（纯 JS 无 Vue 依赖）
   - [ ] 仅替换 UI 层为小程序组件（`<view>` / `<text>` 替代 `<div>` / `<span>`）
3. **沙盒**
   - [ ] Pyodide：跳过（H5 端可用；小程序走"运行在 H5" 模式）
   - [ ] JS：`<script type="text/javascript">` 在新页面运行
   - [ ] Piston-shim：小程序需在 `request` 合法域名白名单加 Piston
4. **转换**
   - [ ] PDF 解析：小程序无 DOMMatrix；改用 `pdfjs-dist` 的"仅 ESM Worker"分支
   - [ ] XLSX：exceljs
   - [ ] DOCX：mammoth（已 ESM）
5. **小程序特性**
   - [ ] `wx.scanCode` 进 JSON 解析工具
   - [ ] `wx.share` 分享结果
   - [ ] `wx.openDocument` 预览转换结果
6. **包体积治理**
   - [ ] 工具按需分包：`subPackages: [{ root: 'pages/tools', pages: [...] }]`
   - [ ] 主包 < 1.5 MB

### 验收

- 20 工具在微信开发者工具中功能对齐 H5
- 沙盒 JS 可执行；后端 14 语言经 Piston-shim 可执行
- 微信审核通过（"工具/效率"类目）

### 风险

- 微信 `web-view` 不允许内嵌 Pyodide（高风险 H5 跳转）
- 解决：M3 不做"小程序内 Python"，统一引导去 H5
- 小程序审核被拒
- 解决：先做"无需登录"版本上线，类目用"工具-效率"

---

## M4 — 账户 / 协作 / PWA

### 目标

H5 + 小程序接入用户系统、Yjs 协作；PWA 强化。

### 任务

1. **鉴权**
   - [ ] H5：NextAuth v5 OAuth（GitHub / Google） + httpOnly cookie
   - [ ] 小程序：wx.login → 后端 `POST /api/auth/wechat`
   - [ ] JWT 统一签发（短期 access + 长期 refresh）
2. **用户系统**
   - [ ] 个人主页
   - [ ] 项目（projects）
   - [ ] 片段（snippets）
   - [ ] 转换历史（conversions）
3. **协作**
   - [ ] Yjs Provider（H5 用 `y-websocket`，小程序用自实现 WebSocket 适配）
   - [ ] 共享项目分享
   - [ ] 光标 / 选区显示
4. **PWA 强化**
   - [ ] 推送通知（VAPID）
   - [ ] 后台同步（Background Sync API）
   - [ ] 安装提示
5. **后端**
   - [ ] 新增 `POST /api/auth/wechat`（小程序登录）
   - [ ] 新增 `GET /api/projects/:id/share`（分享 token）

### 验收

- H5 登录、创建项目、协作编辑、刷新可恢复
- 小程序登录、查看项目、只读浏览
- PWA 安装后断网可用所有核心功能

---

## M5 — App 化

### 目标

Android / iOS 原生 App 端。

### 任务

1. **壳工程**
   - [ ] `apps/app-android` `apps/app-ios` 用 uni-app x 模板
   - [ ] uts 写平台桥接（扫码、推送、文件系统）
2. **核心功能**
   - [ ] 20 工具（复用 shared）
   - [ ] 沙盒（Pyodide 走 H5 内嵌 WebView；JS/Lua/SQL 在原生 Worker）
   - [ ] 转换（前端处理；大文件走后端）
3. **平台特性**
   - [ ] Android：`uni.share` `uni.scanCode` `uni.push`
   - [ ] iOS：`Sign in with Apple`
   - [ ] 推送：uni-push
4. **分发**
   - [ ] Android：Google Play + 国内商店（华为/小米/OPPO/vivo）
   - [ ] iOS：App Store + TestFlight

### 验收

- Android / iOS 真机通过 20 工具 + 沙盒 JS + 转换冒烟
- App 包体积 < 30 MB（Android）/ < 25 MB（iOS）

### 风险

- iOS Pyodide 启动 3-5s；首屏体验差
- 解决：iOS 端 Pyodide 走"按需下载 + 缓存"；首屏不放沙盒入口

---

## M6 — 其它小程序

### 目标

支付宝 / 抖音 / 百度小程序。

### 任务

1. 复用 `apps/mp-weixin` 模板
2. 替换鉴权为各平台 `login`
3. 跑通核心 20 工具 + 沙盒 JS + 转换
4. 提交审核

### 验收

- 各平台核心 20 工具可用
- 平台审核通过

---

## M7 — 灰度切换 + 旧栈 archive

### 目标

把主域 `docforge.app` 从 Next.js 切到 uni-app H5；旧仓库 archive。

### 任务

1. **灰度**
   - [ ] 旧 `onlinecode.com` 流量按 1% → 10% → 50% → 100% 切到新 H5
   - [ ] 关键路径埋点：tool-success / tool-error / p95
2. **数据**
   - [ ] 旧栈 users / projects / snippets 全量 ETL 到新后端（同库，仅表结构对齐）
3. **下线**
   - [ ] 旧仓库 README 顶部加 archived 横幅
   - [ ] 旧仓库 `next.config.ts` 改为只导出 API routes
   - [ ] 旧仓库 `package.json` `description` 标注 "MIGRATED TO badhope/DocForge"
   - [ ] GitHub 仓库设 `archived=true`
4. **域名**
   - [ ] `onlinecode.com` 301 → `docforge.app`
   - [ ] `onlinecode.com/api/*` 保留 6 个月（兼容旧 SDK）

### 验收

- 30 天内旧栈 0 故障（仅 API 路由）
- 新栈 0 P0 回归
- 旧仓库 archive 完成，README 指引到新仓库

---

## 持续工作（贯穿 M0-M7）

- **依赖升级**：每周 `pnpm update --latest`；每两周 review
- **CVE 监控**：Dependabot + `pnpm audit` CI gate
- **文档同步**：每次发版更新 `CHANGELOG.md` + `docs/refactor/learnings.md`
- **性能预算**：H5 主包 300KB、小程序 1.5MB、App 30MB；超阈值 CI 失败
- **A11y 巡检**：每阶段 axe-core 自动化扫描
- **i18n 校验**：`packages/shared/i18n` 用 `i18n-unused` + `i18n-ally` 双校验

---

## 角色与协作

| 角色       | 主要阶段   | 关键产出                            |
| ---------- | ---------- | ----------------------------------- |
| 架构师     | M0、M5     | monorepo 设计、跨端抽象、App 端桥接 |
| Web 高级   | M1、M2     | H5 工具、沙盒、转换                 |
| 小程序高级 | M3、M6     | 微信 / 支付宝 / 抖音                |
| 后端       | M0、M4、M7 | API、鉴权、协作、ETL                |
| DevOps     | M0、M7     | CI、灰度、回滚                      |
| QA         | 贯穿       | 自动化测试、回归、性能、A11y        |
| 设计师     | M1 起      | 跨端设计系统、平台微调规范          |

---

## 退出标准（项目完成）

- [ ] 20 工具在 H5 + 微信 + Android + iOS 端 1:1 一致
- [ ] 沙盒 4 种语言在 H5 + 小程序 + App 可执行
- [ ] 9 种文档转换在所有端可执行
- [ ] 离线状态下所有端核心功能可用
- [ ] 后端契约零破坏
- [ ] 性能 / 包体积 / 审计 / A11y 全部达标
- [ ] 旧栈 archive 完成，新栈 0 P0 故障运行 30 天
- [ ] 旧仓库 README 迁移横幅到位
- [ ] 文档齐全：`SPEC.md` `PLAN.md` `learnings.md` `runbook.md`
