import type { Config } from "drizzle-kit";

export default {
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.SQLITE_DB_PATH ?? "./data/docforge.db",
  },
  casing: "snake_case",
  strict: true,
  verbose: true,
} satisfies Config;
