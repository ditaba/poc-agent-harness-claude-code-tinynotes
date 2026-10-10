# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project state

TinyNotes is a demo notes app (email/password auth, TipTap rich-text notes, public share links) on Bun + Next.js App Router + `bun:sqlite`. **`SPEC.md` is the source of truth**: decisions (D1…), requirement IDs (AUTH-, NOTE-, SHARE-, PUB-, MSG-, NAV-), exact UI copy, SQL schema, file layout, function signatures, test cases and milestones (M0–M7). Read the relevant SPEC sections before implementing anything, and use its names exactly (routes, files, functions, error codes, UI strings).

Progress is tracked in `prd.json` (tasks with `passes`) and `agent-progress.txt` (what each iteration did). Check both to see what exists instead of assuming. Until the M0 tasks pass, the repo is the plain `create-next-app` scaffold, and `package.json`, `.env.example` and `.gitignore` don't match SPEC §4 yet.

Work is done by the Ralph loop (`ralph.sh`, see `RALPH.md`): each iteration is a fresh `claude -p` session that reads `prd.json`, `agent-progress.txt`, `SPEC.md` and this file, implements one task, sets `passes=true`, appends to `agent-progress.txt`, and commits. `prd.json` is generated from SPEC via `spec-to-prd-prompts.md`.

## Ralph task rules

- **Blocked tasks.** When a task hits a stop-and-ask condition (see Invariants, or the task's acceptance criteria), don't work around it. Set the task's `"blocked"` field to the reason and what you tried, keep `passes=false`, log it in `agent-progress.txt`, commit, and output `<blocked>TASK_ID</blocked>`. `ralph.sh` then stops so a human can decide. Never pick a task that has a `"blocked"` field.
- **Failing checks.** If a check fails because of a bug in earlier work, fix it in the current task when the fix is a few lines, and name the failing requirement ID in the commit message. Otherwise add a new task to `prd.json` just before the current one (`passes: false`), add its id to the current task's `dependsOn`, and leave the current task `passes=false`.
- **Playwright sign-out.** Before `M3-notes-shell` adds the Sign out button, sign out by clearing cookies with Playwright MCP's run-code tool: `await page.context().clearCookies()`.

## Commands

Target scripts (SPEC §4, added in M0):

```bash
bun install
bun run dev          # db:migrate, then bun --bun next dev
bun run build        # db:migrate, then bun --bun next build
bun run start        # db:migrate, then bun --bun next start
bun run lint         # eslint
bun run typecheck    # tsc --noEmit
bun run format       # prettier --write .
bun run db:migrate   # bun scripts/migrate.ts (checks env, creates data/, applies migrations)
bun test                                # all unit tests
bun test lib/notes/validation           # one file (path filter)
bun test lib/notes -t "TITLE_TOO_LONG"  # filter by test name
```

- Next.js must run on the Bun runtime (`bun --bun next …`) because `bun:sqlite` only exists there (D28).
- `dev`/`build`/`start` stop at `db:migrate` if `.env` is missing or invalid (D36). Copy `.env.example` to `.env` with a ≥32-char `BETTER_AUTH_SECRET`.
- A PostToolUse hook in `.claude/settings.json` runs `bun run format` after every Edit/Write, so don't run Prettier by hand. It fails silently until Prettier is installed in M0. `.prettierignore` skips `*.md` and `.claude/` (D46).
- `bun test` exits non-zero when no test files exist (M0), so don't treat that as a failure there.
- There is no automated E2E suite (out of scope), so don't add one. UI acceptance is the SPEC §11 manual checklist, run through the Playwright MCP.

## Architecture (target, SPEC §9)

- **Data layer**: one `bun:sqlite` `Database` singleton in `lib/db.ts` (cached on `globalThis` in dev for HMR; PRAGMAs `foreign_keys`, WAL, `busy_timeout`). Importing `lib/db.ts` opens `DB_PATH`, so only app code imports it; tests, `lib/testing/db.ts` and `scripts/migrate.ts` use the side-effect-free `openDatabase()` from `lib/open-database.ts` (D45). The app and better-auth share it (D29). Raw parameterized SQL only, no ORM or query builder. All note SQL lives in `lib/notes/repo.ts`, whose functions take `db` as their first argument so tests can pass an in-memory DB.
- **Migrations**: plain `.sql` files in `db/migrations/`, applied in filename order by `lib/migrate.ts` (pure, testable) through the CLI wrapper `scripts/migrate.ts`, and recorded in `_migrations`. Never edit an applied migration; add a new file. `0001_better_auth.sql` must match better-auth's expected schema exactly.
- **Reads**: pages are Server Components that call `repo.*` with `db` directly (no fetch to their own API). Protected pages call `requireUser()` (redirects to `/sign-in`).
- **Writes**: Server Actions in `lib/notes/actions.ts`. Each one calls `getCurrentUser()` itself and returns `ActionResult<T>` (`lib/errors.ts`), never throws to the client and never redirects. The exception is `createNoteAction`, the only form action, which redirects. Client components wrap every action call in `callAction()` (`lib/call-action.ts`), which turns a rejected call into `INTERNAL`. The only route handler is better-auth's `/api/auth/[...all]`.
- **Auth**: better-auth (`lib/auth.ts` on the server, `lib/auth-client.ts` in auth forms). `lib/session.ts` exposes `getCurrentUser` (React `cache()`) and `requireUser`. There is no `proxy.ts`/middleware and no layout-only auth check (D25).
- **Rich text pipeline**: `lib/notes/editor-extensions.ts` is the single extension list, shared by the client editor (`@tiptap/react`), server validation (`getSchema` + `Node.fromJSON().check()`, normalized before storage) and server rendering (`@tiptap/static-renderer`). Changing formatting support means changing only that file. Size and length limits live in `lib/notes/limits.ts`, which has no imports so both browser and server can use it.
- **Sharing**: `/s/[token]` is a public page with no session lookup. It checks the token format (`SHARE_TOKEN_PATTERN`) before querying, and unknown, disabled or malformed tokens give 404. Disabling sharing deletes the token, and re-enabling issues a new one.

## Invariants (security and spec rules that are easy to break)

- Every owner-scoped query includes `AND user_id = ?`. A note the user doesn't own behaves exactly like a missing one (`notFound()` / `NOT_FOUND`, never 403).
- `components/note-content.tsx` holds the only `dangerouslySetInnerHTML`. Titles always render as React text.
- No `trustedOrigins` in `lib/auth.ts` and no `serverActions.allowedOrigins` in `next.config.ts`.
- Server errors are logged with `console.error`. Clients only ever receive an `ErrorCode`.
- App timestamps are INTEGER Unix ms, and note ids come from `crypto.randomUUID()` (D27).
- Dependencies are pinned exactly (no `^`/`~`). Don't add packages that aren't in SPEC §4 without updating the spec.
- Unit tests sit next to their module as `*.test.ts`. DB tests use `createTestDb()` (`:memory:` plus migrations) from `lib/testing/db.ts`. React components and Server Actions are covered by the manual checklist, not unit tests.
- Mark the task blocked (see Ralph task rules) instead of working around these: `bun:sqlite` fails in Next under every R1 fallback (don't switch DB drivers); the static renderer fails to escape output (R4, don't add `@tiptap/html`); the rate limiter never triggers (R10).

## Library versions

The pinned versions (Next 16.4, React 19.3, better-auth 1.7.7, TipTap 3.31, Tailwind 4.3) may be newer than your training data. Check current docs with the context7 MCP or the `DocsExplorer` agent instead of relying on memory, especially for better-auth error codes and schema, TipTap 3 APIs, and Next 16 conventions.
