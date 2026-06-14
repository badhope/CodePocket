import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "./schema";
import path from "path";
import fs from "fs";

const globalForDb = globalThis as unknown as {
  dbInstance: ReturnType<typeof drizzle<typeof schema>> | undefined;
};

function resolveDbPath(): string {
  const dbPath = process.env.SQLITE_DB_PATH ?? path.join(process.cwd(), "data", "docforge.db");
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dbPath;
}

function createDb() {
  const dbPath = resolveDbPath();
  const sqlite = new Database(dbPath);
  
  // Enable WAL mode for better concurrency
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("synchronous = NORMAL");
  
  return drizzle(sqlite, { schema, casing: "snake_case" });
}

const dbInstance: ReturnType<typeof drizzle<typeof schema>> = globalForDb.dbInstance ?? createDb();
if (process.env.NODE_ENV !== "production") globalForDb.dbInstance = dbInstance;

const dbProxy = new Proxy(dbInstance, {
  get(target, prop, receiver) {
    return Reflect.get(target, prop, receiver);
  },
  has(target, prop) {
    return Reflect.has(target, prop);
  },
});

export const db = dbProxy as ReturnType<typeof drizzle<typeof schema>>;
export { schema };

// 重新导出底层的 better-sqlite3 实例（用于健康检查、原始 SQL 等场景）
import DatabaseType from "better-sqlite3";
let _sqliteInstance: DatabaseType.Database | null = null;
function getSqliteInstance(): DatabaseType.Database {
  if (!_sqliteInstance) {
    const dbPath = resolveDbPath();
    _sqliteInstance = new Database(dbPath);
    _sqliteInstance.pragma("journal_mode = WAL");
    _sqliteInstance.pragma("synchronous = NORMAL");
  }
  return _sqliteInstance;
}
export const sqlite = new Proxy({} as DatabaseType.Database, {
  get(_target, prop) {
    return (getSqliteInstance() as unknown as Record<string | symbol, unknown>)[prop];
  },
});
export type Database = ReturnType<typeof drizzle<typeof schema>>;
