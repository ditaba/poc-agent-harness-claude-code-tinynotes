# TinyNotes — SPEC

Status: draft for review · Date: 2026-10-10 · Source: `requestments.txt` + interview

Items marked **[ASSUMPTION]** were not confirmed in the interview. Everything else was confirmed.

---

## 1. Overview

TinyNotes is a small demo web app. A user signs up with email and password, writes rich-text notes, and can share a note through a public link that they can turn off at any time. Anyone with an active link can read the note without signing in.

Notes are stored as TipTap JSON in SQLite and rendered as HTML. The app runs locally on Bun with Next.js (App Router). It is deliberately simple: no email, no files, no search, no autosave.

---

## 2. Scope

### In scope

- Sign up, sign in, sign out (email + password, better-auth).
- Notes: list, create, open/edit (title + rich text), explicit save, delete.
- Sharing: create a public link, copy it, disable it. Re-enabling creates a new link.
- Public read-only page for a shared note.
- Raw-SQL data layer on `bun:sqlite`, with a custom migration script.
- Unit tests (`bun test`) and a manual acceptance checklist.
- Prettier + `format` script (the existing `.claude/settings.json` hook calls `bun run format`).

### Out of scope

- Password reset, email verification, any email sending, change password, delete account, profile page, OAuth/social login, 2FA.
- Images, file uploads, embeds, **links inside notes**, tables, underline, horizontal rules, and any TipTap extension not listed in §6.
- Autosave, unsaved-changes warning, version history, share snapshots, `Ctrl+S` shortcut.
- Search, pagination, sorting options, tags, folders.
- Collaboration, real-time editing, sharing with specific users, letting others edit.
- Author info on shared pages.
- Landing page, dark mode **[ASSUMPTION]**, i18n (English only) **[ASSUMPTION]**.
- Deployment config, Docker, CI, automated E2E suite.
- ORMs and query builders in app code (better-auth uses Kysely internally; that is fine).
- `proxy.ts` / middleware **[ASSUMPTION]**.

---

## 3. Decisions

| ID  | Decision | Status |
| --- | -------- | ------ |
| D1  | A note has a separate, optional plain-text title. An empty title is displayed as "Untitled". | Confirmed |
| D2  | Edits are saved only via an explicit **Save** button. No autosave, no unsaved-changes warning. | Confirmed |
| D3  | The notes list shows all of the user's notes, last edited first (`updated_at DESC`): title, last-updated time, "Shared" badge. No search, no pagination. | Confirmed |
| D4  | Editor formatting: bold, italic, strike, inline code, H2, H3, bullet list, numbered list, blockquote, code block, hard break, undo/redo. No links. | Confirmed |
| D5  | Share URL is `/s/{token}`: a 32-char base64url token (24 random bytes), separate from the note id. | Confirmed |
| D6  | Disabling sharing deletes the token. Enabling again creates a new token, so old links stay dead. | Confirmed |
| D7  | The shared page shows the latest saved content (live, no snapshot). | Confirmed |
| D8  | The shared page shows title, "Last updated" and content only. No author info. | Confirmed |
| D9  | Sign-up asks only for email + password. better-auth's required `name` is set to the email. | Confirmed |
| D10 | Password rules are better-auth defaults: 8–128 characters. | Confirmed |
| D11 | Auth forms use the better-auth React client (`authClient`). Server code uses `auth.api.getSession()`. | Confirmed |
| D12 | Account features are limited to sign up, sign in and sign out. | Confirmed |
| D13 | Note mutations are Server Actions. The only route handler is better-auth's `/api/auth/[...all]`. | Confirmed |
| D14 | The shared page renders HTML on the server with `@tiptap/static-renderer`, using the same extension list as the editor. | Confirmed |
| D15 | `/notes/[id]` is the editor. There is no separate read-only view for the owner. | Confirmed |
| D16 | Delete is confirmed with native `confirm()`. | Confirmed |
| D17 | "New note" immediately inserts an empty note and redirects to `/notes/{id}`. | Confirmed |
| D18 | Limits: title ≤ 200 characters (after trim, JS `.length`); content ≤ 100 KB (102 400 bytes, UTF-8 of the normalized JSON string that is stored, see D40). Enforced on the server. | Confirmed |
| D19 | Pin the latest stable versions, except TypeScript 5.9.3 and ESLint 9.39.5 (TS 7 / ESLint 10 not verified with Next tooling). | Confirmed |
| D20 | Testing: `bun test` unit tests for logic + DB layer, plus a manual checklist (run via Playwright MCP). | Confirmed |
| D21 | Local only: `bun run build && bun run start`. No deadline. | Confirmed |
| D22 | `/` only redirects: signed in → `/notes`, signed out → `/sign-in`. | Confirmed |
| D23 | Prettier 3.9.9 + `prettier-plugin-tailwindcss`; `format` = `prettier --write .`. | Confirmed |
| D24 | A note that doesn't exist or belongs to another user returns 404 (`notFound()`), never 403. | [ASSUMPTION] |
| D25 | Every protected page calls `requireUser()`. Every Server Action calls `getCurrentUser()`. No layout-only checks, no `proxy.ts`. | [ASSUMPTION] |
| D26 | On save, content is parsed against the editor's ProseMirror schema and normalized. Unknown nodes, marks or attributes are rejected or dropped before storage. | [ASSUMPTION] |
| D27 | `note.id` = `crypto.randomUUID()`. App timestamps are INTEGER Unix milliseconds. | [ASSUMPTION] |
| D28 | Next.js runs on the Bun runtime (`bun --bun next …`), which `bun:sqlite` requires. | [ASSUMPTION] |
| D29 | One shared `Database` instance (`lib/db.ts`) is used by both the app and better-auth. | [ASSUMPTION] |
| D30 | After sign-in or sign-up the user always lands on `/notes`. There is no `?next=` return URL. | [ASSUMPTION] |
| D31 | Concurrent edits of the same note (two tabs): last save wins. | [ASSUMPTION] |
| D32 | Enabling or disabling sharing does not change `updated_at`. | [ASSUMPTION] |
| D33 | Dates are formatted on the server with `Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" })` in the server's local time zone, e.g. `Oct 10, 2026, 3:45 PM`. This is fine because deployment is local only. | [ASSUMPTION] |
| D34 | Rich-text styling is a small `.note-content` CSS block in `app/globals.css`, shared by the editor and the shared page. No `@tailwindcss/typography`. | [ASSUMPTION] |
| D35 | Toolbar buttons show short text labels (no icon library), each with a full `aria-label`. | [ASSUMPTION] |
| D36 | `dev`, `build` and `start` run `db:migrate` first. It checks the environment (`checkEnv`), creates `data/` and applies migrations, so the schema is always current and a fresh clone builds. A missing or invalid env stops the command with a message naming the variable. | [ASSUMPTION] |
| D37 | Messages: the editor page has two message regions, the editor's (Save, Delete) and the Sharing section's (share actions, copy failure). Each auth form has one. A region shows one message at a time. Starting an action clears its region. Errors stay until the next action in that region; "Saved" also clears on any edit (NOTE-8). | [ASSUMPTION] |
| D38 | Title and editor stay editable during a save. "Saved" is shown only if the title and content are unchanged since Save was clicked. Save and Delete are both disabled while either is pending. | [ASSUMPTION] |
| D39 | A note action call that rejects in the browser (network failure, server restart, request over Next's 1 MB limit, stale action after a rebuild) is shown as `INTERNAL`, and the pending state ends. | [ASSUMPTION] |
| D40 | The 100 KB limit applies to the normalized JSON that is stored. The editor checks it before sending (no request above the limit), the server checks it again after normalizing, and a DB `CHECK` enforces it. | [ASSUMPTION] |
| D41 | `deleteNoteAction` returns an `ActionResult` like the other note actions; on success the client calls `router.replace("/notes")`. No action called from client code redirects. Only `createNoteAction` (a form action) redirects on the server. | [ASSUMPTION] |
| D42 | The Sharing section's state comes from the page load, then only from its own action results. Disabling a note that is already private succeeds. | [ASSUMPTION] |
| D43 | Toolbar keyboard follows the WAI-ARIA toolbar pattern: one Tab stop, arrow keys move between buttons. Unavailable buttons use `aria-disabled` and stay focusable. | [ASSUMPTION] |
| D44 | Auth rate limits are set explicitly in `lib/auth.ts`: 5 requests per 60 s each for `/sign-in/email` and `/sign-up/email`. The limiter runs in production mode only (better-auth default). | [ASSUMPTION] |
| D45 | `openDatabase()` lives in `lib/open-database.ts`, which has no side effects. `lib/db.ts` imports it and exports the `db` singleton. Tests, `lib/testing/db.ts` and `scripts/migrate.ts` import only `lib/open-database.ts`, so they never open `DB_PATH` by accident. | Confirmed |
| D46 | `.prettierignore` lists `*.md` and `.claude/`. Gitignored paths are skipped by Prettier anyway. Code, CSS and JSON (including `prd.json`) are formatted. | Confirmed |
| D47 | Any auth form error clears the password field and keeps the email. | Confirmed |
| D48 | "Sign out" is disabled while its request is pending. If the request fails, the button is re-enabled and nothing else changes (no message). | Confirmed |

---

## 4. Tech stack

All versions are pinned exactly in `package.json` (no `^` or `~`).

| Package | Version | Role |
| ------- | ------- | ---- |
| Bun (runtime + package manager + test runner) | 1.3.12 | `"packageManager": "bun@1.3.12"` |
| `bun:sqlite` | built into Bun | Database driver |
| `next` | 16.4.0 | App Router, Server Actions |
| `react`, `react-dom` | 19.3.0 | UI |
| `better-auth` | 1.7.7 | Email/password auth, sessions |
| `@tiptap/core` | 3.31.4 | `getSchema`, types |
| `@tiptap/pm` | 3.31.4 | ProseMirror (`Node.fromJSON`) |
| `@tiptap/react` | 3.31.4 | Editor (`useEditor`, `EditorContent`, `useEditorState`) |
| `@tiptap/starter-kit` | 3.31.4 | Formatting extensions |
| `@tiptap/static-renderer` | 3.31.4 | Server-side JSON → HTML |
| `tailwindcss`, `@tailwindcss/postcss` | 4.3.3 | Styling |
| `typescript` (dev) | 5.9.3 | Type checking |
| `@types/bun` (dev) | 1.3.12 | Bun types |
| `@types/node` (dev) | 24.19.2 | Node types (Next requires them) |
| `@types/react`, `@types/react-dom` (dev) | 19.3.0 | React types |
| `eslint` (dev) | 9.39.5 | Linting |
| `eslint-config-next` (dev) | 16.4.0 | Next lint rules |
| `prettier` (dev) | 3.9.9 | Formatting |
| `prettier-plugin-tailwindcss` (dev) | 0.8.1 | Class sorting |

No other runtime dependencies. Adding one requires updating this spec.

### `package.json` scripts

```json
{
  "dev": "bun run db:migrate && bun --bun next dev",
  "build": "bun run db:migrate && bun --bun next build",
  "start": "bun run db:migrate && bun --bun next start",
  "lint": "eslint",
  "typecheck": "tsc --noEmit",
  "test": "bun test",
  "format": "prettier --write .",
  "db:migrate": "bun scripts/migrate.ts"
}
```

### Environment (`.env.example`)

```
BETTER_AUTH_SECRET=<random string, at least 32 characters>
BETTER_AUTH_URL=http://localhost:3000
DB_PATH=data/app.db
```

`.gitignore` must contain `data/` and must keep ignoring `.env*` while un-ignoring `!.env.example`.

Fresh clone: `bun install`, copy `.env.example` to `.env` and set a real secret, then `bun run build && bun run start` (or `bun run dev`). Without a valid `.env`, every one of those stops at `db:migrate` (D36).

---

## 5. Routes / screens

| Route | Kind | Access | Behavior |
| ----- | ---- | ------ | -------- |
| `/` | page | anyone | Signed in → redirect `/notes`. Signed out → redirect `/sign-in`. (NAV-1) |
| `/sign-up` | page | signed out | Sign-up form. Signed in → redirect `/notes`. |
| `/sign-in` | page | signed out | Sign-in form. Signed in → redirect `/notes`. |
| `/notes` | page | signed in | Notes list + "New note". Signed out → redirect `/sign-in`. |
| `/notes/[id]` | page | owner only | Editor. Signed out → redirect `/sign-in`. Missing or not owned → 404. |
| `/s/[token]` | page | anyone | Read-only shared note. Unknown, disabled or malformed token → 404 ("This note isn't available"). |
| `/api/auth/[...all]` | route handler | anyone | better-auth handler (`GET`, `POST`). |
| (any other) | `app/not-found.tsx` | anyone | Generic 404. |

Signed-in pages (`/notes`, `/notes/[id]`) share a header: **TinyNotes** (link to `/notes`), the user's email, and a **Sign out** button.

Page `<title>`s **[ASSUMPTION]**: `Create account – TinyNotes`, `Sign in – TinyNotes`, `Your notes – TinyNotes`, `{title or "Untitled"} – TinyNotes` (editor and shared page). The default is `TinyNotes`.

---

## 6. Functional requirements

Notation: **Given / input → result**. Quoted strings are exact UI copy. All error messages render in an element with `role="alert"`. Status messages use `role="status"`.

### Messages

- **MSG-1** Message regions (D37). The editor page has an editor region next to "Save"/"Delete" (results of Save and Delete) and a Sharing region inside the Sharing section (results of "Create share link" and "Disable link", and copy failures). Each auth form has one region above its submit button. Each region always renders an empty `role="status"` element and an empty `role="alert"` element, so screen readers announce what is put in them later.
- **MSG-2** A region shows at most one message. Starting an action clears its region, and the action's result replaces it. An error stays until the next action in the same region, even while the user edits. "Saved" also clears on edit (NOTE-8).

### Navigation

- **NAV-1** Signed-in user opens `/` → redirected to `/notes`. Signed-out user opens `/` → redirected to `/sign-in`.

### Authentication

- **AUTH-1** `/sign-up` shows heading "Create your account", fields "Email" (`type="email"`, required) and "Password" (`type="password"`, required, `minlength=8`, `maxlength=128`, hint "At least 8 characters."), a button "Create account", and the text "Already have an account?" with a link "Sign in" → `/sign-in`.
- **AUTH-2** A new email and an 8–128 char password, then "Create account" → the user is created with `name = email`, signed in (better-auth `autoSignIn`), and redirected to `/notes`.
- **AUTH-3** An email that is already registered → the user stays on `/sign-up` and sees "An account with this email already exists." The email field keeps its value; the password field is cleared (D47).
- **AUTH-4** A password outside 8–128 chars → native validation blocks submit. If it is bypassed, the server's `PASSWORD_TOO_SHORT` / `PASSWORD_TOO_LONG` → "Password must be 8–128 characters."
- **AUTH-5** An invalid email → native validation blocks submit. If it is bypassed, the server's `INVALID_EMAIL` → "Enter a valid email address."
- **AUTH-6** `/sign-in` shows heading "Sign in to TinyNotes", fields "Email" and "Password", a button "Sign in", and the text "No account yet?" with a link "Create one" → `/sign-up`.
- **AUTH-7** Correct credentials → redirected to `/notes`.
- **AUTH-8** Wrong password **or** unknown email → "Invalid email or password." The message is identical in both cases. The password field is cleared (D47).
- **AUTH-9** While a sign-up or sign-in request is pending, the submit button is disabled and reads "Creating account…" or "Signing in…".
- **AUTH-10** Click "Sign out" → the session is revoked and the user is redirected to `/sign-in`. Opening `/notes` afterwards redirects to `/sign-in`. While pending the button is disabled; if the request fails, it is re-enabled and nothing else changes (D48).
- **AUTH-11** A signed-in user opening `/sign-in` or `/sign-up` → redirected to `/notes`.
- **AUTH-12** A signed-out user opening `/notes` or `/notes/{any id}` → redirected to `/sign-in`.
- **AUTH-13** Email is case-insensitive: sign up with `Ada@Example.com`, then sign in with `ada@example.com` → success (better-auth lowercases emails).
- **AUTH-14** HTTP 429 from better-auth's rate limiter (D44) → "Too many attempts. Please wait a minute and try again." Any other error or a network failure → "Something went wrong. Please try again."

### Notes

- **NOTE-1** `/notes` shows heading "Your notes" and a "New note" button. Each note is a row linking to `/notes/{id}`, showing the title (or "Untitled" if empty), "Updated {date}" (D33), and a "Shared" badge when the note has an active share link. Rows are ordered by `updated_at` descending.
- **NOTE-2** A user with no notes sees "No notes yet. Create your first one." and the "New note" button.
- **NOTE-3** User A never sees user B's notes in the list.
- **NOTE-4** Click "New note" → a note is created with title `""` and content `{"type":"doc","content":[{"type":"paragraph"}]}`, and the browser navigates to `/notes/{newId}`. The new note appears at the top of `/notes`.
- **NOTE-5** `/notes/{id}` (owner) shows: a link "← All notes" → `/notes`; a title input (`aria-label="Title"`, placeholder "Untitled", `maxlength=200`) prefilled with the saved title; the formatting toolbar; the editor (`aria-label="Note content"`) prefilled with the saved content; a "Save" button; a "Delete" button; and the Sharing section (SHARE-1).
- **NOTE-6** The toolbar (`role="toolbar"`, `aria-label="Formatting"`) has these buttons (visible label → `aria-label`): `B` → "Bold", `I` → "Italic", `S` → "Strikethrough", `<>` → "Inline code", `H2` → "Heading 2", `H3` → "Heading 3", `• List` → "Bullet list", `1. List` → "Numbered list", `Quote` → "Quote", `Code` → "Code block", `Undo` → "Undo", `Redo` → "Redo". Clicking a format button toggles that format on the selection.
  - **Pressed state.** Format buttons (all except Undo and Redo) have `aria-pressed`, which is `"true"` exactly when TipTap's `editor.isActive()` is true for that format. For a range, that means the whole range has it (partly bold → `"false"`). For a collapsed cursor, it means typing would apply it.
  - **Disabled state.** A button whose command can't run at the current selection (TipTap `editor.can()`) has `aria-disabled="true"` and does nothing when clicked. Examples: Bold inside a code block; Undo/Redo with nothing to undo or redo.
  - **Keyboard (D43).** The toolbar is a single Tab stop; Tab returns to the button that last had focus. ←/→ move focus to the previous/next button, wrapping at the ends. Home/End go to the first/last button. Buttons with `aria-disabled` stay focusable.
  - StarterKit keyboard shortcuts work (e.g. `Ctrl/Cmd+B`).
- **NOTE-7** Click "Save" → the title (trimmed) and content as they are at the click are saved, and `updated_at` is set to now. While pending, "Save" reads "Saving…", and "Save" and "Delete" are disabled. The title and editor stay editable (D38). On success, the status "Saved" appears only if the title and content haven't changed since the click. Otherwise no status appears, because the newer edits aren't saved. On failure, the error appears in the editor's message region (MSG-1).
- **NOTE-8** After "Saved" is shown, any change to the title or content clears it. Errors don't clear on edit (MSG-2).
- **NOTE-9** Reloading `/notes/{id}` after a save shows exactly the saved title and formatting.
- **NOTE-10** A title that is whitespace only → saved as `""` and displayed as "Untitled" in the list.
- **NOTE-11** A title longer than 200 characters (bypassing `maxlength`) → "Title must be 200 characters or fewer." Nothing is saved.
- **NOTE-12** Content whose JSON is larger than 100 KB → "This note is too large to save (max 100 KB)." Nothing is saved. The editor checks the size before sending, so no request is made. That makes this hold at any size, including above Next's 1 MB request limit (D40). The server checks again.
- **NOTE-13** Content that fails schema validation (invalid JSON, root not `doc`, an unknown node such as `image`, an unknown mark such as `link`) → "This note contains unsupported content and couldn't be saved." Nothing is saved.
- **NOTE-14** Click "Delete" → `confirm("Delete this note? This can't be undone.")`. Cancel → nothing changes. OK → while pending, "Delete" reads "Deleting…", and "Save" and "Delete" are disabled (D38). On success, the note is deleted and the browser goes to `/notes` with `router.replace` (D41), where the note is gone. Its share link (if any) now returns 404. On failure, the error appears in the editor's message region.
- **NOTE-15** `/notes/{id}` for a non-existent id or another user's note → the generic 404 page (D24). A Server Action called with such an id → `NOT_FOUND`, and no data changes.
- **NOTE-16** Saving a note does not change its share state.

### Sharing

- **SHARE-1** The editor page has a section with heading "Sharing". If the note is not shared, it shows "This note is private." and a button "Create share link".
- **SHARE-2** Click "Create share link" (pending label "Creating link…") → a token is created. The section then shows "Anyone with this link can view this note.", a read-only input (`aria-label="Share link"`) containing `{BETTER_AUTH_URL}/s/{token}`, a "Copy link" button, and a "Disable link" button. The note now shows the "Shared" badge on `/notes`.
- **SHARE-3** Click "Copy link" → the URL is written to the clipboard and the button reads "Copied!" for 2 seconds **[ASSUMPTION]**. If the clipboard write fails → "Couldn't copy. Select the link and copy it manually." in the Sharing region (MSG-1).
- **SHARE-4** Click "Disable link" (pending label "Disabling…", no confirmation **[ASSUMPTION]**) → the token is removed and the section returns to the SHARE-1 state. The old URL returns 404 immediately. Disabling a note that is already private (e.g. disabled in another tab) succeeds the same way (D42).
- **SHARE-5** Enable → disable → enable → the new token differs from the first one. The first URL still returns 404.
- **SHARE-6** Enabling sharing on a note that is already shared returns the existing token unchanged (idempotent, e.g. after a double click).
- **SHARE-7** The Sharing section shows the share state from page load, then only what its own actions return (D42). It doesn't update when another tab changes sharing. It catches up on its next action or a reload.

### Public shared view

- **PUB-1** `/s/{valid token}` (signed in or not, any user) → HTTP 200 page showing the note title as `<h1>` ("Untitled" if empty), "Last updated {date}" (from `updated_at`), the content rendered as HTML, and the footer "Shared with TinyNotes". There are no edit controls, no owner email/name, no note id and no user id anywhere in the HTML.
- **PUB-2** `/s/{token}` where the token is malformed (doesn't match `^[A-Za-z0-9_-]{32}$`), unknown, disabled, or its note was deleted → HTTP 404 page with heading "This note isn't available" and text "The link may be wrong, or the owner stopped sharing it." Malformed tokens are rejected without a DB query.
- **PUB-3** The owner edits and saves the note → reloading the shared page shows the new content.
- **PUB-4** The rendered HTML contains only these tags: `p`, `h2`, `h3`, `strong`, `em`, `s`, `code`, `pre`, `blockquote`, `ul`, `ol`, `li`, `br`. All text and attribute values are HTML-escaped.
- **PUB-5** The shared page sets `<meta name="robots" content="noindex, nofollow">` **[ASSUMPTION]**.

---

## 7. Error handling

### Server Action result

```ts
// lib/errors.ts
export type ErrorCode =
  | "UNAUTHENTICATED"
  | "NOT_FOUND"
  | "TITLE_TOO_LONG"
  | "CONTENT_TOO_LARGE"
  | "INVALID_CONTENT"
  | "INTERNAL";

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: ErrorCode };

export const ERROR_MESSAGES: Record<ErrorCode, string>;
```

| Code | When | User sees |
| ---- | ---- | --------- |
| `UNAUTHENTICATED` | Session missing or expired when an action runs | "Your session has expired. Sign in again to continue." plus a link "Sign in" → `/sign-in` that opens in a new tab, so unsaved edits stay in the current tab and Save can be retried **[ASSUMPTION]** |
| `NOT_FOUND` | Note missing or not owned | "This note no longer exists." |
| `TITLE_TOO_LONG` | Trimmed title > 200 chars | "Title must be 200 characters or fewer." |
| `CONTENT_TOO_LARGE` | Normalized content JSON > 102 400 bytes (D40); also set by the editor before sending | "This note is too large to save (max 100 KB)." |
| `INVALID_CONTENT` | Content not valid JSON or fails schema check | "This note contains unsupported content and couldn't be saved." |
| `INTERNAL` | Any unexpected exception on the server (logged with `console.error`, details never sent to client), or the action call itself rejecting in the browser (D39, `callAction`) | "Something went wrong. Please try again." |

### Auth errors (client, `lib/auth-errors.ts`)

| better-auth `error.code` / status | User sees |
| --------------------------------- | --------- |
| `INVALID_EMAIL_OR_PASSWORD` | "Invalid email or password." |
| `USER_ALREADY_EXISTS` or `USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL` | "An account with this email already exists." |
| `PASSWORD_TOO_SHORT` or `PASSWORD_TOO_LONG` | "Password must be 8–128 characters." |
| `INVALID_EMAIL` | "Enter a valid email address." |
| status 429 | "Too many attempts. Please wait a minute and try again." |
| anything else, or a network error | "Something went wrong. Please try again." |

The exact duplicate-email code must be checked against better-auth 1.7.7's `BASE_ERROR_CODES` during implementation. Both names are mapped either way.

### Page-level errors

| Case | File | User sees |
| ---- | ---- | --------- |
| Generic 404 | `app/not-found.tsx` | Heading "Page not found", text "This page doesn't exist or you don't have access to it.", link "Go to TinyNotes" → `/` |
| Shared-link 404 | `app/s/[token]/not-found.tsx` | See PUB-2 |
| Unhandled render error | `app/error.tsx` (client) | Heading "Something went wrong", button "Try again" (calls `reset()`) |

---

## 8. Data model (SQL)

Migrations are plain `.sql` files in `db/migrations/`, applied in filename order by `scripts/migrate.ts`. Each file runs in one transaction and is recorded in `_migrations`. Applied files are never edited; changes go in a new file.

### `_migrations` (created by the migration runner)

```sql
CREATE TABLE IF NOT EXISTS _migrations (
  name       TEXT PRIMARY KEY NOT NULL,
  applied_at INTEGER NOT NULL
);
```

### `db/migrations/0001_better_auth.sql`

This is better-auth's required core schema. Table and column names must match what better-auth 1.7.7 expects. Verify it in M0 by diffing against the output of the better-auth CLI `generate` command for the SQLite/Kysely adapter. If they differ, the generated output wins.

```sql
CREATE TABLE "user" (
  "id"            TEXT NOT NULL PRIMARY KEY,
  "name"          TEXT NOT NULL,
  "email"         TEXT NOT NULL UNIQUE,
  "emailVerified" INTEGER NOT NULL,
  "image"         TEXT,
  "createdAt"     DATE NOT NULL,
  "updatedAt"     DATE NOT NULL
);

CREATE TABLE "session" (
  "id"        TEXT NOT NULL PRIMARY KEY,
  "expiresAt" DATE NOT NULL,
  "token"     TEXT NOT NULL UNIQUE,
  "createdAt" DATE NOT NULL,
  "updatedAt" DATE NOT NULL,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "userId"    TEXT NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE
);

CREATE TABLE "account" (
  "id"                    TEXT NOT NULL PRIMARY KEY,
  "accountId"             TEXT NOT NULL,
  "providerId"            TEXT NOT NULL,
  "userId"                TEXT NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  "accessToken"           TEXT,
  "refreshToken"          TEXT,
  "idToken"               TEXT,
  "accessTokenExpiresAt"  DATE,
  "refreshTokenExpiresAt" DATE,
  "scope"                 TEXT,
  "password"              TEXT,
  "createdAt"             DATE NOT NULL,
  "updatedAt"             DATE NOT NULL
);

CREATE TABLE "verification" (
  "id"         TEXT NOT NULL PRIMARY KEY,
  "identifier" TEXT NOT NULL,
  "value"      TEXT NOT NULL,
  "expiresAt"  DATE NOT NULL,
  "createdAt"  DATE NOT NULL,
  "updatedAt"  DATE NOT NULL
);

CREATE INDEX "session_userId_idx" ON "session" ("userId");
CREATE INDEX "account_userId_idx" ON "account" ("userId");
CREATE INDEX "verification_identifier_idx" ON "verification" ("identifier");
```

App code never reads or writes auth tables directly. The only link is the `note.user_id` foreign key.

### `db/migrations/0002_note.sql`

```sql
CREATE TABLE note (
  id          TEXT PRIMARY KEY NOT NULL,              -- crypto.randomUUID()
  user_id     TEXT NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  title       TEXT NOT NULL DEFAULT '' CHECK (length(title) <= 200),
  content     TEXT NOT NULL CHECK (json_valid(content) AND length(CAST(content AS BLOB)) <= 102400),  -- TipTap JSON (normalized), ≤ 102 400 UTF-8 bytes (D40)
  share_token TEXT UNIQUE,                            -- NULL = not shared
  created_at  INTEGER NOT NULL,                       -- Unix ms
  updated_at  INTEGER NOT NULL                        -- Unix ms; changes only on save
) STRICT;

CREATE INDEX note_user_updated_idx ON note (user_id, updated_at DESC);
```

`UNIQUE` on `share_token` allows many `NULL`s in SQLite, so only active tokens must be unique.

### Connection settings (`lib/db.ts`, every connection)

`PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;` (WAL is skipped for `:memory:`).

---

## 9. Server/client design

### File layout

```
app/
  layout.tsx                    root layout, imports globals.css
  globals.css                   Tailwind + .note-content styles (D34)
  page.tsx                      NAV-1 redirect
  not-found.tsx                 generic 404
  error.tsx                     "use client" error boundary
  sign-in/page.tsx              AUTH-6..8 (renders <AuthForm mode="sign-in">)
  sign-up/page.tsx              AUTH-1..5 (renders <AuthForm mode="sign-up">)
  notes/page.tsx                NOTE-1..3
  notes/[id]/page.tsx           NOTE-5, NOTE-15
  s/[token]/page.tsx            PUB-1..5
  s/[token]/not-found.tsx       PUB-2
  api/auth/[...all]/route.ts    better-auth handler
components/
  app-header.tsx                server: "TinyNotes", email, <SignOutButton>
  sign-out-button.tsx           "use client"
  auth-form.tsx                 "use client"
  message-region.tsx            empty role="status" + role="alert" pair, shows one message (MSG-1/2)
  new-note-button.tsx           server: <form action={createNoteAction}>
  note-editor.tsx               "use client": title, toolbar, editor, Save, Delete
  editor-toolbar.tsx            "use client"
  share-panel.tsx               "use client"
  note-content.tsx              server: renders sanitized HTML
lib/
  open-database.ts              openDatabase(), no side effects (D45)
  db.ts                         Database singleton
  env.ts                        checkEnv (D36)
  migrate.ts                    migration runner (pure, testable)
  auth.ts                       betterAuth instance
  auth-client.ts                createAuthClient
  auth-errors.ts                auth error → message
  session.ts                    getCurrentUser, requireUser
  errors.ts                     ErrorCode, ActionResult, ERROR_MESSAGES
  call-action.ts                callAction: rejected action call → INTERNAL (D39)
  format-date.ts                formatDateTime
  share-token.ts                token generation + format check + URL
  notes/limits.ts               TITLE_MAX_LENGTH, CONTENT_MAX_BYTES, utf8ByteLength (browser + server)
  notes/editor-extensions.ts    single extension list (editor, validation, render)
  notes/validation.ts           validateNoteInput
  notes/render.ts               renderNoteHtml
  notes/repo.ts                 raw SQL functions
  notes/actions.ts              "use server" actions
  testing/db.ts                 test helpers: createTestDb() (":memory:" + migrate), insertTestUser(db, email?)
db/migrations/                  0001_better_auth.sql, 0002_note.sql
scripts/migrate.ts              CLI wrapper around lib/migrate.ts
```

Unit tests are colocated as `*.test.ts` next to the module **[ASSUMPTION]**.

### Signatures

```ts
// lib/open-database.ts — no side effects on import (D45)
import { Database } from "bun:sqlite";
export function openDatabase(path: string): Database; // applies PRAGMAs (§8)

// lib/db.ts — importing this opens DB_PATH; only app code (pages, actions, lib/auth.ts) imports it
export const db: Database; // openDatabase(process.env.DB_PATH ?? "data/app.db"),
                           // cached on globalThis in dev to survive HMR

// lib/env.ts
export function checkEnv(env: Record<string, string | undefined>): string[]; // problems; [] when OK
// BETTER_AUTH_SECRET missing or < 32 chars, BETTER_AUTH_URL missing → one message each,
// naming the variable and pointing to .env.example.

// lib/migrate.ts
export function migrate(db: Database, dir: string): string[]; // returns names newly applied

// scripts/migrate.ts — checkEnv(process.env) first: on problems, prints them and exits 1 (D36).
// Then ensures dirname(DB_PATH) exists, opens DB with openDatabase() from lib/open-database.ts (D45), migrate(db, "db/migrations"),
// prints applied names, exits 1 on failure.

// lib/auth.ts
export const auth = betterAuth({
  database: db,
  emailAndPassword: { enabled: true, autoSignIn: true }, // default 8–128 password length
  rateLimit: {
    // D44; the limiter itself stays production-only (better-auth default)
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 60, max: 5 },
    },
  },
});

// app/api/auth/[...all]/route.ts
export const { GET, POST } = toNextJsHandler(auth); // from "better-auth/next-js"

// lib/auth-client.ts
export const authClient = createAuthClient(); // from "better-auth/react", same origin

// lib/auth-errors.ts
export function authErrorMessage(error: { code?: string; status?: number } | null): string;

// lib/session.ts
export type CurrentUser = { id: string; email: string };
export const getCurrentUser: () => Promise<CurrentUser | null>; // React cache(); auth.api.getSession({ headers: await headers() })
export async function requireUser(): Promise<CurrentUser>; // redirect("/sign-in") when null (pages only)

// lib/share-token.ts
export const SHARE_TOKEN_PATTERN: RegExp; // /^[A-Za-z0-9_-]{32}$/
export function generateShareToken(): string; // 24 bytes from crypto.getRandomValues → base64url
export function isShareTokenFormat(value: string): boolean;
export function buildShareUrl(token: string, baseUrl?: string): string; // default process.env.BETTER_AUTH_URL

// lib/call-action.ts
export async function callAction<T>(run: () => Promise<ActionResult<T>>): Promise<ActionResult<T>>;
// Returns run()'s result. If the call rejects (network failure, server restart, request over the
// 1 MB limit, stale action after a rebuild) → console.error + { ok: false, error: "INTERNAL" } (D39).
// The wrapped actions never redirect (D41), so there is nothing to rethrow.

// lib/format-date.ts
export function formatDateTime(ms: number, timeZone?: string): string; // D33

// lib/notes/editor-extensions.ts
export const editorExtensions = [
  StarterKit.configure({
    heading: { levels: [2, 3] },
    link: false,
    underline: false,
    horizontalRule: false,
  }),
];
export const EMPTY_DOC: JSONContent; // { type: "doc", content: [{ type: "paragraph" }] }

// lib/notes/limits.ts — no imports; used by the editor (browser) and validation (server)
export const TITLE_MAX_LENGTH = 200;
export const CONTENT_MAX_BYTES = 102_400;
export function utf8ByteLength(value: string): number; // new TextEncoder().encode(value).length

// lib/notes/validation.ts
export type NoteInput = { title: string; content: string }; // content = JSON string
export type ValidatedNoteInput = { title: string; content: string }; // trimmed title, normalized JSON
export function validateNoteInput(
  input: NoteInput,
): { ok: true; value: ValidatedNoteInput } | { ok: false; error: "TITLE_TOO_LONG" | "CONTENT_TOO_LARGE" | "INVALID_CONTENT" };
// Order: non-string fields → INVALID_CONTENT; title.trim().length > TITLE_MAX_LENGTH → TITLE_TOO_LONG;
// JSON.parse fails, root.type !== "doc", or Node.fromJSON(getSchema(editorExtensions), json).check()
// throws → INVALID_CONTENT; normalized = JSON.stringify(node.toJSON());
// utf8ByteLength(normalized) > CONTENT_MAX_BYTES → CONTENT_TOO_LARGE (D40); value.content = normalized.
// Parsing before the size check is safe: Next's 1 MB request limit bounds the input.

// lib/notes/render.ts
export function renderNoteHtml(content: JSONContent): string;
// renderToHTMLString({ extensions: editorExtensions, content }) from "@tiptap/static-renderer/pm/html-string"

// lib/notes/repo.ts — every query uses ? parameters; every owner query has `AND user_id = ?`
export type Note = { id: string; title: string; content: JSONContent; shareToken: string | null; createdAt: number; updatedAt: number };
export type NoteSummary = { id: string; title: string; updatedAt: number; isShared: boolean };
export type SharedNote = { title: string; content: JSONContent; updatedAt: number };
export function listNotes(db: Database, userId: string): NoteSummary[];           // ORDER BY updated_at DESC
export function getNote(db: Database, userId: string, id: string): Note | null;
export function createNote(db: Database, userId: string, now?: number): Note;     // title "", EMPTY_DOC
export function updateNote(db: Database, userId: string, id: string, input: ValidatedNoteInput, now?: number): boolean;
export function deleteNote(db: Database, userId: string, id: string): boolean;
export function enableShare(db: Database, userId: string, id: string, token: string): string | null;
// UPDATE note SET share_token = COALESCE(share_token, ?) WHERE id = ? AND user_id = ? RETURNING share_token
export function disableShare(db: Database, userId: string, id: string): boolean;
// UPDATE note SET share_token = NULL WHERE id = ? AND user_id = ?
// → true when the note exists and is owned, whether or not it was shared (D42); false otherwise.
export function getSharedNote(db: Database, token: string): SharedNote | null;

// lib/notes/actions.ts — "use server".
// saveNoteAction, deleteNoteAction, enableShareAction, disableShareAction: getCurrentUser() → UNAUTHENTICATED;
// repo call; revalidatePath as noted; unexpected errors → console.error + INTERNAL. They always return an
// ActionResult and never redirect (D41). Client code calls them through callAction().
// createNoteAction is the only form action: no user → redirect("/sign-in"); else redirect(`/notes/${id}`).
// It has no try/catch, so redirect() works and an unexpected error reaches app/error.tsx.
export async function createNoteAction(): Promise<void>;
export async function saveNoteAction(id: string, input: NoteInput): Promise<ActionResult<{ updatedAt: number }>>; // revalidatePath("/notes") + note path
export async function deleteNoteAction(id: string): Promise<ActionResult>;
// No revalidatePath: it would re-render the current page, which is now a 404. The client then calls
// router.replace("/notes"); /notes is dynamic, so it is fetched fresh.
export async function enableShareAction(id: string): Promise<ActionResult<{ shareUrl: string }>>; // revalidatePath("/notes") + note path
export async function disableShareAction(id: string): Promise<ActionResult>; // revalidatePath("/notes") + note path
```

### Components

```tsx
export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }): JSX.Element;
// calls authClient.signUp.email({ email, password, name: email }) or authClient.signIn.email({ email, password });
// on success router.push("/notes") + router.refresh(); on error shows authErrorMessage(error).

export function NoteEditor({ note }: { note: { id: string; title: string; content: JSONContent } }): JSX.Element;
// useEditor({ extensions: editorExtensions, content: note.content, immediatelyRender: false,
//   editorProps: { attributes: { class: "note-content", "aria-label": "Note content" } } })
// Save: content = JSON.stringify(editor.getJSON()). If utf8ByteLength(content) > CONTENT_MAX_BYTES → show
// CONTENT_TOO_LARGE and send nothing (D40). Else callAction(() => saveNoteAction(note.id, { title, content })).
// An edit counter, bumped on every title or editor change, is read at the click; on success "Saved" is
// shown only if it hasn't moved (D38).
// Delete: confirm() → callAction(() => deleteNoteAction(note.id)) → on ok, router.replace("/notes") (D41).

export function EditorToolbar({ editor }: { editor: Editor }): JSX.Element;
// useEditorState for isActive()/can() per button; roving tabindex for the keyboard model (D43).
export function SharePanel({ noteId, initialShareUrl }: { noteId: string; initialShareUrl: string | null }): JSX.Element;
// shareUrl state starts from initialShareUrl, then changes only from its own action results:
// enable → data.shareUrl, disable → null (D42). Later prop changes from revalidation are ignored.
export function NoteContent({ content }: { content: JSONContent }): JSX.Element;
// <div className="note-content" dangerouslySetInnerHTML={{ __html: renderNoteHtml(content) }} />
// This is the ONLY dangerouslySetInnerHTML in the app.
```

### Rendering and data flow

- Pages are Server Components that read via `repo.*` with `db` directly (no fetch to own API).
- `/notes/[id]/page.tsx`: `requireUser()` → `getNote()` → `notFound()` if null → `<NoteEditor>` + `<SharePanel initialShareUrl={shareToken ? buildShareUrl(shareToken) : null}>`.
- `/s/[token]/page.tsx`: `isShareTokenFormat()` → `getSharedNote()` → `notFound()` if either fails → `<NoteContent>`. No session lookup.

---

## 10. Security

- **Passwords and sessions**: better-auth handles hashing and sessions. Session cookies are `HttpOnly` and `SameSite=Lax` (better-auth defaults, checked in the manual checklist). `Secure` isn't required, because the app is only served over plain HTTP on `localhost` (D21). If it is ever served over HTTPS, set better-auth's `advanced.useSecureCookies: true`. `BETTER_AUTH_SECRET` is at least 32 chars, lives only in `.env`, and is never committed. The value in `.env.example` is a placeholder, not a real secret.
- **Authentication boundary**: Server Actions are public HTTP endpoints. Every action re-checks the session itself (D25). Pages check with `requireUser()`; layouts are not trusted for auth.
- **Authorization**: every owner query is scoped `WHERE id = ? AND user_id = ?`. A note that isn't owned looks exactly like a missing one (404 / `NOT_FOUND`), so note existence never leaks.
- **SQL injection**: only parameterized statements (`db.query(sql).get/all/run(...params)`). Values are never interpolated into SQL strings.
- **XSS**: content is validated against the editor schema and normalized before storage (D26). It is rendered only via TipTap's static renderer, which emits schema tags only (PUB-4). There are no links in the schema, so no `href`/`javascript:` surface. `NoteContent` is the only `dangerouslySetInnerHTML`. Titles are rendered as React text, never as HTML.
- **Share tokens**: 192 bits from a CSPRNG. `UNIQUE` in the DB. The format is checked before lookup. Revocation is immediate, and re-enabling issues a new token. Shared pages expose no owner data, note id or user id, and set `noindex, nofollow`.
- **CSRF**: the app relies on framework defaults and doesn't test them itself. better-auth checks `Origin` against `BETTER_AUTH_URL` for its endpoints, and Next.js Server Actions compare `Origin` with `Host`. The checkable rule is that nothing weakens them: no `trustedOrigins` option in `lib/auth.ts` and no `serverActions.allowedOrigins` in `next.config.ts`.
- **Input limits**: title ≤ 200; content ≤ 100 KB of normalized JSON (D40), checked in the browser and on the server. DB `CHECK`s enforce both limits. The Next.js default Server Action body limit (1 MB) stays unchanged. Requests over it fail as in D39.
- **Rate limiting**: better-auth's built-in limiter (production mode only, in-memory) covers auth endpoints. Explicit rules: 5 requests per 60 s each for sign-in and sign-up (D44), checked in the manual checklist. Note actions are not rate limited **[ASSUMPTION]**.
- **Email enumeration**: sign-in gives the same message for unknown email and wrong password. Sign-up necessarily reveals "already exists"; that is accepted for a demo with no email verification.
- **Headers** **[ASSUMPTION]**: `next.config.ts` `headers()` adds `X-Content-Type-Options: nosniff` and `X-Frame-Options: DENY` to all routes, and `Referrer-Policy: no-referrer` to `/s/:path*`.
- **Errors**: clients receive only `ErrorCode`s. Stack traces and SQL errors are logged on the server only.

---

## 11. Testing

### Commands

`bun test` · `bun run lint` · `bun run typecheck` · `bun run build`

### Unit tests (`bun test`)

DB tests use `openDatabase(":memory:")` (from `lib/open-database.ts`, never `lib/db.ts`, D45) + `migrate(db, "db/migrations")`, via `createTestDb()` in `lib/testing/db.ts`, and insert `user` rows directly as fixtures with `insertTestUser()`.

| File | Cases |
| ---- | ----- |
| `lib/migrate.test.ts` | Fresh DB applies `0001`, `0002` in order and returns both names. A second run applies nothing. A failing migration (temp dir with bad SQL) rolls back and is not recorded in `_migrations`. |
| `lib/share-token.test.ts` | Token is 32 chars and matches `SHARE_TOKEN_PATTERN`. 1 000 tokens are unique. `isShareTokenFormat` rejects 31/33 chars, `+`, `/` and `=`. `buildShareUrl("abc…", "http://x")` → `http://x/s/abc…`. |
| `lib/notes/validation.test.ts` | 200-char title OK; 201 → `TITLE_TOO_LONG`; `"  hi  "` → `"hi"`; `"   "` → `""`; a doc whose normalized JSON is exactly 102 400 bytes → ok and 102 401 → `CONTENT_TOO_LARGE` (multi-byte chars counted as bytes); input under the limit that grows past it when normalized (many `{"type":"heading"}` nodes without attrs) → `CONTENT_TOO_LARGE` (D40); `"not json"` → `INVALID_CONTENT`; root `paragraph` → `INVALID_CONTENT`; `image` node → `INVALID_CONTENT`; `link` mark → `INVALID_CONTENT`; a valid doc using every D4 format → ok, and unknown attrs are dropped. |
| `lib/notes/repo.test.ts` | `createNote` defaults (title `""`, `EMPTY_DOC`, timestamps = `now`). `listNotes` order by `updated_at` desc and scoped to user. `getNote` for another user → `null`. `updateNote` for another user → `false` and the row is unchanged. `updateNote` sets `updated_at` and keeps `share_token`. `deleteNote` for another user → `false`. `enableShare` twice → same token. `enableShare` on another user's note → `null`. `disableShare` → `getSharedNote(oldToken)` = `null`. `disableShare` on an owned note that isn't shared → `true`; on another user's note → `false` (D42). A direct `INSERT` with content over 102 400 bytes fails the `CHECK` (D40). Re-enable with a new token → new token returned. `getSharedNote` after `deleteNote` → `null`. Deleting a `user` row cascades to their notes. Share toggles don't change `updated_at`. |
| `lib/notes/render.test.ts` | Each D4 node/mark renders its expected tag (PUB-4). Text `<script>alert(1)</script>` is escaped. A code-block `language` attr containing `"><img src=x onerror=alert(1)>` is escaped. Output for a doc using every format contains no tags outside the PUB-4 list. |
| `lib/auth-errors.test.ts` | Every row of the §7 auth table, plus `null` / unknown code → generic message. |
| `lib/call-action.test.ts` | A resolved `{ ok: true }` or `{ ok: false }` result is returned unchanged. A rejected call → `{ ok: false, error: "INTERNAL" }` (D39). |
| `lib/env.test.ts` | Valid env → `[]`. Missing secret, 31-char secret and missing URL → one message each, naming the variable (D36). |
| `lib/format-date.test.ts` | `formatDateTime(Date.UTC(2026, 9, 10, 15, 45), "UTC")` → `"Oct 10, 2026, 3:45 PM"`. |

React components and Server Actions are thin. The manual checklist covers them.

### Manual acceptance checklist (Playwright MCP, fresh DB)

Steps marked **(slow)** run with every POST request delayed by 1.5 s, so pending states can be seen (AUTH-9, NOTE-7, NOTE-14, SHARE-2, SHARE-4). Turn the delay on with Playwright MCP's run-code tool: `await page.route("**/*", async (route) => { if (route.request().method() === "POST") await new Promise((r) => setTimeout(r, 1500)); await route.continue(); })`. Turn it off with `await page.unroute("**/*")`. Routes apply per tab.

1. `/` signed out → `/sign-in` (NAV-1).
2. **(slow)** Sign-up page copy matches AUTH-1. Sign up `ada@example.com` / `password123` → `/notes` with "No notes yet. Create your first one." (AUTH-2, NOTE-2).
3. During that submission, the button was disabled and read "Creating account…" (AUTH-9).
4. Sign out → `/sign-in`. `/notes` → `/sign-in` (AUTH-10, AUTH-12).
5. Sign up again with `ada@example.com` → "An account with this email already exists." (AUTH-3).
6. Sign in with a wrong password → "Invalid email or password." Same with `nobody@example.com` (AUTH-8).
7. **(slow)** Sign in with `ADA@example.com` / `password123` → the button is disabled and reads "Signing in…", then `/notes` (AUTH-7, AUTH-9, AUTH-13). Visit `/sign-in` → `/notes` (AUTH-11). `/` → `/notes` (NAV-1).
8. "New note" → `/notes/{id}` with empty title, "Sharing" section, "This note is private." (NOTE-4, NOTE-5, SHARE-1).
9. Use every toolbar button. Check `aria-pressed` toggles and that Undo/Redo work (NOTE-6). Select a half-bold range → Bold has `aria-pressed="false"`. Inside a code block, Bold has `aria-disabled="true"` and clicking it does nothing. Tab into the toolbar → focus lands on one button; ←/→ move between buttons and wrap; Home/End jump to the ends; Tab leaves the toolbar (D43).
10. **(slow)** Type title "Groceries", click Save → "Saving…" with Save and Delete disabled, then "Saved". Type a character → "Saved" disappears (NOTE-7, NOTE-8). Click Save and type a character while "Saving…" shows → no "Saved" when it finishes. Save again → "Saved" (D38).
11. Reload → same title and formatting (NOTE-9). `/notes` lists "Groceries" first with "Updated …" (NOTE-1).
12. Create a second note, save it with title "   " → it is listed as "Untitled" and above "Groceries" (NOTE-10, NOTE-1 ordering).
13. Via devtools, remove `maxlength` and save a 201-char title → "Title must be 200 characters or fewer." (NOTE-11). Type in the title → the message stays. Shorten the title and Save → "Saved" replaces it (MSG-2).
14. Paste about 150 KB of text and Save → "This note is too large to save (max 100 KB)." Paste about 2 MB more and Save → the same message. In both cases the network log shows no Save request (NOTE-12, D40).
15. **(slow)** On "Groceries": "Create share link" → "Creating link…", then the link is shown. `/notes` shows "Shared" badge (SHARE-2). "Copy link" → "Copied!" (SHARE-3).
16. Open the link in a private window → title, "Last updated …", content, "Shared with TinyNotes". No editor, no email in page source (PUB-1, PUB-5).
17. Edit and save the note, then reload the shared page → new content (PUB-3, NOTE-16: still shared).
18. Open "Groceries" in a second tab and click "Disable link" there → private state. Back in the first tab, which still shows the link, **(slow)** "Disable link" → "Disabling…", then the private state with no error (SHARE-4, SHARE-7, D42). Old link → "This note isn't available" with HTTP 404 (PUB-2).
19. Enable again → different URL. The first URL is still 404 (SHARE-5).
20. `/s/short` → 404 (PUB-2).
21. Sign up a second user `bob@example.com`. Bob's `/notes` doesn't show Ada's notes (NOTE-3). Bob opens Ada's `/notes/{id}` → "Page not found" (NOTE-15). Bob can open Ada's active share link (PUB-1).
22. **(slow)** As Ada: "Delete", then Cancel → note remains. "Delete", then OK → "Deleting…" with Save and Delete disabled, then `/notes` without it, and its share link → 404 (NOTE-14).
23. Sign out in another tab, then click Save → "Your session has expired. Sign in again to continue." The "Sign in" link opens a new tab. After signing in there, Save works in the original tab (§7 `UNAUTHENTICATED`).
24. Stop the server, then click Save → "Something went wrong. Please try again." and the button reads "Save" again (D39). Start the server again.
25. Move `.env` aside and run `bun run build` → it exits 1 with a message naming `BETTER_AUTH_SECRET` (D36). Put `.env` back.
26. Delete `data/`, then `bun run build && bun run start` → it builds, and steps 2, 8, 10 and 16 work in production mode. The session cookie is `HttpOnly` and `SameSite=Lax` (Playwright `context.cookies()`, §10).
27. Still in production mode: six wrong sign-ins within a minute → the sixth shows "Too many attempts. Please wait a minute and try again." (AUTH-14, D44).

---

## 12. Risks and mitigations

| ID | Risk | Mitigation |
| -- | ---- | ---------- |
| R1 | **`bun:sqlite` inside Next.js** (highest risk): Turbopack may fail to resolve `bun:sqlite`, or code may run on Node instead of Bun. Only community docs cover this; it is not verified for Next 16.4. | M0 spike: a throwaway page runs `select sqlite_version()` under `bun --bun next dev` **and** `build` + `start`. If it fails, try in order: `serverExternalPackages: ["bun:sqlite"]` in `next.config.ts`, then `next dev --webpack` / `next build --webpack`. If all fail, stop and ask (don't switch DB drivers without approval). |
| R2 | better-auth's expected schema differs from the hand-written `0001` SQL. | In M0, generate the schema with the better-auth CLI for the pinned version and diff it. The spike signs up and signs in one user against the migrated DB. |
| R3 | TipTap hydration mismatch in Next SSR. | `immediatelyRender: false`; the editor lives only in a client component. |
| R4 | The static renderer doesn't escape some attribute or text. | Unit tests in `render.test.ts` (escaping cases). Schema normalization drops unknown attrs. If escaping fails, stop and ask before adding `@tiptap/html`. |
| R5 | Lost edits (no autosave, no unsaved-changes warning, session expiry). | Accepted per D2. The session-expiry link opens in a new tab so edits survive (§7). |
| R6 | Next 16.4.0 is 4 days old at spec time. | If a regression blocks work, pin `16.3.8` + `eslint-config-next 16.3.8` and record it in §3. |
| R7 | Multiple DB connections in dev (HMR) or `SQLITE_BUSY`. | Cache `db` on `globalThis` in dev. WAL + `busy_timeout = 5000`. |
| R8 | Two tabs editing the same note overwrite each other. | Accepted: last save wins (D31). |
| R9 | `.gitignore` ignores `.env*`, which also matches `.env.example`. | Add `!.env.example` and `data/` in M0. |
| R10 | better-auth's rate limiter keys on the client IP. With no proxy in front of `next start`, it may not find one and never trigger, so D44 and checklist step 27 fail. | M0 spike: under `next start`, six quick wrong sign-ins return 429. If not, adjust better-auth's IP-address settings (`advanced.ipAddress`). If that doesn't work, stop and ask. |

---

## 13. Open questions

1. **Time zone (D33)**: server-local time is fine for local-only use. If the app is ever hosted, should dates follow the viewer's time zone?
2. **Return URL (D30)**: should sign-in return the user to the protected page they tried to open (`?next=`), or always `/notes`?
3. **Disable link confirmation (SHARE-4)**: OK without a confirmation, given that a new link is generated on re-enable?
4. **Security headers (§10)**: keep the small `headers()` block, or drop it as out of scope for a demo?
5. **Theme**: is light only acceptable?

---

## 14. Milestones

One PR per milestone, in order, except that M5 and M6 both depend only on M4 and may run in either order. M0 is setup plus a throwaway spike. M1–M2 are the foundation (DB, then pure logic). M3–M6 are vertical slices a user can try (auth → notes → sharing → toolbar). M7 is polish plus a full acceptance run. Each PR should be reviewable in under an hour. "Step N" refers to the §11 manual checklist.

### M0 — Setup + spike

- **Scope**:
  - §4: pin every version exactly, add `packageManager`, set the scripts (without the `db:migrate` script and prefixes, which M1 adds once `scripts/migrate.ts` exists), configure Prettier with `prettier-plugin-tailwindcss` and `.prettierignore` (D46), and add `BETTER_AUTH_URL` to `.env.example`.
  - `.gitignore`: add `data/` and `!.env.example` (R9).
  - Decisions: D19, D23, D28.
  - Throwaway spike for R1, R2 and R10:
    - `app/spike/page.tsx` runs `select sqlite_version()` via `bun:sqlite`.
    - A minimal `betterAuth({ database: new Database(...) })` handler is mounted on the CLI-generated schema.
- **Depends on**: —
- **Done when**:
  - `bun install` works with no `^`/`~` in `package.json`. `bun run lint`, `bun run typecheck` and `bun run format` exit 0.
  - The spike page shows the SQLite version under `bun --bun next dev` **and** under `next build` + `next start` (R1).
  - The better-auth 1.7.7 CLI `generate` output has been diffed against §8 `0001_better_auth.sql`. Any difference is fixed in §8 (R2).
  - Spike `POST /api/auth/sign-up/email` and `POST /api/auth/sign-in/email` return 200 with `Set-Cookie` (R2).
  - Under `next start`, six quick wrong sign-ins → the sixth returns 429 (R10).
  - Findings are recorded in this spec: R1, R2 and R10 marked verified, plus any required `next.config.ts` or `advanced.ipAddress` change.
  - The spike code is deleted before merge.
- **Main risk**: R1 fails under every listed fallback. Then stop and ask (it is a stack decision).

### M1 — DB foundation

- **Scope**:
  - §8: both migrations, `_migrations`, PRAGMAs. Decisions: D27, D29, D36. Risk: R7.
  - Files: `lib/env.ts` (+test), `lib/open-database.ts`, `lib/db.ts`, `lib/migrate.ts` (+test), `scripts/migrate.ts`, `db/migrations/0001_better_auth.sql`, `db/migrations/0002_note.sql`, `lib/testing/db.ts`.
  - `dev`, `build` and `start` run `db:migrate` first.
- **Depends on**: M0
- **Done when**:
  - `bun test lib/env lib/migrate` passes every §11 case.
  - On a fresh clone, `bun run db:migrate` creates `data/app.db` with `user`, `session`, `account`, `verification`, `note` and `_migrations`. A second run applies nothing.
  - Step 25 passes.
  - With `data/` deleted, `bun run build` succeeds (first half of step 26).
- **Main risk**: Multi-statement `.sql` execution and per-file rollback in `bun:sqlite`; WAL/locking quirks on Windows.

### M2 — Notes domain logic

- **Scope**:
  - Files, each with its §11 test file: `lib/notes/limits.ts`, `lib/notes/editor-extensions.ts`, `lib/notes/validation.ts`, `lib/notes/render.ts`, `lib/notes/repo.ts`, `lib/share-token.ts`.
  - Decisions: D18, D26, D32, D40 (server + DB), D42 (repo). Risk: R4.
- **Depends on**: M1
- **Done when**:
  - `bun test lib/share-token lib/notes` passes every §11 case for these files. That includes the escaping cases (R4), the normalized-size boundary and DB `CHECK` (D40), and `disableShare` on a private note (D42).
  - `bun run typecheck` and `bun run lint` are clean.
- **Main risk**:
  - TipTap schema behavior on the server: `Node.fromJSON().check()` must reject unknown nodes and marks and drop unknown attrs.
  - Static-renderer escaping (R4). If escaping fails, stop and ask.

### M3 — Auth slice: sign up, sign in, sign out

- **Scope**:
  - Files: `lib/auth.ts` (D44 rules), `app/api/auth/[...all]/route.ts`, `lib/auth-client.ts`, `lib/session.ts`, `lib/auth-errors.ts` (+test).
  - UI: `components/message-region.tsx`, `components/auth-form.tsx`, `app/sign-in/page.tsx`, `app/sign-up/page.tsx`, `app/page.tsx`, `components/app-header.tsx`, `components/sign-out-button.tsx`.
  - A stub `app/notes/page.tsx` (`requireUser()` + header + heading "Your notes"), replaced in M4.
  - Page titles for these routes (§5).
  - Requirements: MSG-1, MSG-2, NAV-1, AUTH-1–14. Decisions: D9–D12, D25, D30, D44.
- **Depends on**: M1
- **Done when**:
  - `bun test lib/auth-errors` passes.
  - Steps 1–7 pass. In step 2, landing on `/notes` is enough; the empty-state copy is checked in M4.
  - On an auth form, an error stays while the user types and clears on the next submit (MSG-2).
  - Step 27 passes in production mode.
  - Step 26's cookie check passes (`HttpOnly`, `SameSite=Lax`).
  - `lib/auth.ts` has no `trustedOrigins` (§10).
- **Main risk**: The exact duplicate-email error code in better-auth 1.7.7. Also, whether the session is visible to Server Components right after client-side sign-in (`router.refresh` timing).

### M4 — Notes slice: list, create, edit, save, delete

- **Scope**:
  - Files: `lib/errors.ts`, `lib/call-action.ts` (+test), `lib/format-date.ts` (+test).
  - `lib/notes/actions.ts`: `createNoteAction`, `saveNoteAction`, `deleteNoteAction`.
  - The full `app/notes/page.tsx`, `components/new-note-button.tsx`, `app/notes/[id]/page.tsx`.
  - `components/note-editor.tsx`: title, `EditorContent`, Save, Delete, the editor message region, the edit counter (D38), the client-side size check (D40), and the `UNAUTHENTICATED` "Sign in" link (new tab).
  - `.note-content` CSS (D34), `app/not-found.tsx`, `app/error.tsx`, page titles.
  - Requirements: NOTE-1–5, NOTE-7–15. Decisions: D2, D15–D17, D24, D31, D33, D34, D37–D41. Risks: R3, R5.
- **Depends on**: M2, M3
- **Done when**:
  - `bun test lib/call-action lib/format-date` passes.
  - These checklist steps pass:
    - Step 2 (empty state).
    - Step 8, except the Sharing section.
    - Steps 10–14.
    - Step 21's first two checks (NOTE-3, NOTE-15).
    - Step 22, except the share-link check.
    - Steps 23 and 24.
  - StarterKit shortcuts (e.g. `Ctrl/Cmd+B`) format text, although there is no toolbar yet.
- **Main risk**: The editor must keep its state when revalidation re-renders the page. The D38 rule ("Saved" only if nothing changed since the click) is a race to get right. Also TipTap SSR hydration (R3).

### M5 — Sharing slice: share link + public page

- **Scope**:
  - `enableShareAction` and `disableShareAction` in `lib/notes/actions.ts`.
  - `components/share-panel.tsx`, mounted on the editor page.
  - `components/note-content.tsx`, `app/s/[token]/page.tsx`, `app/s/[token]/not-found.tsx`.
  - Robots meta (PUB-5) and `next.config.ts` `headers()` (§10).
  - Requirements: SHARE-1–7, PUB-1–5, NOTE-16. Decisions: D5–D8, D14, D42 (UI).
- **Depends on**: M4
- **Done when**:
  - These checklist steps pass:
    - Step 8 (the Sharing section).
    - Steps 15–20.
    - Step 21's last check (Bob opens Ada's share link).
    - Step 22's share-link → 404 check.
  - `curl -I` on an active `/s/{token}` shows `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff` and `X-Frame-Options: DENY`.
  - `curl -I` on `/s/short` returns 404.
  - The M2 render tests still pass.
  - `components/note-content.tsx` holds the only `dangerouslySetInnerHTML` in the codebase.
- **Main risk**: `@tiptap/static-renderer` may bundle or behave differently in the Next server build than under `bun test`.

### M6 — Formatting toolbar

- **Scope**:
  - `components/editor-toolbar.tsx`, mounted in `components/note-editor.tsx`.
  - Pressed state via `isActive()`, `aria-disabled` via `can()`, and the WAI-ARIA toolbar keyboard model with a roving tabindex.
  - Requirements: NOTE-6. Decisions: D4, D35, D43.
- **Depends on**: M4
- **Done when**:
  - Step 9 passes in full: every button, a half-bold range, Bold inside a code block, and the Tab / ← → / Home / End / wrap keyboard behavior.
  - `bun run lint` and `bun run typecheck` are clean.
- **Main risk**: `useEditorState` returning stale `isActive`/`can` values. Also returning focus to the last-focused button when tabbing back in.

### M7 — Polish + full acceptance

- **Scope**:
  - Visual pass: layout, spacing, `:focus-visible`, phone width.
  - `README.md` with the §4 fresh-clone steps.
  - Remove scaffold leftovers (`public/*.svg`, default page content).
  - §10 audit: SQL is parameterized only, there is a single `dangerouslySetInnerHTML`, and there is no `trustedOrigins` or `serverActions.allowedOrigins`.
  - Fix anything the full run finds, referencing the failing requirement ID.
- **Depends on**: M5, M6
- **Done when**:
  - The full checklist (steps 1–27) passes on a fresh DB, including step 26 in production mode.
  - `bun test`, `bun run lint`, `bun run typecheck` and `bun run build` all exit 0.
- **Main risk**: Regressions across milestones that only show up late.

### Coverage: requirement ID → milestone

Each requirement ID belongs to exactly one milestone: the one where it becomes true for a user. M0, M1, M2 and M7 deliberately own no IDs; they cover foundation, risks and the final run.

| ID | Milestone | Note |
| -- | --------- | ---- |
| MSG-1 | M3 | The region component is built and verified on the auth forms. The editor and Sharing regions are checked under NOTE-7/NOTE-14 (M4) and SHARE-3 (M5). |
| MSG-2 | M3 | Re-checked in M4 (step 13). |
| NAV-1 | M3 | |
| AUTH-1 – AUTH-13 | M3 | |
| AUTH-14 | M3 | Production mode (step 27). |
| NOTE-1 | M4 | The "Shared" badge renders from `isShared`; seen end-to-end in M5 (step 15). |
| NOTE-2 – NOTE-4 | M4 | |
| NOTE-5 | M4 | Page structure. Its toolbar and Sharing parts are verified under NOTE-6 (M6) and SHARE-1 (M5). |
| NOTE-6 | M6 | |
| NOTE-7 – NOTE-15 | M4 | The validation logic is unit-tested in M2. |
| NOTE-16 | M5 | Guaranteed by the M2 repo test; end-to-end in step 17. |
| SHARE-1 – SHARE-7 | M5 | SHARE-6 and the D42 repo behavior are unit-tested in M2. |
| PUB-1 – PUB-5 | M5 | PUB-4 escaping is unit-tested in M2. |

Totals: M3 = 17, M4 = 14, M5 = 13, M6 = 1. That is **45 of 45 IDs, each exactly once**: none uncovered, none duplicated.

### Other spec items → milestone

| Item | Milestone |
| ---- | --------- |
| R1, R2, R9, R10; D19, D23, D28 | M0 |
| §8; D27, D29, D36; R7 | M1 |
| D18, D26, D32, D40 (server + DB), D42 (repo); R4 | M2 |
| D9–D12, D25, D30, D44 | M3 |
| D2, D15–D17, D24, D31, D33, D34, D37–D41; R3, R5 | M4 |
| D5–D8, D14, D42 (UI); §10 headers | M5 |
| D4, D35, D43 | M6 |
| §10 audit; README | M7 |

### Checklist steps → milestone

| Steps | Milestone |
| ----- | --------- |
| 1–7, 27; step 26 cookie check | M3 |
| 2 (empty state), 8 (without Sharing), 10–14, 21 (NOTE-3, NOTE-15), 22 (without share link), 23, 24 | M4 |
| 8 (Sharing), 15–20, 21 (share link), 22 (share link) | M5 |
| 9 | M6 |
| 25; step 26 build half | M1 |
| 1–27 (full run) | M7 |
