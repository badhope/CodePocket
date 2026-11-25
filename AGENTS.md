# CodePocket Agent 规则

- 代码注释用中文，保持短句；不要写营销式注释。
- 新增依赖前先确认离线可用，禁止引入 Firebase / Sentry / Retrofit / Room / Hilt / WorkManager。
- 修改文件前先读；一次只改一个明确目标，不顺手重构无关代码。
- 每次改动必须能通过 `:app:testDebugUnitTest`；新增行为补 JVM 单测。
- 不提交密钥、keystore、构建产物；小迭代只增 `0.0.x` 最后一位，跨能力层才升到 `0.1.x`。
