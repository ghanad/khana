# AGENTS.md

Guidelines and operational standards for AI agents and automated contributors working on `khana`.

---

## 1. Commit Message Convention

Follow the [Conventional Commits](https://www.conventionalcommits.org/) format:
- `feat: <description>`
- `fix: <description>`
- `refactor: <description>`
- `test: <description>`
- `chore: <description>`
- `docs: <description>`

Keep commit messages concise, imperative, and focused on the "why" and "what".

---

## 2. Mandatory Pre-Flight Verification

Agents **MUST** run all verification checks before committing a change. All checks must exit
with code 0:

```bash
# 1. Check code style and rules
npm run lint

# 2. Check TypeScript types
npm run typecheck

# 3. Build & run test suite
npm test
```

If any check fails, fix the underlying issue before committing. Do not commit failing code. Documentation-only changes still need `npm run lint` to pass.

---

## 3. Technology Stack Context

- **Runtime:** Node.js (>= 22.13.0)
- **Framework & SSR:** Next.js 16 + React 19 via `vinext` & Vite
- **Styling:** Tailwind CSS v4 (`@tailwindcss/postcss`) with RTL support (`bidi-js`)
- **Database:** Drizzle ORM (`drizzle-orm`, `drizzle-kit`)
- **Deployment:** Cloudflare Workers / Wrangler

