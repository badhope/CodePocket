import {
  pgTable,
  text,
  timestamp,
  primaryKey,
  integer,
  boolean,
  jsonb,
  uuid,
  varchar,
  index,
  pgEnum,
  bigint,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import type { AdapterAccountType } from "next-auth/adapters";

// ============================================================================
// ENUMS
// ============================================================================

export const userRoleEnum = pgEnum("user_role", ["user", "pro", "admin"]);
export const documentStatusEnum = pgEnum("document_status", ["uploaded", "converting", "converted", "failed"]);
export const conversionStatusEnum = pgEnum("conversion_status", ["pending", "processing", "completed", "failed"]);

// ============================================================================
// AUTH TABLES (NextAuth Drizzle Adapter compatible)
// ============================================================================

export const users = pgTable(
  "user",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text("name"),
    email: text("email").unique(),
    emailVerified: timestamp("emailVerified", { mode: "date" }),
    image: text("image"),
    passwordHash: text("password_hash"),
    role: userRoleEnum("role").notNull().default("user"),
    locale: varchar("locale", { length: 10 }).notNull().default("en"),
    theme: varchar("theme", { length: 20 }).notNull().default("dark"),
    twoFactorEnabled: boolean("two_factor_enabled").notNull().default(false),
    twoFactorSecret: text("two_factor_secret"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("user_email_idx").on(t.email)],
);

export const accounts = pgTable(
  "account",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })],
);

export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

// ============================================================================
// DOCUMENTS
// ============================================================================

export const documents = pgTable(
  "document",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    filename: varchar("filename", { length: 255 }).notNull(),
    originalName: varchar("original_name", { length: 255 }).notNull(),
    format: varchar("format", { length: 16 }).notNull(),
    size: bigint("size", { mode: "number" }).notNull(),
    mimeType: varchar("mime_type", { length: 128 }),
    blobKey: text("blob_key"),
    status: documentStatusEnum("status").notNull().default("uploaded"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    index("document_user_idx").on(t.userId),
    index("document_status_idx").on(t.status),
  ],
);

// ============================================================================
// CONVERSIONS
// ============================================================================

export const conversions = pgTable(
  "conversion",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    inputFormat: varchar("input_format", { length: 16 }).notNull(),
    outputFormat: varchar("output_format", { length: 16 }).notNull(),
    status: conversionStatusEnum("status").notNull().default("pending"),
    progress: integer("progress").notNull().default(0),
    outputBlobKey: text("output_blob_key"),
    outputSize: bigint("output_size", { mode: "number" }),
    outputFilename: varchar("output_filename", { length: 255 }),
    error: text("error"),
    durationMs: integer("duration_ms"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { mode: "date" }),
  },
  (t) => [
    index("conversion_user_idx").on(t.userId),
    index("conversion_document_idx").on(t.documentId),
    index("conversion_status_idx").on(t.status),
  ],
);

// ============================================================================
// RELATIONS
// ============================================================================

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  documents: many(documents),
  conversions: many(conversions),
}));

export const documentsRelations = relations(documents, ({ one, many }) => ({
  user: one(users, { fields: [documents.userId], references: [users.id] }),
  conversions: many(conversions),
}));

export const conversionsRelations = relations(conversions, ({ one }) => ({
  user: one(users, { fields: [conversions.userId], references: [users.id] }),
  document: one(documents, { fields: [conversions.documentId], references: [documents.id] }),
}));

// ============================================================================
// TYPES
// ============================================================================

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
export type Conversion = typeof conversions.$inferSelect;
export type NewConversion = typeof conversions.$inferInsert;