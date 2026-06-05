import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as {
  conn: ReturnType<typeof postgres> | undefined;
  dbInstance: ReturnType<typeof drizzle<typeof schema>> | undefined;
};

function resolveUrl(): string {
  const url = process.env.POSTGRES_URL;
  if (url && url.length > 0) return url;
  if (process.env.NEXT_PHASE === "phase-production-build") {
    // Build phase never actually opens a connection; this just needs to parse.
    return "postgres://placeholder:placeholder@127.0.0.1:5432/placeholder";
  }
  throw new Error("Database is not configured. Set POSTGRES_URL in your environment.");
}

function createDb() {
  const conn = postgres(resolveUrl(), {
    max: process.env.POSTGRES_URL ? 10 : 1,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false,
    no_prepare: true,
    onnotice: () => {},
    connection: { application_name: "onlinecode" },
  });
  if (process.env.POSTGRES_URL && process.env.NODE_ENV !== "production") {
    globalForDb.conn = conn;
  }
  return drizzle(conn, { schema, casing: "snake_case" });
}

const dbInstance: ReturnType<typeof drizzle<typeof schema>> = createDb();
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
export type Database = ReturnType<typeof drizzle<typeof schema>>;
