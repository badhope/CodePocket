#!/usr/bin/env bash
# Ensure the drizzle migration ledger exists; no-op if it already does.
set -euo pipefail
cd "$(dirname "$0")/.."

export PGPASSWORD="${PG_PASSWORD:-docforge_dev}"
for db in "${PG_DB:-docforge}" "${PG_SHADOW:-docforge_shadow}"; do
  psql -h "${PG_HOST:-127.0.0.1}" -p "${PG_PORT:-5432}" \
    -U "${PG_USER:-docforge}" -d "$db" -v ON_ERROR_STOP=1 -q <<'SQL'
CREATE SCHEMA IF NOT EXISTS drizzle;
CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
  id SERIAL PRIMARY KEY,
  hash TEXT NOT NULL,
  created_at BIGINT
);
SQL
done
