import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as {
  conn: ReturnType<typeof postgres> | undefined;
  dbInstance: ReturnType<typeof drizzle<typeof schema>> | undefined;
};

function getConnection() {
  if (globalForDb.conn) return globalForDb.conn;
  const url = process.env.POSTGRES_URL;
  if (!url) {
    throw new Error("Database is not configured. Set POSTGRES_URL in your environment.");
  }
  const conn = postgres(url, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false,
  });
  if (process.env.NODE_ENV !== "production") globalForDb.conn = conn;
  return conn;
}

function createDb() {
  return drizzle(getConnection(), { schema, casing: "snake_case" });
}

function init() {
  if (!globalForDb.dbInstance) globalForDb.dbInstance = createDb();
  return globalForDb.dbInstance;
}

init();

export const db = globalForDb.dbInstance as ReturnType<typeof drizzle<typeof schema>>;
export { schema };
export type Database = typeof db;
