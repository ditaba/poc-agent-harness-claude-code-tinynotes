#!/usr/bin/env bash
# One fresh agent session per task. Use Git Bash, WSL, Linux or macOS.
set -euo pipefail
usage() { echo "Usage: $0 [claude|codex] [max-iterations] (default: unlimited)"; }
AGENT=claude
MAX_ITERATIONS=0 # Internal sentinel: no iteration limit when omitted.
if [[ $# -gt 0 ]]; then
  case "$1" in
    claude|codex) AGENT=$1; shift ;;
    -h|--help) usage; exit 0 ;;
    [0-9]*) ;;
    *) usage >&2; exit 1 ;;
  esac
fi
if [[ $# -gt 0 ]]; then
  MAX_ITERATIONS=$1
  shift
  if [[ ! "$MAX_ITERATIONS" =~ ^[1-9][0-9]*$ ]]; then
    echo "Error: max-iterations must be a positive integer." >&2
    usage >&2
    exit 1
  fi
fi
if [[ $# -ne 0 ]]; then
  echo "Error: max-iterations must be a positive integer." >&2
  usage >&2
  exit 1
fi
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
AGENT_BIN=$AGENT
if [[ "$AGENT" == codex ]] && command -v codex.cmd >/dev/null 2>&1; then
  AGENT_BIN=codex.cmd
fi
if ! command -v "$AGENT_BIN" >/dev/null 2>&1; then
  echo "Error: $AGENT CLI is not installed or not on PATH." >&2
  exit 1
fi
if ! command -v bun >/dev/null 2>&1; then
  echo "Error: bun is not installed or not on PATH (ralph.ts picks tasks)." >&2
  exit 1
fi
if [[ "$AGENT" == codex ]]; then
  RULES_FILE=.codex/rules/project.md
  AGENT_ENTRY=AGENTS.md
else
  RULES_FILE=CLAUDE.md
  AGENT_ENTRY=CLAUDE.md
fi
for file in prd.json agent-progress.txt SPEC.md ralph.ts "$RULES_FILE" "$AGENT_ENTRY"; do
  if [[ ! -f "$file" ]]; then echo "Error: missing $file" >&2; exit 1; fi
done
if [[ "$AGENT" == codex ]]; then
  if ! "$AGENT_BIN" exec --help 2>&1 | grep -q -- '--approve-for-me'; then
    echo "Error: update Codex CLI; this loop requires exec --approve-for-me." >&2
    exit 1
  fi
fi
mkdir -p .ralph
LAST_MESSAGE=.ralph/last-message.txt
CLAUDE_OUTPUT=.ralph/last-output.json
CODEX_OUTPUT=$LAST_MESSAGE
if command -v cygpath >/dev/null 2>&1; then CODEX_OUTPUT=$(cygpath -w "$LAST_MESSAGE"); fi
# The agent loads its entry file itself; only Codex keeps its rules in a separate file.
RULES_LINE="Follow $AGENT_ENTRY for project rules."
if [[ "$RULES_FILE" != "$AGENT_ENTRY" ]]; then
  RULES_LINE="Read $RULES_FILE first. Follow $AGENT_ENTRY and $RULES_FILE for project rules."
fi
# Static text first and the task context last, so the shared prefix stays cached across iterations.
PROMPT="$RULES_LINE
$(cat <<'EOF'
Work only on the task at the end of this prompt. Its JSON, a SPEC.md index, the SPEC lines for
the IDs it names, its milestone and the related agent-progress.txt entries are included there.
Don't read SPEC.md, prd.json or agent-progress.txt in full: Read other SPEC sections by line range
from the index, or Grep for an ID or name. To change prd.json (passes, blocked, a new task),
Grep -n for the task id and Read only that entry before editing it.
Implement using the relevant SPEC sections and repository skills.
Locate code with Grep and Read offset/limit, and don't re-read files you just wrote.
Look up docs only when unsure of an API or after a failed check; prefer one focused context7 query.
Verify UI changes with Playwright MCP against the SPEC manual checklist.
Run bun run format before checks and committing (Codex has no Claude Edit/Write hook).
Run bun test, bun run lint, bun run typecheck, bun run build and task-specific checks with short output:
<command> > .ralph/check.log 2>&1; echo "exit=$?"; tail -n 40 .ralph/check.log
Only mark passes=true after all acceptance criteria and required verification pass.
Append an entry of at most 15 lines to agent-progress.txt: "## YYYY-MM-DD – TASK_ID (passes|BLOCKED)",
the files changed, the checks run with results, and decisions. Put reusable learnings (API quirks,
commands, patterns) as one-line bullets under "## Codebase patterns" at the top of the file instead.
Then commit ONLY task-owned files.
Preserve pre-existing staged and unstaged human changes; never include them in your commit.
Do not push, deploy, or modify the loop/configuration as part of a feature task.
If checks fail, follow the project rules' Failing checks rule; never claim unverified success.
If blocked, follow the project rules' Blocked tasks rule and end with <blocked>TASK_ID</blocked>.
If permissions or required tools prevent verification/commit, log the exact failure and stop
with <blocked>TASK_ID</blocked>; do not bypass sandboxing or claim completion.
Use control markers only in the final response, never in explanations or quoted instructions.
EOF
)"
ITERATION_LIMIT=$MAX_ITERATIONS
if (( MAX_ITERATIONS == 0 )); then ITERATION_LIMIT=unlimited; fi
echo "Ralph: agent=$AGENT, max-iterations=$ITERATION_LIMIT"
for ((iteration=1; MAX_ITERATIONS == 0 || iteration<=MAX_ITERATIONS; iteration++)); do
  echo "--- Iteration $iteration / $ITERATION_LIMIT ---"
  # Pick the task here, so "all done" and "all blocked" cost no agent session.
  next_task=$(bun ralph.ts next)
  next_task=${next_task%$'\r'}
  case "$next_task" in
    ALL_DONE) echo "All tasks complete!"; exit 0 ;;
    NONE_AVAILABLE)
      echo "Blocked: every remaining task is blocked or depends on a blocked task."
      echo "Review prd.json and agent-progress.txt, resolve the reason,"
      echo "remove the task's blocked field, then rerun."
      exit 2 ;;
  esac
  IFS=$'\t' read -r task_id task_effort <<< "$next_task"
  # RALPH_* rather than CLAUDE_*: Claude Code exports its own CLAUDE_* variables.
  effort=${task_effort:-${RALPH_EFFORT:-medium}}
  echo "Task: $task_id"
  task_prompt="$PROMPT

## Task: $task_id
$(bun ralph.ts context "$task_id")"
  before_head=$(git rev-parse HEAD)
  : > "$LAST_MESSAGE"
  if [[ "$AGENT" == codex ]]; then
    # Stream progress; inspect ONLY the final response for control markers.
    codex_args=(exec --approve-for-me --color never
      -c sandbox_workspace_write.network_access=true
      -c 'mcp_servers.playwright.command="npx"'
      -c 'mcp_servers.playwright.args=["-y","@playwright/mcp@latest"]'
      -c mcp_servers.playwright.startup_timeout_sec=60
      -c 'mcp_servers.context7.url="https://mcp.context7.com/mcp"'
      --output-last-message "$CODEX_OUTPUT")
    if [[ -n "${CODEX_MODEL:-}" ]]; then codex_args+=(--model "$CODEX_MODEL"); fi
    # Windows .cmd wrappers truncate multiline command-line arguments. Stdin
    # preserves the entire prompt across Git Bash -> cmd.exe -> Codex.
    if printf '%s\n' "$task_prompt" | "$AGENT_BIN" "${codex_args[@]}" -; then
      result=$(cat "$LAST_MESSAGE")
      if [[ -z "$result" ]]; then echo "Error: Codex returned no final message." >&2; exit 1; fi
    else
      status=$?
      echo "Error: Codex failed with exit code $status." >&2
      exit "$status"
    fi
  else
    # JSON output carries token usage; dynamic sections (git status, cwd) move out of the
    # system prompt so it stays cached across iterations. The Artifact tool isn't used here,
    # and disallowing it drops its ~11k-token definition from every API call.
    echo "Effort: $effort${RALPH_MODEL:+, model: $RALPH_MODEL}"
    claude_args=(--dangerously-skip-permissions -p "$task_prompt" --output-format json
      --exclude-dynamic-system-prompt-sections --effort "$effort" --disallowedTools Artifact)
    if [[ -n "${RALPH_MODEL:-}" ]]; then claude_args+=(--model "$RALPH_MODEL"); fi
    if "$AGENT_BIN" "${claude_args[@]}" > "$CLAUDE_OUTPUT"; then
      if ! result=$(bun ralph.ts result "$CLAUDE_OUTPUT" "$iteration" "$task_id" "$effort"); then
        cat "$CLAUDE_OUTPUT" >&2
        echo "Error: could not read Claude's JSON output." >&2
        exit 1
      fi
      echo "$result"
    else
      status=$?
      cat "$CLAUDE_OUTPUT" >&2
      echo "Error: Claude failed with exit code $status." >&2
      exit "$status"
    fi
  fi
  if [[ "$result" == *"<blocked>"* ]]; then
    echo "Blocked: review prd.json and agent-progress.txt, resolve the reason,"
    echo "remove the task's blocked field, then rerun."
    exit 2
  fi
  after_head=$(git rev-parse HEAD)
  if [[ "$after_head" == "$before_head" ]]; then
    echo "Error: iteration $iteration finished without a new commit. Stopping to avoid a no-progress loop." >&2
    echo "Final response:" >&2
    echo "$result" >&2
    echo "Codex final response is saved in $LAST_MESSAGE (when using Codex). Review it before restarting." >&2
    exit 3
  fi
  if (( MAX_ITERATIONS == 0 || iteration < MAX_ITERATIONS )); then sleep 2; fi
done
if [[ $(bun ralph.ts next) == ALL_DONE* ]]; then echo "All tasks complete!"; exit 0; fi
echo "Reached $MAX_ITERATIONS iterations. Review git log and agent-progress.txt."
