# AGENTS.md

Guidelines and operational standards for AI agents and automated contributors working on `khana`.

---

## 1. Branching & Git Workflow Rules

> [!IMPORTANT]
> **NEVER commit or push directly to `main`.**
> The `main` branch is protected. All contributions must be submitted via a Pull Request.

### Branch Strategy
1. Always start from an up-to-date `main`:
   ```bash
   git checkout main
   git pull origin main
   ```
2. Create and switch to a descriptive task branch:
   - Features: `feat/<short-title>` (e.g. `feat/add-search-bar`)
   - Bug fixes: `fix/<short-title>` (e.g. `fix/rtl-alignment-issue`)
   - Refactoring: `refactor/<short-title>` (e.g. `refactor/db-queries`)
   - Documentation & Tooling: `chore/<short-title>` or `docs/<short-title>`

---

## 2. Commit Message Convention

Follow the [Conventional Commits](https://www.conventionalcommits.org/) format:
- `feat: <description>`
- `fix: <description>`
- `refactor: <description>`
- `test: <description>`
- `chore: <description>`
- `docs: <description>`

Keep commit messages concise, imperative, and focused on the "why" and "what".

---

## 3. Mandatory Pre-Flight Verification

Before pushing a branch or requesting a Pull Request, agents **MUST** run all verification checks locally and ensure they exit with code 0:

```bash
# 1. Check code style and rules
npm run lint

# 2. Check TypeScript types
npm run typecheck

# 3. Build & run test suite
npm test
```

If any check fails, fix the underlying issue before pushing. Do not push failing code.

---

## 4. Pull Request Creation

Once changes are committed and pushed to the remote branch:

1. Push your branch to origin:
   ```bash
   git push -u origin <branch-name>
   ```
2. Create a Pull Request against `main` using the GitHub CLI (`gh`):
   ```bash
   gh pr create --base main --fill
   ```
   Or provide explicit title and description matching the `.github/pull_request_template.md`:
   ```bash
   gh pr create --base main --title "feat: <title>" --body "### Summary\n<brief explanation>\n\n### Verification\n<test results>"
   ```
3. Verify that CI workflows trigger and pass on your PR:
   ```bash
   gh pr checks
   ```

---

## 5. Technology Stack Context

- **Runtime:** Node.js (>= 22.13.0)
- **Framework & SSR:** Next.js 16 + React 19 via `vinext` & Vite
- **Styling:** Tailwind CSS v4 (`@tailwindcss/postcss`) with RTL support (`bidi-js`)
- **Database:** Drizzle ORM (`drizzle-orm`, `drizzle-kit`)
- **Deployment:** Cloudflare Workers / Wrangler
