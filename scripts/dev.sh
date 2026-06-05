#!/usr/bin/env bash
# DocForge - one-command local development entry point.
# Starts Postgres + Redis, applies migrations, and runs `pnpm dev`.
set -euo pipefail

cd "$(dirname "$0")/.."

case "${1:-dev}" in
  up)        make up ;;
  down)      make down ;;
  status)    make status ;;
  migrate)   make db-migrate ;;
  reset)     make db-reset ;;
  build)     make build ;;
  test)      make test ;;
  lint)      make lint ;;
  typecheck) make typecheck ;;
  studio)    make db-studio ;;
  bootstrap) make bootstrap ;;
  dev|"")    make up && exec pnpm dev ;;
  *)
    echo "Usage: $0 {up|down|status|migrate|reset|build|test|lint|typecheck|studio|bootstrap|dev}" >&2
    exit 1
    ;;
esac
