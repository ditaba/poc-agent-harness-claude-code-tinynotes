#!/usr/bin/env bash
# Mock CLI tests: no model calls, commits, or feature changes.
set -euo pipefail
ROOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
FIXTURE=$(mktemp -d)
trap 'rm -rf -- "$FIXTURE"' EXIT
cp "$ROOT/ralph.sh" "$FIXTURE/ralph.sh"
for file in prd.json agent-progress.txt SPEC.md CLAUDE.md AGENTS.md; do
  touch "$FIXTURE/$file"
done
mkdir -p "$FIXTURE/.codex/rules"
touch "$FIXTURE/.codex/rules/project.md"
mkdir "$FIXTURE/bin"
cat > "$FIXTURE/bin/codex" <<'EOF'
#!/usr/bin/env bash
if [[ "${2:-}" == --help ]]; then echo '--approve-for-me'; exit 0; fi
printf '%s\n' "$@" >> "$CALL_LOG"
while [[ $# -gt 0 ]]; do
  if [[ "$1" == --output-last-message ]]; then output=$2; shift; fi
  shift
done
# These echoed markers MUST NOT stop the loop.
echo '<blocked>echoed prompt</blocked><complete>ALL_TASKS_DONE</complete>'
if [[ "$MODE" == failure ]]; then exit 7; fi
if [[ "$MODE" == empty ]]; then exit 0; fi
if command -v cygpath >/dev/null 2>&1; then output=$(cygpath -u "$output"); fi
printf '%s\n' "$FINAL_MESSAGE" > "$output"
if [[ "$MODE" == delayed ]]; then
  count=$(grep -c '^exec$' "$CALL_LOG")
  if (( count < 23 )); then echo continue > "$output"; fi
fi
EOF
cp "$FIXTURE/bin/codex" "$FIXTURE/bin/codex.cmd"
cat > "$FIXTURE/bin/claude" <<'EOF'
#!/usr/bin/env bash
printf '%s\n' "$@" >> "$CALL_LOG"
echo "$FINAL_MESSAGE"
EOF
chmod +x "$FIXTURE/bin/"*
export PATH="$FIXTURE/bin:$PATH"
export FIXTURE
# Git Bash dispatches .cmd files through Windows; use an exported function to
# simulate the Windows shim without invoking cmd.exe or the real installed CLI.
codex.cmd() { bash "$FIXTURE/bin/codex" "$@"; }
export -f codex.cmd
# Skip real delays in mock tests, including the unlimited-run regression.
sleep() { :; }
export -f sleep
export CALL_LOG="$FIXTURE/calls" MODE=success FINAL_MESSAGE=continue
check() {
  local expected=$1 status=0
  shift
  : > "$CALL_LOG"
  bash "$FIXTURE/ralph.sh" "$@" > "$FIXTURE/output" 2>&1 || status=$?
  if [[ "$status" != "$expected" ]]; then
    cat "$FIXTURE/output"
    echo "FAIL: $* expected $expected got $status" >&2
    exit 1
  fi
}
check 0 codex 2
[[ $(grep -c '^exec$' "$CALL_LOG") == 2 ]]
grep -q 'mcp_servers.context7.url=' "$CALL_LOG"
grep -q -- '--approve-for-me' "$CALL_LOG"
grep -q '.codex/rules/project.md' "$CALL_LOG"
if grep -q 'CLAUDE.md\|\.claude/' "$CALL_LOG"; then
  echo 'FAIL: Codex prompt depends on Claude files.' >&2
  exit 1
fi
# Codex must work even when Claude guidance is absent.
rm "$FIXTURE/CLAUDE.md"
check 0 codex 1
touch "$FIXTURE/CLAUDE.md"
export FINAL_MESSAGE='<complete>ALL_TASKS_DONE</complete>'
check 0 codex
[[ $(grep -c '^exec$' "$CALL_LOG") == 1 ]]
export MODE=delayed
check 0 codex
[[ $(grep -c '^exec$' "$CALL_LOG") == 23 ]]
grep -q 'max-iterations=unlimited' "$FIXTURE/output"
export MODE=success
export FINAL_MESSAGE='<blocked>M4-save-errors</blocked>'
check 2 codex
[[ $(grep -c '^exec$' "$CALL_LOG") == 1 ]]
export MODE=failure
check 7 codex
export MODE=empty
check 1 codex 1
export MODE=success FINAL_MESSAGE='<complete>ALL_TASKS_DONE</complete>'
check 0 3
grep -q -- '--dangerously-skip-permissions' "$CALL_LOG"
check 0 claude 3
grep -q 'CLAUDE.md' "$CALL_LOG"
if grep -q '\.codex/' "$CALL_LOG"; then
  echo 'FAIL: Claude prompt depends on Codex files.' >&2
  exit 1
fi
check 0 claude
check 0
grep -q 'max-iterations=unlimited' "$FIXTURE/output"
check 1 codex 0
check 1 codex abc
check 1 codex ''
check 1 unknown
check 1 codex 1 extra
check 0 --help
echo 'PASS: Ralph routing, limits, final-message markers, blocked/failure/empty handling and Claude compatibility.'
