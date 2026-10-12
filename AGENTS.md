<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Codex TinyNotes guidance

Read `.codex/rules/project.md` in full at the start of each session. It contains
the project state, architecture, invariants, commands and Ralph task rules.
`SPEC.md` is the source of truth. In a Ralph session the task, its SPEC lines and
the related `agent-progress.txt` entries are in the prompt; read further SPEC
sections by line range instead of whole files. Complete only that one task.

## Codex adaptations

- Codex reads this file automatically. Claude settings, hooks, agents and slash
  commands are not automatically loaded by Codex.
- Read applicable `SKILL.md` files under `.codex/skills/` before implementation:
  `bun-first`, `clean-typescript`, `web-security`, and, for UI work,
  `modern-accessible-html-jsx`, `modern-best-practice-nextjs`,
  `modern-best-practice-react-components`, `modern-browser-apis`, `modern-tailwind`.
  Follow referenced resources when relevant. SPEC and installed Next.js docs take
  precedence over generic skill examples.
- Use Context7 directly for current library documentation. The lookup workflow
  is documented in `.codex/workflows/docs-lookup.md`. Fall back to official
  documentation when Context7 lacks coverage.
- Use Playwright MCP for UI acceptance. If required tools cannot be used, record
  the problem and block the task instead of skipping verification.
- Claude's PostToolUse formatter hook does not run in Codex. Run `bun run format`
  after implementation, before validation and before committing. Inspect the diff
  and preserve unrelated human changes affected by formatting.
- Ralph uses `codex exec --approve-for-me`: workspace sandboxing and automatic
  review of permission requests, including Git writes to protected `.git`.
  If review rejects a necessary action, record the rejection and block the task.
  Never change sandbox settings or use bypass flags to evade rejection.
- Commit only task-owned paths, preserving pre-existing staged human changes
  (use an explicit-path commit when appropriate). Do not push or deploy.
- For a requested code review, read `.codex/workflows/code-review.md`.
- Maintain Codex guidance in `.codex/` independently. Do not read Claude-specific
  files for Codex tasks; use `SPEC.md` as the shared source of truth.
