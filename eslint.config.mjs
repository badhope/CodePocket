import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // The codebase uses `@ts-nocheck` as a deliberate escape hatch on files
    // with complex third-party types (Yjs, Monaco, Piston) where the upstream
    // typings are incomplete. We silence the rule so the dev signal stays
    // focused on real issues.
    rules: {
      "@typescript-eslint/ban-ts-comment": [
        "error",
        {
          "ts-nocheck": "allow-with-description",
          "ts-expect-error": "allow-with-description",
          "ts-ignore": true,
          "ts-check": false,
        },
      ],
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "drizzle/**",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    "miniprogram/**",
    "fix-pkg.js", // one-off migration script, not part of the app source
    "scripts/**", // ad-hoc dev scripts (db-migrate, db-meta, dev.sh)
  ]),
]);

export default eslintConfig;
