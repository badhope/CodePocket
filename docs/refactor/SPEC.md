# DocForge 重构 — 规范 (SPEC)

> 跨平台前端重构项目。当前仓库 `badhope/OnlineCode` 保留为后端仓库；本规范描述从 **Next.js 16 + React 19** 到 **TypeScript + uni-app + Vue 3 + Vite** 的迁移目标与边界。

---

## 0. 一句话总结

把 DocForge 的前端**重写成一套跨 Web / 微信小程序 / Android / iOS 共用业务代码的 uni-app 应用**。后端（PostgreSQL + Redis + Drizzle ORM + Piston-shim + collab-server）**不动**；Next.js 仅作为后端 HTTP / WebSocket 服务保留运行，前端通过 fetch / WS 调用。

---

## 1. 背景与动机

| 现状                                                     | 痛点                                                 |
| -------------------------------------------------------- | ---------------------------------------------------- |
| Next.js 16 + React 19 单端实现                           | 国内访问速度差、备案麻烦、CDN 不友好                 |
| `miniprogram/` 用 Taro 单独写一份                        | 与主应用功能脱节，两套代码、两类 bug                 |
| 没有原生 App                                             | 移动端只能用 PWA；离线安装、iOS 推送、扫码分享弱     |
| 工具/转换逻辑散落在 `src/lib/tools` 与 `src/lib/convert` | 想给小程序也用，但 Next.js / React 专有 API 写得太死 |

**结论**：把"业务核心"（20 个工具、沙盒、转换逻辑、状态机、API 客户端）抽到与框架无关的 `packages/shared`，外壳（Web、小程序、App）交给 uni-app + Vue 3 + Vite 编译到目标端。

---

## 2. 选型

| 维度                | 方案                                                           | 理由                                                                      |
| ------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------- |
| 跨端框架            | **uni-app x（Vue 3 + Vite）**                                  | 国内生态最广；一套代码 → H5/微信/支付宝/抖音/百度小程序 + Android/iOS App |
| 视图层              | **Vue 3 `<script setup>` + TSX 可选**                          | 生态丰富，Composition API 性能优；TS 一等公民                             |
| 状态管理            | **Pinia**                                                      | Vue 官方推荐；类型友好；持久化插件成熟                                    |
| UI 库               | **uni-ui（官方）+ uView Plus 2.0**                             | 跨端一致性；按需引入；TypeScript 支持                                     |
| 构建                | **Vite 5**                                                     | dev 启动 < 1s；HMR 体验好；产物分端输出                                   |
| 包管理              | **pnpm workspace**                                             | 与现有 monorepo 一致；锁文件稳定                                          |
| 离线存储            | **uni.storage + IndexedDB（仅 H5）**                           | 跨端统一；`@/shared/storage` 抽象                                         |
| 代码执行（Pyodide） | **Web Worker（H5）/ Worker（小程序）**                         | 跨端一致；不阻塞 UI                                                       |
| 文档转换            | **纯 JS 库**（mammoth / pdf-lib / exceljs）+ 后端 fallback     | 与现有 `src/lib/convert` 一致                                             |
| 协作                | **Yjs + Hocuspocus Provider（WS）**                            | 与现有后端协议直接兼容                                                    |
| 鉴权                | **JWT in httpOnly cookie（H5）/ uni.setStorageSync（小程序）** | 跨端一致；后端无感                                                        |
| 国际化              | **vue-i18n 9** + 复用 `src/messages/*.json`                    | 已有 6 种语言，零翻译成本                                                 |
| 单元测试            | **Vitest**                                                     | 与现有项目一致；Vue 组件 @vue/test-utils                                  |
| E2E                 | **Playwright（H5）+ miniprogram-automator（小程序）**          | 官方推荐                                                                  |

**否决方案**：Dart + Flutter。原生体验与性能更优，但国内小程序适配需另写插件，长期维护成本高于收益。Web 端 Flutter 的 SEO、首屏体积、链接分享体验也不如 H5。

---

## 3. 目标平台与交付矩阵

| 平台                      | 包名               | 端类型              | 优先级 |
| ------------------------- | ------------------ | ------------------- | ------ |
| Web H5                    | `apps/h5`          | 浏览器              | **P0** |
| 微信小程序                | `apps/mp-weixin`   | 小程序              | **P0** |
| 支付宝小程序              | `apps/mp-alipay`   | 小程序              | P1     |
| 抖音小程序                | `apps/mp-douyin`   | 小程序              | P2     |
| Android App               | `apps/app-android` | 原生 (uts)          | P1     |
| iOS App                   | `apps/app-ios`     | 原生 (uts)          | P1     |
| 桌面端（macOS / Windows） | `apps/app-desktop` | Electron/Tauri 评估 | P3     |

---

## 4. 仓库结构（目标态）

```text
docforge/
├── apps/
│   ├── h5/                      # Web H5（Vite + Vue 3 + uni-app）
│   ├── mp-weixin/               # 微信小程序（uni-app 编译）
│   ├── mp-alipay/               # 支付宝小程序
│   ├── app-android/             # Android（uni-app x uts）
│   ├── app-ios/                 # iOS
│   └── admin/                   # 后台管理（H5，可选 M5 再做）
├── packages/
│   ├── shared/                  # 跨端业务核心（无 UI、无平台 API）
│   │   ├── tools/               # 20 个工具（移植 src/lib/tools）
│   │   ├── convert/             # 文档转换（移植 src/lib/convert）
│   │   ├── execution/           # Pyodide / Web Worker 入口
│   │   ├── system/              # 离线优先状态机 + feature gate
│   │   ├── api-client/          # 类型化 fetch 客户端
│   │   ├── i18n/                # vue-i18n 配置 + messages/*.json
│   │   ├── validators/          # Zod schema（与后端共享）
│   │   └── types/               # 全局 TS 类型
│   ├── ui/                      # 跨端 UI 组件（基于 uni-ui 封装）
│   └── storage/                 # 跨端存储抽象（uni.storage / IndexedDB）
├── backend/                     # 现有 Next.js 服务，仅保留 api/ + 必要的 page
│   ├── src/app/api/             # 路由处理器（不删）
│   └── src/lib/{auth,db,collab} # 数据库/鉴权/协作（不删）
├── infra/
│   ├── piston-shim/             # 不变
│   └── collab-server/           # 不变
├── docs/
│   └── refactor/
│       ├── SPEC.md              # 本文件
│       └── PLAN.md              # 详细计划
├── .github/workflows/           # 重新组织
├── pnpm-workspace.yaml
├── package.json
└── tsconfig.base.json
```

**关键原则**：

- `packages/shared` **不依赖** Vue / uni-app API；只依赖标准 JS / Web API（IndexedDB、Worker、crypto.subtle）。
- `apps/*` 通过 `@docforge/shared` 引用业务逻辑；UI 仅在壳层。
- 后端**保持仓库原样**继续运行；只是路由不再被 Next.js 的页面消费，仅作 JSON API。

---

## 5. 后端契约

后端 API 保持**完全兼容**：

| 类别      | 端点                                                                        | 备注                  |
| --------- | --------------------------------------------------------------------------- | --------------------- |
| 工具/转换 | `POST /api/convert`、`POST /api/execute`                                    | JSON over HTTPS       |
| 鉴权      | `POST /api/auth/sign-in`、`POST /api/auth/sign-up`、`GET /api/auth/session` | NextAuth v5           |
| 用户      | `GET/PATCH /api/account`、`GET /api/projects`、`GET /api/projects/:id`      |                       |
| 协作      | WebSocket `wss://.../collab`                                                | Hocuspocus 协议；现成 |
| 执行      | `POST http://127.0.0.1:2000/api/v2/execute`                                 | Piston-shim           |

**OpenAPI**：`backend/openapi.yaml` 由 zod-to-openapi 自动生成，前端 `@docforge/api-client` 用 `openapi-typescript` 生成类型，编译时与后端对齐。

---

## 6. 功能边界

### 6.1 必须保留（M1 必交付）

- 20 个浏览器端工具：格式化、转换、编解码、生成、解析
- 多语言代码沙盒（Pyodide、JS/TS、Lua、SQL；后端 14 种语言）
- 文档格式转换（DOCX/PDF/MD/HTML/XLSX/CSV/JSON/XML/PPTX）
- 离线优先状态机（`feature-gate`）
- i18n（保留 6 种语言 + 增量）
- PWA（H5 端）

### 6.2 后续阶段

- 账户系统 / 协作 / 高保真转换（M4）
- 小程序登录 / 分享 / 扫码（M2-M3）
- App 推送 / 后台运行 / 文件系统访问（M4-M5）
- 桌面端（P3 评估）

### 6.3 显式不做

- 跨端 UI 100% 像素级一致（按平台设计语言微调）
- 移动端完整 IDE（仅保留工具 + 沙盒 + 轻协作）
- App 端 OAuth 全部支持（先做微信、Apple Sign-in）

---

## 7. 非功能性要求

| 维度                 | 目标                                                     |
| -------------------- | -------------------------------------------------------- |
| 首屏（H5 4G）        | < 1.5s                                                   |
| 首屏（小程序）       | < 1.0s（首次）/ < 300ms（缓存）                          |
| 包体积（H5 gzipped） | 主包 < 300 KB；按需懒加载工具页                          |
| 包体积（小程序）     | 主包 < 1.5 MB（微信限制）                                |
| 离线可用             | 20 工具 + 4 沙盒语言 + 6 转换对                          |
| 多语言               | 6 种 → 8 种（新增 ar、ru）                               |
| A11y（H5）           | WCAG 2.1 AA；语义化标签、键盘可达                        |
| 安全                 | XSS（DOMPurify）、CSRF（双 token）、输入校验（Zod）、CSP |
| 审计                 | 0 high/critical CVE（与现状对齐）                        |

---

## 8. 兼容与迁移

**过渡期策略**（约 3-6 个月）：

1. **并行期**：旧 `badhope/OnlineCode` 仓库保留 Next.js 实现；新建 `badhope/docforge` 仓库按本规范实现。两边同时可访问，URL 互不干扰。
2. **切换期**：在主域 `docforge.app` 上线 uni-app H5；旧 `onlinecode.com` 保留 30% 流量灰度；老用户通过 `localStorage.migrated` 标记。
3. **下线期**：旧仓库 archive，README 指向新仓库；`next.config.ts` 改为只导出 API routes。

**数据兼容**：用户表、projects、snippets、conversions 全部不动；只需新前端不破坏 OAuth flow。

---

## 9. 风险与缓解

| 风险                                 | 概率 | 影响 | 缓解                                                         |
| ------------------------------------ | ---- | ---- | ------------------------------------------------------------ |
| uni-app x 编译 iOS 上 Pyodide 性能差 | 中   | 高   | iOS 端禁用 Pyodide，仅走 Piston-shim；展示"由服务端执行"     |
| 小程序主包超 1.5 MB                  | 高   | 高   | 工具按需分包；Pyodide / fengari / sql.js 走"运行时下载"      |
| Web 与小程序 API 不一致              | 高   | 中   | `@docforge/api-client` 暴露统一接口；端差异在 adapter 层处理 |
| 旧栈与新栈长期并存导致双倍维护       | 中   | 中   | 强制 D6 后旧栈只修不补；新栈每两周灰度 10%                   |
| 小程序审核被拒（功能 / 类目）        | 中   | 中   | 提前申请"工具/效率"类目；用户生成内容接 wx.contentCheck      |

---

## 10. 验收

- [ ] 20 工具在 H5 + 微信小程序 1:1 行为一致
- [ ] 沙盒 4 种语言在 H5 + 微信小程序可执行
- [ ] 9 种文档转换在 H5 + 微信小程序可执行
- [ ] 离线状态下 H5 + 微信小程序 100% 功能可用
- [ ] 后端契约零破坏（OpenAPI 校验通过）
- [ ] 性能 / 包体积 / 审计 / A11y 全部达标
- [ ] 旧栈 archive 前 90 天 0 回归

---

## 附录 A：与 Next.js 实现的对照

| Next.js（现状）                        | uni-app（目标）                               |
| -------------------------------------- | --------------------------------------------- |
| `src/app/[locale]/...`                 | `apps/h5/src/pages/...`                       |
| `src/lib/tools/client-tools.ts`        | `packages/shared/tools/index.ts`              |
| `src/lib/system/feature-gate.ts`       | `packages/shared/system/feature-gate.ts`      |
| `src/lib/convert/engine.ts`            | `packages/shared/convert/engine.ts`           |
| `src/lib/execution/frontend-runner.ts` | `packages/shared/execution/runner.ts`         |
| `src/lib/api/*`                        | `packages/shared/api-client/*`                |
| `src/messages/*.json`                  | `packages/shared/i18n/locales/*.json`（同源） |
| `src/components/ui/*`                  | `packages/ui/components/*`（重写为 Vue）      |
| `src/middleware.ts` / `src/proxy.ts`   | 各 app 内 `main.ts` 入口钩子                  |
| `next.config.ts`                       | `apps/h5/vite.config.ts` + `manifest.json`    |
| `src/lib/auth/*`                       | 后端不动；前端 `@docforge/api-client/auth.ts` |

## 附录 B：术语

- **壳 (shell)**：uni-app 编译产物；只做路由、平台适配、UI 装配
- **核 (core)**：`packages/shared`；纯 TS、与框架无关
- **跨端一致**：相同输入产生相同输出；UI 允许按平台设计语言微调
- **离线优先**：核心功能在断网时完全可用；后端只作增强
