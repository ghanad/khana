# AGENTS.md

Guidelines and operational standards for AI agents and automated contributors working on `khana`.

---

## 1. Starting a Task & Multi-Agent Concurrency Safety

> [!CAUTION]
> **Check the current branch and working directory state before starting!**
> - **Detecting Concurrent LLMs/Tasks:** Run `git status` first. If the workspace is **NOT** on `main`, or if there are uncommitted changes on another branch, **another LLM agent or developer is likely actively working on that task!**
> - **Do NOT** blindly switch branches, reset, or overwrite working directory files.
> - If working in parallel or on a distinct task while another branch is busy, use an isolated Git worktree (`git worktree add ...`) so ongoing work remains completely unharmed.

### Starting a New Task from `main`
When initiating any new task:
1. Ensure your starting base is on `main`:
   ```bash
   git checkout main
   ```
2. Pull the latest updates from GitHub before branching:
   ```bash
   git pull origin main
   ```
3. Create and switch to a descriptive task branch:
   - Features: `feat/<short-title>` (e.g. `feat/add-search-bar`)
   - Bug fixes: `fix/<short-title>` (e.g. `fix/rtl-alignment-issue`)
   - Refactoring: `refactor/<short-title>` (e.g. `refactor/db-queries`)
   - Documentation & Tooling: `chore/<short-title>` or `docs/<short-title>`

> [!IMPORTANT]
> **NEVER commit or push directly to `main`.**
> The `main` branch is protected. Never commit or push directly to `main`;
> all work lands on a task branch and eventually reaches `main` through a Pull
> Request that the user asks for.

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

Agents **MUST** run all verification checks before committing a change, and again
in full before pushing a branch or opening a Pull Request. All checks must exit
with code 0:

```bash
# 1. Check code style and rules
npm run lint

# 2. Check TypeScript types
npm run typecheck

# 3. Build & run test suite
npm test
```

If any check fails, fix the underlying issue before committing. Do not commit or
push failing code. Documentation-only changes still need `npm run lint` to pass.

---

## 4. Branch Lifecycle & Pull Request Creation

> [!IMPORTANT]
> **A task is not finished when the first commit lands.** A task may span many
> commits across one or more sessions. Keep the branch open and keep adding
> commits to it until the user explicitly asks for a PR.

### Commit freely, open a PR only when asked

- Commit as soon as a coherent unit of work passes verification. Do **not** hold
  finished work back waiting to batch it into a single commit.
- Do **not** open a Pull Request on your own initiative, and do **not** treat a
  task as complete merely because its code is committed.
- Push intermediate commits to the branch when useful for backup or CI, but
  treat a push as a checkpoint, not as a submission.
- The task ends when the user says so. Expect follow-up requests such as
  adjustments, additional features, or fixes to earlier commits on the same
  branch.

### When the user asks for a PR

1. Run the full verification suite in section 3 and confirm it passes:
   ```bash
   npm run lint && npm run typecheck && npm test
   ```
2. Rebase or merge the latest `main` so the branch is not behind:
   ```bash
   git fetch origin
   git rebase origin/main   # resolve conflicts, then re-run verification
   ```
3. Push the branch:
   ```bash
   git push -u origin <branch-name>
   ```
4. Create the Pull Request against `main`:
   ```bash
   gh pr create --base main --fill
   ```
   Or with explicit title and description matching `.github/pull_request_template.md`:
   ```bash
   gh pr create --base main --title "feat: <title>" --body "### Summary\n<brief explanation>\n\n### Verification\n<test results>"
   ```
5. Verify CI triggered and passed on the PR:
   ```bash
   gh pr checks
   ```

### Verifying earlier commits before a PR

Changes accumulate on the branch, so a defect may have been introduced several
commits back. Before opening a PR, review the branch as a whole rather than only
the most recent commit:

```bash
git log --oneline origin/main..HEAD          # everything this task contributes
git diff origin/main...HEAD                   # the complete net change
```

If a problem traces back to an earlier commit, prefer a follow-up commit that
fixes it. Rewrite history with `git rebase -i` only when the user asks for a
clean history and the branch has not been shared.

---

## 5. Technology Stack Context

- **Runtime:** Node.js (>= 22.13.0)
- **Framework & SSR:** Next.js 16 + React 19 via `vinext` & Vite
- **Styling:** Tailwind CSS v4 (`@tailwindcss/postcss`) with RTL support (`bidi-js`)
- **Database:** Drizzle ORM (`drizzle-orm`, `drizzle-kit`)
- **Deployment:** Cloudflare Workers / Wrangler
