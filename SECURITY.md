# Security Policy

## Reporting a Vulnerability

If you find a security vulnerability, **do not open a public issue**. Instead:

1. Go to [GitHub Security Advisories](https://github.com/badhope/OnlineCode/security/advisories/new)
2. Submit a private vulnerability report

We will respond within 48 hours and keep you updated on the fix progress.

## What counts as a security issue

- Leaked secrets (API keys, tokens, passwords) in the codebase or git history
- Authentication or authorization bypass
- Remote code execution via the Piston-shim or code execution endpoints
- SQL injection or other database attacks
- XSS in the document conversion pipeline
- Rate limit bypass

## What does NOT count

- Features working as designed (e.g., the Piston-shim intentionally does not provide kernel-level isolation — this is documented)
- Dependency CVEs that are already patched via `pnpm.overrides`
- Issues that require already-authenticated access

## Secret scanning

This repository uses [gitleaks](https://github.com/gitleaks/gitleaks) in CI to scan for accidentally committed secrets. The scan runs on every push and PR to `main`, plus a weekly scheduled scan.

If you accidentally commit a secret:

1. **Revoke the secret immediately** — rotating it is the only safe response
2. Do NOT just delete it from the file; it stays in git history
3. Use `git filter-repo` or BFG Repo Cleaner to rewrite history if needed
4. Force-push the cleaned history (acceptable for secret removal)

## Environment variables

All secrets live in `.env` files, which are git-ignored. The `.env.example` file contains only placeholder values and is safe to commit. Never put real credentials in `.env.example`.
