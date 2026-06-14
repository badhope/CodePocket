-- 创建用户表
CREATE TABLE IF NOT EXISTS user (
  id TEXT PRIMARY KEY,
  name TEXT,
  email TEXT UNIQUE,
  emailVerified INTEGER,
  image TEXT,
  password_hash TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  locale TEXT NOT NULL DEFAULT 'en',
  theme TEXT NOT NULL DEFAULT 'dark',
  two_factor_enabled INTEGER NOT NULL DEFAULT 0,
  two_factor_secret TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- 创建账户表
CREATE TABLE IF NOT EXISTS account (
  userId TEXT NOT NULL,
  type TEXT NOT NULL,
  provider TEXT NOT NULL,
  providerAccountId TEXT NOT NULL,
  refresh_token TEXT,
  access_token TEXT,
  expires_at INTEGER,
  token_type TEXT,
  scope TEXT,
  id_token TEXT,
  session_state TEXT,
  PRIMARY KEY (provider, providerAccountId),
  FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE
);

-- 创建会话表
CREATE TABLE IF NOT EXISTS session (
  sessionToken TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  expires INTEGER NOT NULL,
  FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE
);

-- 创建验证令牌表
CREATE TABLE IF NOT EXISTS verificationToken (
  identifier TEXT NOT NULL,
  token TEXT NOT NULL,
  expires INTEGER NOT NULL,
  PRIMARY KEY (identifier, token)
);

-- 创建文档表
CREATE TABLE IF NOT EXISTS document (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  original_name TEXT NOT NULL,
  format TEXT NOT NULL,
  size INTEGER NOT NULL,
  mime_type TEXT,
  blob_key TEXT,
  status TEXT NOT NULL DEFAULT 'uploaded',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
);

-- 创建转换表
CREATE TABLE IF NOT EXISTS conversion (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  document_id TEXT NOT NULL,
  input_format TEXT NOT NULL,
  output_format TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  progress INTEGER NOT NULL DEFAULT 0,
  output_blob_key TEXT,
  output_size INTEGER,
  output_filename TEXT,
  error TEXT,
  duration_ms INTEGER,
  metadata TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  completed_at INTEGER,
  FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE,
  FOREIGN KEY (document_id) REFERENCES document(id) ON DELETE CASCADE
);

-- 创建执行表
CREATE TABLE IF NOT EXISTS execution (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  project_id TEXT,
  snippet_id TEXT,
  session_id TEXT NOT NULL,
  language TEXT NOT NULL,
  version TEXT,
  code TEXT NOT NULL,
  stdin TEXT,
  args TEXT NOT NULL DEFAULT '[]',
  env TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'queued',
  exit_code INTEGER,
  stdout TEXT,
  stderr TEXT,
  cpu_time_ms INTEGER,
  wall_time_ms INTEGER,
  memory_kb INTEGER,
  started_at INTEGER,
  finished_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE SET NULL
);

-- 创建项目表
CREATE TABLE IF NOT EXISTS project (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  team_id TEXT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  visibility TEXT NOT NULL DEFAULT 'private',
  language TEXT NOT NULL DEFAULT 'python',
  template TEXT,
  star_count INTEGER NOT NULL DEFAULT 0,
  fork_count INTEGER NOT NULL DEFAULT 0,
  fork_of TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (owner_id) REFERENCES user(id) ON DELETE CASCADE
);

-- 创建项目文件表
CREATE TABLE IF NOT EXISTS project_file (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  path TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'file',
  content TEXT,
  blob_key TEXT,
  size INTEGER NOT NULL DEFAULT 0,
  mime TEXT,
  encoding TEXT NOT NULL DEFAULT 'utf-8',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (project_id) REFERENCES project(id) ON DELETE CASCADE
);

-- 创建文件版本表
CREATE TABLE IF NOT EXISTS file_version (
  id TEXT PRIMARY KEY,
  file_id TEXT NOT NULL,
  blob_key TEXT NOT NULL,
  size INTEGER NOT NULL,
  commit_message TEXT,
  author_id TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (file_id) REFERENCES project_file(id) ON DELETE CASCADE,
  FOREIGN KEY (author_id) REFERENCES user(id) ON DELETE SET NULL
);

-- 创建包表
CREATE TABLE IF NOT EXISTS package (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  ecosystem TEXT NOT NULL,
  name TEXT NOT NULL,
  version TEXT,
  dev INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (project_id) REFERENCES project(id) ON DELETE CASCADE
);

-- 创建代码片段表
CREATE TABLE IF NOT EXISTS snippet (
  id TEXT PRIMARY KEY,
  author_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  language TEXT NOT NULL,
  code TEXT NOT NULL,
  tags TEXT NOT NULL DEFAULT '[]',
  visibility TEXT NOT NULL DEFAULT 'private',
  view_count INTEGER NOT NULL DEFAULT 0,
  fork_count INTEGER NOT NULL DEFAULT 0,
  like_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (author_id) REFERENCES user(id) ON DELETE CASCADE
);

-- 创建分享表
CREATE TABLE IF NOT EXISTS share (
  id TEXT PRIMARY KEY,
  short_id TEXT NOT NULL UNIQUE,
  author_id TEXT NOT NULL,
  project_id TEXT,
  snippet_id TEXT,
  visibility TEXT NOT NULL DEFAULT 'public',
  password_hash TEXT,
  view_count INTEGER NOT NULL DEFAULT 0,
  burned INTEGER NOT NULL DEFAULT 0,
  expires_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (author_id) REFERENCES user(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES project(id) ON DELETE CASCADE,
  FOREIGN KEY (snippet_id) REFERENCES snippet(id) ON DELETE CASCADE
);

-- 创建团队表
CREATE TABLE IF NOT EXISTS team (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  plan TEXT NOT NULL DEFAULT 'free',
  owner_id TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (owner_id) REFERENCES user(id) ON DELETE CASCADE
);

-- 创建团队成员表
CREATE TABLE IF NOT EXISTS team_member (
  team_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  invited_by TEXT,
  joined_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (team_id, user_id),
  FOREIGN KEY (team_id) REFERENCES team(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE,
  FOREIGN KEY (invited_by) REFERENCES user(id) ON DELETE SET NULL
);

-- 创建API密钥表
CREATE TABLE IF NOT EXISTS api_key (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  scopes TEXT NOT NULL DEFAULT '[]',
  last_used_at INTEGER,
  expires_at INTEGER,
  revoked_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
);

-- 创建审计日志表
CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  action TEXT NOT NULL,
  target TEXT,
  metadata TEXT,
  ip TEXT,
  user_agent TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE SET NULL
);

-- 创建索引
CREATE INDEX IF NOT EXISTS user_email_idx ON user(email);
CREATE INDEX IF NOT EXISTS document_user_idx ON document(user_id);
CREATE INDEX IF NOT EXISTS document_status_idx ON document(status);
CREATE INDEX IF NOT EXISTS conversion_user_idx ON conversion(user_id);
CREATE INDEX IF NOT EXISTS conversion_document_idx ON conversion(document_id);
CREATE INDEX IF NOT EXISTS conversion_status_idx ON conversion(status);
CREATE INDEX IF NOT EXISTS execution_user_idx ON execution(user_id);
CREATE INDEX IF NOT EXISTS execution_status_idx ON execution(status);
CREATE INDEX IF NOT EXISTS execution_created_idx ON execution(created_at);
CREATE INDEX IF NOT EXISTS project_visibility_idx ON project(visibility);
CREATE INDEX IF NOT EXISTS snippet_language_idx ON snippet(language);
CREATE INDEX IF NOT EXISTS share_expires_idx ON share(expires_at);
CREATE INDEX IF NOT EXISTS audit_log_action_idx ON audit_log(action);
