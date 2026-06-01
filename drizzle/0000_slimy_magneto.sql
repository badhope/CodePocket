CREATE TYPE "public"."execution_status" AS ENUM('queued', 'running', 'completed', 'failed', 'timeout', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."file_type" AS ENUM('file', 'directory');--> statement-breakpoint
CREATE TYPE "public"."project_visibility" AS ENUM('private', 'public', 'unlisted');--> statement-breakpoint
CREATE TYPE "public"."share_visibility" AS ENUM('public', 'password', 'burn_after_read');--> statement-breakpoint
CREATE TYPE "public"."team_role" AS ENUM('owner', 'admin', 'member', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('user', 'pro', 'admin');--> statement-breakpoint
CREATE TABLE "account" (
	"userId" text NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"providerAccountId" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "account_provider_providerAccountId_pk" PRIMARY KEY("provider","providerAccountId")
);
--> statement-breakpoint
CREATE TABLE "api_key" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" varchar(64) NOT NULL,
	"key_hash" text NOT NULL,
	"key_prefix" varchar(12) NOT NULL,
	"scopes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_used_at" timestamp,
	"expires_at" timestamp,
	"revoked_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"action" varchar(64) NOT NULL,
	"target" varchar(128),
	"metadata" jsonb,
	"ip" varchar(64),
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "execution" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"project_id" uuid,
	"snippet_id" uuid,
	"session_id" text NOT NULL,
	"language" varchar(32) NOT NULL,
	"version" varchar(32),
	"code" text NOT NULL,
	"stdin" text,
	"args" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"env" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "execution_status" DEFAULT 'queued' NOT NULL,
	"exit_code" integer,
	"stdout" text,
	"stderr" text,
	"cpu_time_ms" integer,
	"wall_time_ms" integer,
	"memory_kb" integer,
	"started_at" timestamp,
	"finished_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "file_version" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_id" uuid NOT NULL,
	"blob_key" text NOT NULL,
	"size" bigint NOT NULL,
	"commit_message" text,
	"author_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_file" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"path" text NOT NULL,
	"type" "file_type" DEFAULT 'file' NOT NULL,
	"content" text,
	"blob_key" text,
	"size" bigint DEFAULT 0 NOT NULL,
	"mime" varchar(128),
	"encoding" varchar(32) DEFAULT 'utf-8' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"team_id" uuid,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"description" text,
	"visibility" "project_visibility" DEFAULT 'private' NOT NULL,
	"language" varchar(32) DEFAULT 'python' NOT NULL,
	"template" varchar(64),
	"star_count" integer DEFAULT 0 NOT NULL,
	"fork_count" integer DEFAULT 0 NOT NULL,
	"fork_of" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"sessionToken" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"expires" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "share" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"short_id" varchar(16) NOT NULL,
	"author_id" text NOT NULL,
	"project_id" uuid,
	"snippet_id" uuid,
	"visibility" "share_visibility" DEFAULT 'public' NOT NULL,
	"password_hash" text,
	"view_count" integer DEFAULT 0 NOT NULL,
	"burned" boolean DEFAULT false NOT NULL,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "share_short_id_unique" UNIQUE("short_id")
);
--> statement-breakpoint
CREATE TABLE "snippet" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"author_id" text NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"language" varchar(32) NOT NULL,
	"code" text NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"visibility" "project_visibility" DEFAULT 'private' NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"fork_count" integer DEFAULT 0 NOT NULL,
	"like_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_member" (
	"team_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" "team_role" DEFAULT 'member' NOT NULL,
	"invited_by" text,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "team_member_team_id_user_id_pk" PRIMARY KEY("team_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "team" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"description" text,
	"plan" varchar(32) DEFAULT 'free' NOT NULL,
	"owner_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "team_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"email" text,
	"emailVerified" timestamp,
	"image" text,
	"password_hash" text,
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"locale" varchar(10) DEFAULT 'en' NOT NULL,
	"theme" varchar(20) DEFAULT 'dark' NOT NULL,
	"two_factor_enabled" boolean DEFAULT false NOT NULL,
	"two_factor_secret" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verificationToken" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "verificationToken_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_key" ADD CONSTRAINT "api_key_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "execution" ADD CONSTRAINT "execution_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "execution" ADD CONSTRAINT "execution_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "execution" ADD CONSTRAINT "execution_snippet_id_snippet_id_fk" FOREIGN KEY ("snippet_id") REFERENCES "public"."snippet"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_version" ADD CONSTRAINT "file_version_file_id_project_file_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."project_file"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_version" ADD CONSTRAINT "file_version_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_file" ADD CONSTRAINT "project_file_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project" ADD CONSTRAINT "project_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share" ADD CONSTRAINT "share_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share" ADD CONSTRAINT "share_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share" ADD CONSTRAINT "share_snippet_id_snippet_id_fk" FOREIGN KEY ("snippet_id") REFERENCES "public"."snippet"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "snippet" ADD CONSTRAINT "snippet_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_member" ADD CONSTRAINT "team_member_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_member" ADD CONSTRAINT "team_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_member" ADD CONSTRAINT "team_member_invited_by_user_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team" ADD CONSTRAINT "team_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "api_key_prefix_idx" ON "api_key" USING btree ("key_prefix");--> statement-breakpoint
CREATE INDEX "api_key_user_idx" ON "api_key" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_log_user_idx" ON "audit_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_log_action_idx" ON "audit_log" USING btree ("action");--> statement-breakpoint
CREATE INDEX "execution_user_idx" ON "execution" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "execution_session_idx" ON "execution" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "execution_status_idx" ON "execution" USING btree ("status");--> statement-breakpoint
CREATE INDEX "execution_created_idx" ON "execution" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "file_version_file_idx" ON "file_version" USING btree ("file_id");--> statement-breakpoint
CREATE UNIQUE INDEX "project_file_path_idx" ON "project_file" USING btree ("project_id","path");--> statement-breakpoint
CREATE INDEX "project_file_project_idx" ON "project_file" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "project_owner_slug_idx" ON "project" USING btree ("owner_id","slug");--> statement-breakpoint
CREATE INDEX "project_visibility_idx" ON "project" USING btree ("visibility");--> statement-breakpoint
CREATE INDEX "project_team_idx" ON "project" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "share_author_idx" ON "share" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "share_expires_idx" ON "share" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "snippet_author_idx" ON "snippet" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "snippet_language_idx" ON "snippet" USING btree ("language");--> statement-breakpoint
CREATE INDEX "snippet_visibility_idx" ON "snippet" USING btree ("visibility");--> statement-breakpoint
CREATE INDEX "user_email_idx" ON "user" USING btree ("email");