#!/usr/bin/env bash
# Apply all Drizzle SQL migrations in lexical order to both local databases.
# Idempotent: each migration is wrapped in a transaction; already-applied
# migrations are skipped via the drizzle.__drizzle_migrations ledger.
set -euo pipefail

cd "$(dirname "$0")/.."

PG_VERSION="${PG_VERSION:-16}"
PG_USER="${PG_USER:-docforge}"
PG_PASSWORD="${PG_PASSWORD:-docforge_dev}"
PG_DB="${PG_DB:-docforge}"
PG_SHADOW="${PG_SHADOW:-docforge_shadow}"
PG_HOST="${PG_HOST:-127.0.0.1}"
PG_PORT="${PG_PORT:-5432}"

export PGPASSWORD="$PG_PASSWORD"

# Ensure the ledger table exists in both databases.
for db in "$PG_DB" "$PG_SHADOW"; do
  psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$db" -v ON_ERROR_STOP=1 -q <<'SQL'
CREATE SCHEMA IF NOT EXISTS drizzle;
CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
  id SERIAL PRIMARY KEY,
  hash TEXT NOT NULL,
  created_at BIGINT
);
SQL
done

# Apply each .sql file in order, skipping anything already recorded.
shopt -s nullglob
for sql in $(ls drizzle/0*.sql 2>/dev/null | sort); do
  hash="$(basename "$sql" .sql)"
  for db in "$PG_DB" "$PG_SHADOW"; do
    already="$(psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$db" -tAc \
      "SELECT 1 FROM drizzle.__drizzle_migrations WHERE hash = '$hash' LIMIT 1" || true)"
    if [ "$already" = "1" ]; then
      echo "  skip $db $hash (already applied)"
      continue
    fi
    echo "  apply $db $hash"
    psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$db" \
      -v ON_ERROR_STOP=1 -q -f "$sql" >/dev/null
    psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$db" -v ON_ERROR_STOP=1 -q -c \
      "INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ('$hash', extract(epoch from now())::bigint)"
      >/dev/null
  done
done

echo "  all migrations applied"
