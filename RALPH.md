# Ralph - Autonomous AI Coding

Ralph is an autonomous coding agent that iteratively works through a feature list, implementing one task at a time until the project is complete.

## How It Works

Ralph uses the same prompt in a loop. Each iteration:

1. Reviews what's been completed (`agent-progress.txt`)
2. Picks the next logical task from the list (`prd.json`)
3. Implements the feature with proper tests
4. **Verifies UI changes via Playwright MCP**
5. Marks the task complete and documents progress
6. Commits the code

**Key insight**: You define what needs to be done. Ralph decides the order and does the work.

## Sandbox Mode

Ralph runs with `claude --dangerously-skip-permissions` and sandbox enabled via `.claude/settings.json`:

```json
{
  "permissions": {
    "dangerouslySkipPermissions": true
  },
  "sandbox": {
    "enabled": true
  }
}
```

This means:

- ✅ Can edit project files without prompts
- ✅ Can run commands and tests
- ✅ Can make git commits
- ✅ Uses Claude's built-in sandbox for isolation

### Local Configuration

MCPs and settings must be configured locally in this project:

- `.mcp.json` - MCP server configurations (Playwright, Context7, etc.)
- `.claude/settings.json` - Sandbox and permission settings
- `.claude/settings.local.json` - Additional permissions and hooks

## Usage

### Codex

Run from **Git Bash** on Windows (or Bash in WSL/Linux/macOS):

```bash
codex login                    # One-time CLI authentication
./ralph.sh codex                # Default: unlimited; run until all tasks are done
./ralph.sh codex 5              # Smaller first run
CODEX_MODEL=your-model ./ralph.sh codex 5  # Optional; otherwise CLI default
```

Use a recent Codex CLI supporting `codex exec --approve-for-me` (validated
against 0.162.1). In PowerShell, use `codex.cmd login` if execution policy blocks
the npm `codex.ps1` shim, then run the loop from Git Bash.

Codex uses `AGENTS.md` as its entry point and loads independent guidance from
`.codex/rules/project.md`, `.codex/skills/` and `.codex/workflows/`. The eight
implementation skill guides and supporting references were copied and adapted
for Codex; future edits can be made independently of Claude configuration.
Documentation lookup and code review have Codex-specific workflow files.
Codex iterations do not require `CLAUDE.md` or `.claude/`. Claude iterations
continue using their own guidance. `SPEC.md` is the shared source of truth.
Formatting is an explicit Codex step before checks and commit.

The script supplies Playwright (stdio via `npx -y @playwright/mcp@latest`) and
Context7 (HTTP) settings through CLI `-c` overrides on every Codex iteration.
Node/npm/npx must be on PATH; first startup can download the Playwright MCP.
No API key is embedded. Your existing user-level model/auth configuration remains
in use. MCP overrides apply to this loop without editing global settings.

`--approve-for-me` keeps the workspace sandbox and sends permission requests to
automatic review, allowing review of operations such as commits in protected
`.git`. Outbound network access is enabled for dependency installation and docs.
Rejected required operations must be logged as blocked; the loop does not disable
sandboxing to retry. Organization policies can still restrict operations.

Each iteration streams Codex execution to the terminal and reads stop markers
only from `--output-last-message`, avoiding false stops from echoed prompts.
Exit codes: `0` completion or iteration limit, `2` blocked, otherwise the CLI's
failure code (or `1` for setup/argument errors). Resume using the same command:
progress is read from disk, not a resumed chat session.

Before starting, review any existing staged/unstaged changes. The agent is
instructed to preserve them and commit only its own task paths.

Official references: [non-interactive execution](https://developers.openai.com/codex/noninteractive),
[configuration](https://developers.openai.com/codex/config-reference),
[MCP](https://developers.openai.com/codex/mcp).

### Claude (existing behavior)

```bash
./ralph.sh 20    # Run for up to 20 iterations
./ralph.sh claude 20  # Explicit agent selection
```

Ralph stops when:

- All tasks are marked complete, OR
- A task is blocked and needs your decision (exit code 2), OR
- It reaches an explicitly supplied iteration limit, OR
- The CLI fails

Omitting `max-iterations` removes the iteration limit for either agent:
`./ralph.sh codex`, `./ralph.sh claude`, and `./ralph.sh` (Claude) run until
completion, a blocked task, a CLI error, or interruption with Ctrl+C.

### Blocked tasks

Some tasks have "stop and ask" conditions (for example, `bun:sqlite` failing in Next.js under every fallback). Ralph runs non-interactively, so it can't ask. Instead it sets a `"blocked"` field on the task with the reason, keeps `passes: false`, logs it in `agent-progress.txt`, commits, and stops the loop.

To continue:

1. Read the reason: `grep -n '"blocked"' prd.json`
2. Make the decision, and update `SPEC.md` or `prd.json` if needed
3. Delete the task's `"blocked"` field and run `./ralph.sh` again

## Task Selection

Ralph prioritizes:

- **Foundation before features** - Database and auth before UI
- **Risky work first** - Unknown integrations before routine tasks
- **Respect dependencies** - Don't build what can't work yet

## Testing with Playwright MCP

Ralph is instructed to use the Playwright MCP to verify all UI changes. This means:

1. Starting the dev server
2. Navigating to the relevant page
3. Testing actual user interactions
4. Verifying features work visually

This prevents "it compiles so it works" assumptions.

## Files

- **`prd.json`** - Task list with `passes: false/true`
- **`agent-progress.txt`** - Progress log
- **`ralph.sh`** - The loop script
- **`SPEC.md`** - Technical specification
- **`.mcp.json`** - MCP configurations
- **`.claude/settings.json`** - Sandbox and permissions
- **`AGENTS.md`** - Codex entry point
- **`.codex/`** - Independent Codex project rules, skills and workflows

## Monitoring Progress

```bash
cat agent-progress.txt           # See what's done
git log --oneline                # Review commits
grep '"passes": false' prd.json | wc -l  # Count remaining
```

## After Running

Review commits:

```bash
git log -p              # See all changes
git diff HEAD~5..HEAD   # Last 5 commits
```

If something went wrong:

```bash
git reset --hard HEAD~3    # Undo last 3 commits
./ralph.sh 10              # Try again
```

## Tips

- **Start small**: Try 5-10 iterations first
- **Check progress regularly**: Review after 10-20 iterations
- **Keep codebase clean**: Ralph amplifies what it sees
- **Review commits**: Ralph is fast but not perfect

## Limitations

- Works best with clear, structured requirements
- Can't design architecture from scratch (you provide SPEC.md)
- Needs good initial codebase quality
- Benefits from occasional human review

---

**Bottom line**: Define tasks in `prd.json`. Run Ralph. Review commits. Ship.
