/**
 * JSON Schema 校验 — 使用 zod schemas（已通过 zod-to-json-schema 派生）。
 * 框架无关：在 H5 / App / 后端都能用。
 *
 * 注意：这里仅做轻量校验（对象必填字段、类型、enum），不做完整 JSON Schema 验证。
 * 完整 schema 校验将在 M2 接入 ajv 库。
 */

import { z } from "zod";

export interface SchemaCheckResult {
  ok: boolean;
  errors: { path: string; message: string }[];
  data: unknown;
}

export function checkJsonBasic(input: string, schema: z.ZodType<unknown>): SchemaCheckResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch (e) {
    return {
      ok: false,
      errors: [{ path: "$", message: (e as Error).message }],
      data: null,
    };
  }
  const r = schema.safeParse(parsed);
  if (r.success) {
    return { ok: true, errors: [], data: r.data };
  }
  return {
    ok: false,
    errors: r.error.issues.map((i) => ({
      path: i.path.join(".") || "$",
      message: i.message,
    })),
    data: parsed,
  };
}
