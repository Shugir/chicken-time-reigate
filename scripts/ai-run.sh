#!/usr/bin/env bash
# Keep work going: Claude Code first, Antigravity CLI (agy) when Claude hits its usage limit.
# Each round does ONE step from HANDOFF.md, runs the build, updates HANDOFF.md and commits.
# Stops when HANDOFF.md contains "STATUS: DONE" or after MAX_ROUNDS.
#
# Usage:  scripts/ai-run.sh ["goal text"]     (goal is written into HANDOFF.md if given)
# Env:    MAX_ROUNDS=20  AGY_MODEL=<name>  CLAUDE_COOLDOWN_MIN=60  SKIP_PERMS=1
set -uo pipefail

cd "$(git rev-parse --show-toplevel)"
MAX_ROUNDS="${MAX_ROUNDS:-20}"
CLAUDE_COOLDOWN_MIN="${CLAUDE_COOLDOWN_MIN:-60}"
LOG_DIR=".ai-run"; mkdir -p "$LOG_DIR"
PERMS=(); [ "${SKIP_PERMS:-1}" = "1" ] && PERMS=(--dangerously-skip-permissions)

branch="$(git branch --show-current)"
case "$branch" in main|master)
  echo "Refusing to run unattended on $branch. Create a branch or worktree first." >&2; exit 1;;
esac

if [ "${1:-}" != "" ]; then
  printf 'STATUS: IN_PROGRESS\n\n## Goal\n%s\n\n## Next steps\n- [ ] Break the goal into steps here\n\n## Done\n\n## Blockers\n' "$1" > HANDOFF.md
  git add HANDOFF.md && git commit -qm "handoff: new goal"
fi
[ -f HANDOFF.md ] || { echo "No HANDOFF.md. Pass a goal: scripts/ai-run.sh \"build X\"" >&2; exit 1; }

PROMPT='Read AGENTS.md and HANDOFF.md. Do the FIRST unchecked item in "Next steps" only.
Then run `npm run build` (and `npm test` if tests exist) and fix failures you caused.
Update HANDOFF.md: tick the item, move it to Done, add new steps you discovered, note blockers.
If every step is done and the build passes, change the first line to "STATUS: DONE".
Commit all changes with a clear message. Do not push.'

claude_blocked_until=0
is_limit() { grep -qiE 'usage limit|rate limit|limit reached|out of (credits|usage)|429|quota' "$1"; }

for round in $(seq 1 "$MAX_ROUNDS"); do
  head -1 HANDOFF.md | grep -q 'STATUS: DONE' && { echo "✓ Done after $((round-1)) rounds."; exit 0; }
  log="$LOG_DIR/round-$round.log"; now=$(date +%s); used=""

  if [ "$now" -ge "$claude_blocked_until" ] && command -v claude >/dev/null; then
    echo "▶ round $round: claude"
    if claude -p "$PROMPT" "${PERMS[@]}" >"$log" 2>&1 && ! is_limit "$log"; then used=claude
    elif is_limit "$log"; then
      echo "  claude limit hit → agy for ${CLAUDE_COOLDOWN_MIN}m"
      claude_blocked_until=$(( now + CLAUDE_COOLDOWN_MIN*60 ))
    else echo "  claude failed (see $log) → trying agy"; fi
  fi

  if [ -z "$used" ]; then
    echo "▶ round $round: agy${AGY_MODEL:+ ($AGY_MODEL)}"
    MODEL_ARGS=(); [ -n "${AGY_MODEL:-}" ] && MODEL_ARGS=(--model "$AGY_MODEL")
    if agy -p "$PROMPT" "${MODEL_ARGS[@]}" "${PERMS[@]}" >"$log" 2>&1 && ! is_limit "$log"; then used=agy
    else
      echo "  agy failed or limited too (see $log). Waiting 15m."; sleep 900; continue
    fi
  fi

  # Safety net: commit anything the agent left uncommitted.
  git add -A && git commit -qm "wip($used): round $round" 2>/dev/null || true
done
echo "Stopped after $MAX_ROUNDS rounds. See HANDOFF.md."
