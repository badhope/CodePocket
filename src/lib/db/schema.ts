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
// EXECUTIONS (DocForge playground)
// ============================================================================

export const executionStatusEnum = pgEnum("execution_status", [
  "queued",
  "running",
  "completed",
  "failed",
  "timeout",
  "cancelled",
]);

export const executions = pgTable(
  "execution",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    projectId: uuid("project_id"),
    snippetId: uuid("snippet_id"),
    sessionId: text("session_id").notNull(),
    language: varchar("language", { length: 32 }).notNull(),
    version: varchar("version", { length: 32 }),
    code: text("code").notNull(),
    stdin: text("stdin"),
    args: jsonb("args").$type<string[]>().notNull().default([]),
    env: jsonb("env").$type<Record<string, string>>().notNull().default({}),
    status: executionStatusEnum("status").notNull().default("queued"),
    exitCode: integer("exit_code"),
    stdout: text("stdout"),
    stderr: text("stderr"),
    cpuTimeMs: integer("cpu_time_ms"),
    wallTimeMs: integer("wall_time_ms"),
    memoryKb: integer("memory_kb"),
    startedAt: timestamp("started_at", { mode: "date" }),
    finishedAt: timestamp("finished_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    index("execution_user_idx").on(t.userId),
    index("execution_status_idx").on(t.status),
    index("execution_created_idx").on(t.createdAt),
  ],
);

// ============================================================================
// PROJECTS (DocForge multi-file projects)
// ============================================================================

export const projectVisibilityEnum = pgEnum("project_visibility", [
  "private",
  "public",
  "unlisted",
]);

export const fileTypeEnum = pgEnum("file_type", ["file", "directory"]);

export const projects = pgTable(
  "project",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    teamId: uuid("team_id"),
    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 255 }).notNull(),
    description: text("description"),
    visibility: projectVisibilityEnum("visibility").notNull().default("private"),
    language: varchar("language", { length: 32 }).notNull().default("python"),
    template: varchar("template", { length: 64 }),
    starCount: integer("star_count").notNull().default(0),
    forkCount: integer("fork_count").notNull().default(0),
    forkOf: uuid("fork_of"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    index("project_visibility_idx").on(t.visibility),
  ],
);

export const projectFiles = pgTable(
  "project_file",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    path: text("path").notNull(),
    type: fileTypeEnum("type").notNull().default("file"),
    content: text("content"),
    blobKey: text("blob_key"),
    size: bigint("size", { mode: "number" }).notNull().default(0),
    mime: varchar("mime", { length: 128 }),
    encoding: varchar("encoding", { length: 32 }).notNull().default("utf-8"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
);

export const fileVersions = pgTable(
  "file_version",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    fileId: uuid("file_id")
      .notNull()
      .references(() => projectFiles.id, { onDelete: "cascade" }),
    blobKey: text("blob_key").notNull(),
    size: bigint("size", { mode: "number" }).notNull(),
    commitMessage: text("commit_message"),
    authorId: text("author_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
);

// ============================================================================
// PROJECT PACKAGES
// ============================================================================

export const packages = pgTable(
  "package",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    ecosystem: varchar("ecosystem", { length: 32 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    version: varchar("version", { length: 64 }),
    dev: boolean("dev").notNull().default(false),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
);

// ============================================================================
// SNIPPETS
// ============================================================================

export const snippets = pgTable(
  "snippet",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    language: varchar("language", { length: 32 }).notNull(),
    code: text("code").notNull(),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    visibility: projectVisibilityEnum("visibility").notNull().default("private"),
    viewCount: integer("view_count").notNull().default(0),
    forkCount: integer("fork_count").notNull().default(0),
    likeCount: integer("like_count").notNull().default(0),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("snippet_language_idx").on(t.language)],
);

// ============================================================================
// SHARES
// ============================================================================

export const shareVisibilityEnum = pgEnum("share_visibility", [
  "public",
  "password",
  "burn_after_read",
]);

export const shares = pgTable(
  "share",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shortId: varchar("short_id", { length: 16 }).notNull().unique(),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
    snippetId: uuid("snippet_id").references(() => snippets.id, { onDelete: "cascade" }),
    visibility: shareVisibilityEnum("visibility").notNull().default("public"),
    passwordHash: text("password_hash"),
    viewCount: integer("view_count").notNull().default(0),
    burned: boolean("burned").notNull().default(false),
    expiresAt: timestamp("expires_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("share_expires_idx").on(t.expiresAt)],
);

// ============================================================================
// TEAMS
// ============================================================================

export const teamRoleEnum = pgEnum("team_role", [
  "owner",
  "admin",
  "member",
  "viewer",
]);

export const teams = pgTable(
  "team",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 255 }).notNull().unique(),
    description: text("description"),
    plan: varchar("plan", { length: 32 }).notNull().default("free"),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
);

export const teamMembers = pgTable(
  "team_member",
  {
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: teamRoleEnum("role").notNull().default("member"),
    invitedBy: text("invited_by").references(() => users.id, { onDelete: "set null" }),
    joinedAt: timestamp("joined_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.teamId, t.userId] })],
);

// ============================================================================
// API KEYS & AUDIT LOG
// ============================================================================

export const apiKeys = pgTable(
  "api_key",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 64 }).notNull(),
    keyHash: text("key_hash").notNull(),
    keyPrefix: varchar("key_prefix", { length: 12 }).notNull(),
    scopes: jsonb("scopes").$type<string[]>().notNull().default([]),
    lastUsedAt: timestamp("last_used_at", { mode: "date" }),
    expiresAt: timestamp("expires_at", { mode: "date" }),
    revokedAt: timestamp("revoked_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
);

export const auditLogs = pgTable(
  "audit_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    action: varchar("action", { length: 64 }).notNull(),
    target: varchar("target", { length: 128 }),
    metadata: jsonb("metadata"),
    ip: varchar("ip", { length: 64 }),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("audit_log_action_idx").on(t.action)],
);

// ============================================================================
// RELATIONS
// ============================================================================

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  documents: many(documents),
  conversions: many(conversions),
  executions: many(executions),
  projects: many(projects),
  snippets: many(snippets),
  shares: many(shares),
  ownedTeams: many(teams),
  teamMemberships: many(teamMembers),
  apiKeys: many(apiKeys),
}));

export const documentsRelations = relations(documents, ({ one, many }) => ({
  user: one(users, { fields: [documents.userId], references: [users.id] }),
  conversions: many(conversions),
}));

export const conversionsRelations = relations(conversions, ({ one }) => ({
  user: one(users, { fields: [conversions.userId], references: [users.id] }),
  document: one(documents, { fields: [conversions.documentId], references: [documents.id] }),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  owner: one(users, { fields: [projects.ownerId], references: [users.id] }),
  files: many(projectFiles),
  packages: many(packages),
}));

export const projectFilesRelations = relations(projectFiles, ({ one, many }) => ({
  project: one(projects, { fields: [projectFiles.projectId], references: [projects.id] }),
  versions: many(fileVersions),
}));

export const fileVersionsRelations = relations(fileVersions, ({ one }) => ({
  file: one(projectFiles, { fields: [fileVersions.fileId], references: [projectFiles.id] }),
  author: one(users, { fields: [fileVersions.authorId], references: [users.id] }),
}));

export const packagesRelations = relations(packages, ({ one }) => ({
  project: one(projects, { fields: [packages.projectId], references: [projects.id] }),
}));

export const snippetsRelations = relations(snippets, ({ one }) => ({
  author: one(users, { fields: [snippets.authorId], references: [users.id] }),
}));

export const sharesRelations = relations(shares, ({ one }) => ({
  author: one(users, { fields: [shares.authorId], references: [users.id] }),
  project: one(projects, { fields: [shares.projectId], references: [projects.id] }),
  snippet: one(snippets, { fields: [shares.snippetId], references: [snippets.id] }),
}));

export const teamsRelations = relations(teams, ({ one, many }) => ({
  owner: one(users, { fields: [teams.ownerId], references: [users.id] }),
  members: many(teamMembers),
}));

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
  team: one(teams, { fields: [teamMembers.teamId], references: [teams.id] }),
  user: one(users, { fields: [teamMembers.userId], references: [users.id] }),
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