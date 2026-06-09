# Contributing to DocForge

Thanks for your interest in contributing! This document covers the practical
details of getting a change merged.

## Ground rules

1. **Read the architecture first.** The project is offline-first by design —
   the 20 browser tools and code playground must keep working without the
   backend. Any change that breaks this is a regression.
2. **Don't add new dependencies without justification.** Every new dep is a
   security surface area. If you must, explain the trade-off in the PR.
3. **One PR = one concern.** Refactors, bug fixes, and new features go in
   separate PRs. Makes review and revert easier.
4. **CI must be green.** lint + typecheck + test + build.

## Local setup

```bash
# 1. Fork & clone
git clone https://github.com/<your-username>/OnlineCode.git
cd OnlineCode

# 2. Install
pnpm install

# 3. Run the dev server (no backend needed for the 20 tools)
pnpm dev

# 4. (Optional) start the local services
make up      # Postgres + Redis + Piston-shim
```

## Where to add what

| You want to... | Edit this |
| --- | --- |
| Add a browser tool | `src/lib/tools/client-tools.ts` + `feature-gate.ts` + `messages/*.json` |
| Add a new language | `src/lib/execution/languages.ts` (+ frontend-runner for browser-side) |
| Add a doc format conversion | `src/lib/convert/<format>.ts` + `formats.ts` + `engine.ts` |
| Add a new translation | copy `src/messages/en.json` → `de.json` + register in `i18n/routing.ts` |
| Add a new API route | `src/app/api/<path>/route.ts` + zod schema in `validators/` |
| Modify a page | `src/app/[locale]/<page>/page.tsx` + corresponding `messages/*.json` |

See the [README](README.md#怎么扩展) for step-by-step guides.

## Code style

- TypeScript strict mode, no `any` (use `unknown` + narrowing)
- Use Zod schemas for runtime validation at every API boundary
- Components are server components by default; add `"use client"` only when
  you need state/effects
- Translations live in `src/messages/<locale>.json` — never hard-code English
  strings in components

## Commit messages

We use [Conventional Commits](https://www.conventionalcommits.org/) because
release-please parses them to bump versions and generate the changelog:

```
feat: add JSON Diff tool
fix: handle UTF-8 BOM in CSV parser
docs: clarify Piston-shim usage
chore: bump pnpm to 10.4
refactor: extract rate-limit cache to lib/api
```

Breaking changes use `feat!:` or include a `BREAKING CHANGE:` footer.

## Pull request process

1. Branch from `main` (we don't use `develop` for hotfixes, but we'll add it
   when the team grows)
2. Make your change
3. Run `make test && make lint && make typecheck` locally
4. Fill in the [PR template](.github/PULL_REQUEST_TEMPLATE.md)
5. Request a review from a [CODEOWNER](.github/CODEOWNERS)
6. Once approved, squash-merge with a Conventional Commit message

## Reporting bugs

Open a [bug report](.github/ISSUE_TEMPLATE/bug.yml) with:
- A minimal reproduction
- The backend state (online / offline / not running)
- Browser + version
- Console errors if any

## Security issues

**Do not open a public issue.** Follow [SECURITY.md](SECURITY.md) instead.

## License

By contributing, you agree your contributions will be licensed under the
project's MIT license.
