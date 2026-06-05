#!/usr/bin/env bash
# Build the static export for GitHub Pages.
#
# Next.js 16's `output: 'export'` cannot coexist with API route files —
# the build errors out with "missing generateStaticParams()" / "dynamic =
# force-dynamic" because there is no runtime server to render those
# routes. The right thing to do for a static demo is to keep the source
# on disk (so dev / server deploys still work) but temporarily move
# the affected files out of the way for the static build.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP_DIR="$ROOT/src/app"
STAGE_DIR="$ROOT/.next-static-staging"

# Each entry is "<source>" relative to APP_DIR. They are moved to
# <STAGE_DIR>/<basename> before the build and restored on exit.
# These are routes that depend on the Next.js server (API endpoints,
# auth-aware pages, pages with `force-dynamic`) and cannot be
# pre-rendered in a static export.
STAGE_TARGETS=(
  "api"
  "[locale]/dashboard"
  "[locale]/history"
  "[locale]/projects"
)

cleanup() {
  for t in "${STAGE_TARGETS[@]}"; do
    base="$(basename "$t")"
    if [ -d "$STAGE_DIR/$base" ] && [ ! -e "$APP_DIR/$t" ]; then
      mv "$STAGE_DIR/$base" "$APP_DIR/$t"
    fi
  done
  rm -rf "$STAGE_DIR"
}
trap cleanup EXIT

cd "$ROOT"

mkdir -p "$STAGE_DIR"

for t in "${STAGE_TARGETS[@]}"; do
  if [ -e "$APP_DIR/$t" ]; then
    base="$(basename "$t")"
    echo ">> Staging $t out of the static build"
    mv "$APP_DIR/$t" "$STAGE_DIR/$base"
  fi
done

echo ">> Running Next.js static export"
DEPLOY_TARGET=gh-pages NEXT_PUBLIC_STATIC_DEMO=1 pnpm exec next build

# Move the staged files back so subsequent dev/builds work normally.
for t in "${STAGE_TARGETS[@]}"; do
  base="$(basename "$t")"
  if [ -d "$STAGE_DIR/$base" ]; then
    echo ">> Restoring $t"
    mv "$STAGE_DIR/$base" "$APP_DIR/$t"
  fi
done

if [ -d "$ROOT/out" ]; then
  echo ">> Static export written to $ROOT/out"
  echo "   Files: $(find "$ROOT/out" -type f | wc -l)"
  echo "   Size : $(du -sh "$ROOT/out" | cut -f1)"
else
  echo "!! No ./out directory produced"
  exit 1
fi
