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
PISTON_SHIM_DIR  ?= infra/piston-shim
PISTON_SHIM_PORT ?= 2000
PISTON_SHIM_PIDFILE ?= /tmp/piston-shim.pid
PISTON_SHIM_LOG    ?= /var/log/piston-shim/server.log

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
up: services-start piston-up migrate-meta ## Start Postgres + Redis + Piston-shim, then migrate
	@echo ""
	@echo "DocForge dependencies are up."
	@echo "  Postgres:  127.0.0.1:$(PG_PORT)  user=$(PG_USER) db=$(PG_DB)"
	@echo "  Redis:     $(REDIS_URL_VAL)"
	@echo "  Piston:    http://127.0.0.1:$(PISTON_SHIM_PORT)/api/v2"
	@echo ""
	@echo "Next: make dev"

.PHONY: down
down: services-stop piston-down ## Stop Postgres + Redis + Piston-shim

.PHONY: status
status: services-status piston-status

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

# --- Piston shim (local code-execution API) --------------------------------
#
# The public Piston API (emkc.org) became whitelist-only on 2026-02-15.
# The shim in $(PISTON_SHIM_DIR) implements the same two endpoints
# (/api/v2/runtimes, /api/v2/execute) using the local toolchains
# (python3, node, gcc, g++, go, rustc, javac, ruby, swift, php, perl, tsc, sqlite3).
#
# For real production isolation (cgroups, seccomp, network namespaces),
# point PISTON_API_URL at a hosted Piston instance instead.

.PHONY: piston-install
piston-install: ## Install piston-shim dependencies
	cd $(PISTON_SHIM_DIR) && npm install --no-audit --no-fund

.PHONY: piston-up
piston-up: ## Start the piston-shim in the background (port $(PISTON_SHIM_PORT))
	@if [ -f "$(PISTON_SHIM_PIDFILE)" ] && kill -0 $$(cat $(PISTON_SHIM_PIDFILE)) 2>/dev/null; then \
	  echo "piston-shim: already running (pid $$(cat $(PISTON_SHIM_PIDFILE)))"; \
	else \
	  mkdir -p $$(dirname $(PISTON_SHIM_LOG)); \
	  [ -d $(PISTON_SHIM_DIR)/node_modules ] || $(MAKE) --no-print-directory piston-install; \
	  nohup node $(PISTON_SHIM_DIR)/server.mjs >> $(PISTON_SHIM_LOG) 2>&1 & \
	  echo $$! > $(PISTON_SHIM_PIDFILE); \
	  sleep 1; \
	  if curl -fsS http://127.0.0.1:$(PISTON_SHIM_PORT)/ >/dev/null 2>&1; then \
	    echo "piston-shim: ready on http://127.0.0.1:$(PISTON_SHIM_PORT) (pid $$(cat $(PISTON_SHIM_PIDFILE)))"; \
	  else \
	    echo "piston-shim: FAILED to start; tail $(PISTON_SHIM_LOG)"; \
	    tail -20 $(PISTON_SHIM_LOG); \
	    exit 1; \
	  fi; \
	fi

.PHONY: piston-down
piston-down: ## Stop the piston-shim
	@if [ -f "$(PISTON_SHIM_PIDFILE)" ]; then \
	  PID=$$(cat $(PISTON_SHIM_PIDFILE)); \
	  if kill -0 $$PID 2>/dev/null; then \
	    kill $$PID 2>/dev/null || true; \
	    sleep 1; \
	    kill -9 $$PID 2>/dev/null || true; \
	    echo "piston-shim: stopped (pid $$PID)"; \
	  fi; \
	  rm -f $(PISTON_SHIM_PIDFILE); \
	else \
	  echo "piston-shim: not running"; \
	fi

.PHONY: piston-status
piston-status: ## Show piston-shim status
	@if curl -fsS http://127.0.0.1:$(PISTON_SHIM_PORT)/ >/dev/null 2>&1; then \
	  echo "piston-shim: up   (http://127.0.0.1:$(PISTON_SHIM_PORT))"; \
	  curl -fsS http://127.0.0.1:$(PISTON_SHIM_PORT)/api/v2/runtimes | python3 -c "import sys,json;d=json.load(sys.stdin);print('  runtimes:', ', '.join(sorted(set(r['language'] for r in d))))"; \
	else \
	  echo "piston-shim: down (run: make piston-up)"; \
	fi

.PHONY: piston-logs
piston-logs: ## Tail the piston-shim log
	tail -n 80 -f $(PISTON_SHIM_LOG)

.PHONY: smoke
smoke: ## Run the end-to-end smoke test (Python venv + Postgres + Redis + Next.js + Piston)
	@if [ ! -d .venv ]; then \
	  echo "Creating .venv (one-time) ..."; \
	  python3 -m venv .venv --prompt docforge; \
	  .venv/bin/pip install -q --upgrade pip; \
	  .venv/bin/pip install -q httpx requests aiohttp python-dotenv pydantic pytest pytest-asyncio ruff mypy black ipython; \
	fi
	. .venv/bin/activate && python3 scripts/python-smoke.py
