# DocForge - One-command local development
# ==========================================
# This Makefile wraps the two native services (Postgres 16 + Redis 7) that
# DocForge depends on in local development. In production we use Vercel
# Postgres + Upstash REST Redis (no system services required).

# --- Configuration ---------------------------------------------------------

PG_VERSION    ?= 16
PG_CLUSTER    ?= main
PG_USER       ?= docforge
PG_PASSWORD   ?= docforge_dev
PG_DB         ?= docforge
PG_SHADOW     ?= docforge_shadow
PG_PORT       ?= 5432
REDIS_PORT    ?= 6379
REDIS_URL_VAL ?= redis://127.0.0.1:$(REDIS_PORT)

# Treat every line of a recipe as a single shell so heredocs work.
.ONESHELL:
.SHELLFLAGS := -eu -c

# --- High-level targets ----------------------------------------------------

.PHONY: help
help: ## Show this help
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage: make <target>\n\nTargets:\n"} /^[a-zA-Z_-]+:.*?##/ { printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

.PHONY: bootstrap
bootstrap: services-create db-migrate install ## First-time setup: create users/dbs, apply migrations, install deps

.PHONY: up
up: services-start migrate-meta ## Start Postgres + Redis and run migrations
	@echo ""
	@echo "DocForge dependencies are up."
	@echo "  Postgres: 127.0.0.1:$(PG_PORT)  user=$(PG_USER) db=$(PG_DB)"
	@echo "  Redis:    $(REDIS_URL_VAL)"
	@echo ""
	@echo "Next: make dev"

.PHONY: down
down: services-stop ## Stop Postgres + Redis

.PHONY: status
status: services-status

.PHONY: dev
dev: ## Run the Next.js dev server
	pnpm dev

.PHONY: build
build: ## Production build
	pnpm build

.PHONY: test
test: ## Run unit tests
	pnpm test

.PHONY: lint
lint: ## Run ESLint
	pnpm lint

.PHONY: typecheck
typecheck: ## Run tsc --noEmit
	pnpm typecheck

.PHONY: db-studio
db-studio: ## Open Drizzle Studio
	pnpm db:studio

# --- Service lifecycle (Postgres + Redis) ---------------------------------

.PHONY: services-status
services-status:
	@pg_lsclusters 2>/dev/null | sed 's/^/postgres: /' || echo "postgres: not installed"
	@redis-cli -p $(REDIS_PORT) ping 2>/dev/null | sed 's/^/redis:    /' || echo "redis:    not running"

.PHONY: services-start
services-start: ## Start Postgres and Redis (idempotent)
	pg_ctlcluster $(PG_VERSION) $(PG_CLUSTER) start 2>/dev/null || true
	if ! redis-cli -p $(REDIS_PORT) ping >/dev/null 2>&1; then
	  redis-server --daemonize yes --port $(REDIS_PORT) --save "" --appendonly no >/dev/null
	  sleep 0.5
	fi
	pg_isready -h 127.0.0.1 -p $(PG_PORT) -q && echo "postgres: ready"
	redis-cli -p $(REDIS_PORT) ping | sed 's/^/redis:    /'

.PHONY: services-stop
services-stop: ## Stop Postgres and Redis
	pg_ctlcluster $(PG_VERSION) $(PG_CLUSTER) stop 2>/dev/null || true
	redis-cli -p $(REDIS_PORT) shutdown nosave 2>/dev/null || true
	echo "stopped."

.PHONY: services-create
services-create: ## Create the local Postgres role and databases (first time only)
	@sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='$(PG_USER)'" | grep -q 1 || \
	  sudo -u postgres psql -c "CREATE ROLE $(PG_USER) LOGIN PASSWORD '$(PG_PASSWORD)' CREATEDB;"
	@sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='$(PG_DB)'" | grep -q 1 || \
	  sudo -u postgres createdb -O $(PG_USER) $(PG_DB)
	@sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='$(PG_SHADOW)'" | grep -q 1 || \
	  sudo -u postgres createdb -O $(PG_USER) $(PG_SHADOW)
	@echo "postgres: role + databases ready"

# --- Database migrations ---------------------------------------------------

.PHONY: db-generate
db-generate: ## Generate Drizzle migration SQL from schema.ts
	pnpm db:generate

.PHONY: db-migrate
db-migrate: ## Apply Drizzle migrations to local DB
	bash scripts/db-migrate.sh

.PHONY: migrate-meta
migrate-meta: ## Record the meta table so drizzle-kit migrate is idempotent
	bash scripts/db-meta.sh

.PHONY: db-reset
db-reset: ## Drop and recreate the local databases (DESTRUCTIVE)
	sudo -u postgres dropdb $(PG_DB) 2>/dev/null || true
	sudo -u postgres dropdb $(PG_SHADOW) 2>/dev/null || true
	$(MAKE) --no-print-directory services-create
	$(MAKE) --no-print-directory db-migrate

.PHONY: db-seed
db-seed: ## Seed the database (scripts/seed.ts)
	pnpm db:seed

# --- Dependencies ----------------------------------------------------------

.PHONY: install
install: ## Install Node dependencies via pnpm
	CI=true pnpm install --no-frozen-lockfile

.PHONY: clean
clean: ## Remove build artifacts and node_modules
	rm -rf .next node_modules tsconfig.tsbuildinfo
	echo "cleaned."
