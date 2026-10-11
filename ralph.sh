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
if [[ "$AGENT" == codex ]]; then
  RULES_FILE=.codex/rules/project.md
  AGENT_ENTRY=AGENTS.md
else
  RULES_FILE=CLAUDE.md
  AGENT_ENTRY=CLAUDE.md
fi
for file in prd.json agent-progress.txt SPEC.md "$RULES_FILE" "$AGENT_ENTRY"; do
  if [[ ! -f "$file" ]]; then echo "Error: missing $file" >&2; exit 1; fi
done
if [[ "$AGENT" == codex ]]; then
  if ! "$AGENT_BIN" exec --help 2>&1 | grep -q -- '--approve-for-me'; then
    echo "Error: update Codex CLI; this loop requires exec --approve-for-me." >&2
    exit 1
  fi
fi
LAST_MESSAGE=$(mktemp)
trap 'rm -f -- "$LAST_MESSAGE"' EXIT
CODEX_OUTPUT=$LAST_MESSAGE
if command -v cygpath >/dev/null 2>&1; then CODEX_OUTPUT=$(cygpath -w "$LAST_MESSAGE"); fi
PROMPT="Read prd.json, agent-progress.txt, SPEC.md, $AGENT_ENTRY and $RULES_FILE from disk first.
Follow $AGENT_ENTRY and $RULES_FILE for project rules.
$(cat <<'EOF'
Pick ONE task with passes=false, no blocked field, and all dependsOn tasks passing.
Prefer foundation before UI and risky integrations before routine work.
Implement using the relevant SPEC sections and repository skills.
Verify UI changes with Playwright MCP against the SPEC manual checklist.
Run bun run format before checks and committing (Codex has no Claude Edit/Write hook).
Run bun test, bun run lint, bun run typecheck, bun run build and task-specific checks.
Only mark passes=true after all acceptance criteria and required verification pass.
Append results and verification evidence to agent-progress.txt, then commit ONLY task-owned files.
Preserve pre-existing staged and unstaged human changes; never include them in your commit.
Do not push, deploy, or modify the loop/configuration as part of a feature task.
If checks fail, follow the project rules' Failing checks rule; never claim unverified success.
If blocked, follow the project rules' Blocked tasks rule and end with <blocked>TASK_ID</blocked>.
If permissions or required tools prevent verification/commit, log the exact failure and stop
with <blocked>TASK_ID</blocked>; do not bypass sandboxing or claim completion.
If remaining tasks are all blocked or depend on blocked tasks, output <blocked>NONE_AVAILABLE</blocked>.
Only when EVERY task has passes=true, output <complete>ALL_TASKS_DONE</complete>.
Use control markers only in the final response, never in explanations or quoted instructions.
EOF
)"
ITERATION_LIMIT=$MAX_ITERATIONS
if (( MAX_ITERATIONS == 0 )); then ITERATION_LIMIT=unlimited; fi
echo "Ralph: agent=$AGENT, max-iterations=$ITERATION_LIMIT"
for ((iteration=1; MAX_ITERATIONS == 0 || iteration<=MAX_ITERATIONS; iteration++)); do
  echo "--- Iteration $iteration / $ITERATION_LIMIT ---"
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
    if "$AGENT_BIN" "${codex_args[@]}" "$PROMPT"; then
      result=$(cat "$LAST_MESSAGE")
      if [[ -z "$result" ]]; then echo "Error: Codex returned no final message." >&2; exit 1; fi
    else
      status=$?
      echo "Error: Codex failed with exit code $status." >&2
      exit "$status"
    fi
  else
    if result=$("$AGENT_BIN" --dangerously-skip-permissions -p "$PROMPT" 2>&1); then
      echo "$result"
    else
      status=$?
      echo "$result" >&2
      echo "Error: Claude failed with exit code $status." >&2
      exit "$status"
    fi
  fi
  if [[ "$result" == *"<complete>ALL_TASKS_DONE</complete>"* ]]; then
    echo "All tasks complete!"
    exit 0
  fi
  if [[ "$result" == *"<blocked>"* ]]; then
    echo "Blocked: review prd.json and agent-progress.txt, resolve the reason,"
    echo "remove the task's blocked field, then rerun."
    exit 2
  fi
  if (( MAX_ITERATIONS == 0 || iteration < MAX_ITERATIONS )); then sleep 2; fi
done
echo "Reached $MAX_ITERATIONS iterations. Review git log and agent-progress.txt."
