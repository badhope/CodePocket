import { sqliteTable, text, integer, primaryKey } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { relations } from "drizzle-orm";
import type { AdapterAccountType } from "next-auth/adapters";

// ============================================================================
// AUTH TABLES (NextAuth Drizzle Adapter compatible)
// ============================================================================

export const users = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: integer("emailVerified", { mode: "timestamp" }),
  image: text("image"),
  passwordHash: text("password_hash"),
  role: text("role").notNull().default("user"),
  locale: text("locale").notNull().default("en"),
  theme: text("theme").notNull().default("dark"),
  twoFactorEnabled: integer("two_factor_enabled", { mode: "boolean" }).notNull().default(false),
  twoFactorSecret: text("two_factor_secret"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const accounts = sqliteTable(
  "account",
  {
    id: text("id").primaryKey(),
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
  (t) => ({
    uniqueProviderAccount: primaryKey({ columns: [t.provider, t.providerAccountId] }),
  }),
);

export const sessions = sqliteTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: integer("expires", { mode: "timestamp" }).notNull(),
});

export const verificationTokens = sqliteTable(
  "verificationToken",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: integer("expires", { mode: "timestamp" }).notNull(),
  },
  (t) => ({
    uniqueIdentifierToken: primaryKey({ columns: [t.identifier, t.token] }),
  }),
);

// ============================================================================
// DOCUMENTS
// ============================================================================

export const documents = sqliteTable("document", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  originalName: text("original_name").notNull(),
  format: text("format").notNull(),
  size: integer("size").notNull(),
  mimeType: text("mime_type"),
  blobKey: text("blob_key"),
  status: text("status").notNull().default("uploaded"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

// ============================================================================
// CONVERSIONS
// ============================================================================

export const conversions = sqliteTable("conversion", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  documentId: text("document_id")
    .notNull()
    .references(() => documents.id, { onDelete: "cascade" }),
  inputFormat: text("input_format").notNull(),
  outputFormat: text("output_format").notNull(),
  status: text("status").notNull().default("pending"),
  progress: integer("progress").notNull().default(0),
  outputBlobKey: text("output_blob_key"),
  outputSize: integer("output_size"),
  outputFilename: text("output_filename"),
  error: text("error"),
  durationMs: integer("duration_ms"),
  metadata: text("metadata", { mode: "json" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  completedAt: integer("completed_at", { mode: "timestamp" }),
});

// ============================================================================
// EXECUTIONS (DocForge playground)
// ============================================================================

export const executions = sqliteTable("execution", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  projectId: text("project_id"),
  snippetId: text("snippet_id"),
  sessionId: text("session_id").notNull(),
  language: text("language").notNull(),
  version: text("version"),
  code: text("code").notNull(),
  stdin: text("stdin"),
  args: text("args", { mode: "json" }).$type<string[]>().notNull().default([]),
  env: text("env", { mode: "json" }).$type<Record<string, string>>().notNull().default({}),
  status: text("status").notNull().default("queued"),
  exitCode: integer("exit_code"),
  stdout: text("stdout"),
  stderr: text("stderr"),
  cpuTimeMs: integer("cpu_time_ms"),
  wallTimeMs: integer("wall_time_ms"),
  memoryKb: integer("memory_kb"),
  startedAt: integer("started_at", { mode: "timestamp" }),
  finishedAt: integer("finished_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

// ============================================================================
// PROJECTS (DocForge multi-file projects)
// ============================================================================

export const projects = sqliteTable("project", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  teamId: text("team_id"),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  description: text("description"),
  visibility: text("visibility").notNull().default("private"),
  language: text("language").notNull().default("python"),
  template: text("template"),
  starCount: integer("star_count").notNull().default(0),
  forkCount: integer("fork_count").notNull().default(0),
  forkOf: text("fork_of"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const projectFiles = sqliteTable("project_file", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  path: text("path").notNull(),
  type: text("type").notNull().default("file"),
  content: text("content"),
  blobKey: text("blob_key"),
  size: integer("size").notNull().default(0),
  mime: text("mime"),
  encoding: text("encoding").notNull().default("utf-8"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const fileVersions = sqliteTable("file_version", {
  id: text("id").primaryKey(),
  fileId: text("file_id")
    .notNull()
    .references(() => projectFiles.id, { onDelete: "cascade" }),
  blobKey: text("blob_key").notNull(),
  size: integer("size").notNull(),
  commitMessage: text("commit_message"),
  authorId: text("author_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

// ============================================================================
// PROJECT PACKAGES
// ============================================================================

export const packages = sqliteTable("package", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  ecosystem: text("ecosystem").notNull(),
  name: text("name").notNull(),
  version: text("version"),
  dev: integer("dev", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

// ============================================================================
// SNIPPETS
// ============================================================================

export const snippets = sqliteTable("snippet", {
  id: text("id").primaryKey(),
  authorId: text("author_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  language: text("language").notNull(),
  code: text("code").notNull(),
  tags: text("tags", { mode: "json" }).$type<string[]>().notNull().default([]),
  visibility: text("visibility").notNull().default("private"),
  viewCount: integer("view_count").notNull().default(0),
  forkCount: integer("fork_count").notNull().default(0),
  likeCount: integer("like_count").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

// ============================================================================
// SHARES
// ============================================================================

export const shares = sqliteTable("share", {
  id: text("id").primaryKey(),
  shortId: text("short_id").notNull().unique(),
  authorId: text("author_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  projectId: text("project_id").references(() => projects.id, { onDelete: "cascade" }),
  snippetId: text("snippet_id").references(() => snippets.id, { onDelete: "cascade" }),
  visibility: text("visibility").notNull().default("public"),
  passwordHash: text("password_hash"),
  viewCount: integer("view_count").notNull().default(0),
  burned: integer("burned", { mode: "boolean" }).notNull().default(false),
  expiresAt: integer("expires_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

// ============================================================================
// TEAMS
// ============================================================================

export const teams = sqliteTable("team", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  plan: text("plan").notNull().default("free"),
  ownerId: text("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const teamMembers = sqliteTable(
  "team_member",
  {
    id: text("id").primaryKey(),
    teamId: text("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("member"),
    invitedBy: text("invited_by").references(() => users.id, { onDelete: "set null" }),
    joinedAt: integer("joined_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => ({
    uniqueTeamUser: primaryKey({ columns: [t.teamId, t.userId] }),
  }),
);

// ============================================================================
// API KEYS & AUDIT LOG
// ============================================================================

export const apiKeys = sqliteTable("api_key", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  keyHash: text("key_hash").notNull(),
  keyPrefix: text("key_prefix").notNull(),
  scopes: text("scopes", { mode: "json" }).$type<string[]>().notNull().default([]),
  lastUsedAt: integer("last_used_at", { mode: "timestamp" }),
  expiresAt: integer("expires_at", { mode: "timestamp" }),
  revokedAt: integer("revoked_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const auditLogs = sqliteTable("audit_log", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  target: text("target"),
  metadata: text("metadata", { mode: "json" }),
  ip: text("ip"),
  userAgent: text("user_agent"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

// ============================================================================
// TYPES
// ============================================================================

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
export type Conversion = typeof conversions.$inferSelect;
export type NewConversion = typeof conversions.$inferInsert;
export type Execution = typeof executions.$inferSelect;
export type NewExecution = typeof executions.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type ProjectFile = typeof projectFiles.$inferSelect;
export type NewProjectFile = typeof projectFiles.$inferInsert;
export type Snippet = typeof snippets.$inferSelect;
export type NewSnippet = typeof snippets.$inferInsert;
export type Share = typeof shares.$inferSelect;
export type NewShare = typeof shares.$inferInsert;
export type Team = typeof teams.$inferSelect;
export type NewTeam = typeof teams.$inferInsert;
export type TeamMember = typeof teamMembers.$inferSelect;
export type NewTeamMember = typeof teamMembers.$inferInsert;
export type Package = typeof packages.$inferSelect;
export type NewPackage = typeof packages.$inferInsert;

// ============================================================================
// RELATIONS
// ============================================================================

export const conversionsRelations = relations(conversions, ({ one }) => ({
  document: one(documents, {
    fields: [conversions.documentId],
    references: [documents.id],
  }),
}));

export const documentsRelations = relations(documents, ({ many }) => ({
  conversions: many(conversions),
}));
