# @docforge/shared

DocForge 的**框架无关业务核心**。本包不依赖任何框架（不依赖 React、Vue、uni-app、Node 内建模块），可被以下目标共用：

- H5（Vite + Vue 3）
- 微信 / 支付宝 / 抖音小程序
- Android / iOS App（uni-app x uts / JS）
- Next.js 后端（API routes、Node 脚本）

## 目录约定

```
src/
├── tools/        # 工具注册表 + 元数据 + 路由配置
├── validators/   # Zod schemas（请求/响应/表单）
├── execution/    # 代码执行抽象（Pyodide / Web Worker / Piston）
├── api-client/   # 类型化 fetch 客户端（与后端 OpenAPI 对齐）
├── system/       # feature-gate、feature-flags、离线检测
├── i18n/         # 文案 key 常量（locale 文件在各 app 内）
├── types/        # 跨包共享的 TS 类型
└── utils/        # 纯函数工具（格式化、编码、解码、校验等）
```

## 约束

1. **禁止**导入 `vue`、`react`、`next/*`、`uni-app` 任何 API
2. **禁止**使用 Node 内建模块（`fs`、`path`、`crypto` 也不行）
3. **允许**使用 Web 标准：`fetch`、`URL`、`crypto.subtle`、`TextEncoder`、`Worker`
4. **允许**使用纯 JS 库（marked、turndown、mammoth、js-yaml 等）
5. **允许**共享 6 种语言文案 key 常量（具体翻译在各 app 内）

## 引用方式

```ts
// 业务逻辑只 import 业务核心
import { toolRegistry, RunCodeSchema } from "@docforge/shared";
```
