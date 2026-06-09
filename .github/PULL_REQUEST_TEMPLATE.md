---
name: 通用 Pull Request
about: 任何代码改动
title: ""
labels: []
---

## 改了什么

<!-- 简要说明这个 PR 做了什么 -->

## 关联 Issue

<!-- 关联的 issue，例如 Fixes #123 -->

## 改动类型

- [ ] Bug 修复
- [ ] 新功能
- [ ] 重构（无功能变化）
- [ ] 文档
- [ ] 测试
- [ ] CI / 部署
- [ ] 安全修复

## 怎么测的

<!-- 描述你怎么验证这个改动是工作的 -->

## 检查清单

- [ ] `pnpm typecheck` 通过
- [ ] `pnpm lint` 通过
- [ ] `pnpm test` 通过（如果是新功能加了测试）
- [ ] 没引入新的依赖（或已在 `pnpm.overrides` 处理 CVE）
- [ ] 没破坏 offline-first（浏览器端核心功能依然可用）
- [ ] 国际化文案已加到所有 6 种语言
- [ ] CHANGELOG.md 已更新（如果是用户可见的改动）

## 截图

<!-- 如果是 UI 改动，附上 before/after 截图 -->
