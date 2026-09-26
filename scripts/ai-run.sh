#!/usr/bin/env bash
# Keep work going unattended across Claude Code and Antigravity CLI (agy).
# Each round takes the first unchecked step in HANDOFF.md, routes it to the best
# available model (scripts/ai-step.sh), then gates on the build. A failed build is
# handed to the strongest available model to fix. Stops on "STATUS: DONE".
#
# Usage:  scripts/ai-run.sh ["goal text"]   (a goal resets HANDOFF.md, first step = plan)
# Env:    MAX_ROUNDS=30  VERIFY_CMD="npm run build"  FIX_TRIES=2  WAIT_MIN=15
#         plus everything scripts/ai-step.sh reads (PREFER, STEP_TIMEOUT_MIN, ...)
set -o pipefail

cd "$(git rev-parse --show-toplevel)" || exit 1
HERE="$(pwd)/scripts"
MAX_ROUNDS="${MAX_ROUNDS:-30}"
VERIFY_CMD="${VERIFY_CMD:-npm run build}"
FIX_TRIES="${FIX_TRIES:-2}"
WAIT_MIN="${WAIT_MIN:-15}"
LOG_DIR=".ai-run"; mkdir -p "$LOG_DIR"

branch="$(git branch --show-current)"
case "$branch" in main|master)
  echo "Refusing to run unattended on $branch. Create a branch or worktree first." >&2; exit 1;;
esac

if [ -n "${1:-}" ]; then
  cat > HANDOFF.md <<EOT
STATUS: IN_PROGRESS

## Goal
$1

## Next steps
- [ ] [plan] Break the goal into small steps, each one line, each tagged with one of: [plan] [code] [ui] [image] [test] [review] [docs] [bulk]

## Done

## Blockers
EOT
  git add HANDOFF.md && git commit -qm "handoff: new goal"
fi
[ -f HANDOFF.md ] || { echo "No HANDOFF.md. Pass a goal: scripts/ai-run.sh \"build X\"" >&2; exit 1; }

BASE_PROMPT='Read AGENTS.md and HANDOFF.md. Run `git status` first: a previous attempt may have left partial work for this step; keep what is good.
Do ONLY the step below. Then run `npm run build` (and `npm test` if tests exist) and fix failures you caused.
Update HANDOFF.md: tick the step, move it to Done, add new tagged steps you discovered, note blockers.
If every step is done and the build passes, change the first line to "STATUS: DONE".
Commit all changes with a clear message. Do not push.

Your step:'

last_step=""; same_count=0
for round in $(seq 1 "$MAX_ROUNDS"); do
  head -1 HANDOFF.md | grep -q 'STATUS: DONE' && { echo "✓ Done after $((round-1)) rounds."; exit 0; }

  step="$(grep -m1 -E '^- \[ \]' HANDOFF.md)"
  [ -z "$step" ] && { echo "No unchecked steps but STATUS is not DONE. Check HANDOFF.md."; exit 2; }
  if [ "$step" = "$last_step" ]; then same_count=$((same_count+1)); else same_count=0; last_step="$step"; fi
  [ "$same_count" -ge 3 ] && { echo "✗ Stuck on: $step (4 rounds). Stopping."; exit 2; }

  tag="$(printf '%s' "$step" | sed -nE 's/^- \[ \] \[([a-z]+)\].*/\1/p')"; tag="${tag:-auto}"
  echo "▶ round $round ${step#- \[ \] }"

  "$HERE/ai-step.sh" "$tag" "$BASE_PROMPT $step" > "$LOG_DIR/round-$round.log"
  if [ $? -ne 0 ]; then
    echo "  every model busy or out of quota → waiting ${WAIT_MIN}m"; sleep $((WAIT_MIN*60)); continue
  fi

  # Build gate: escalate failures to the strongest model available.
  tries=0
  until sh -c "$VERIFY_CMD" > "$LOG_DIR/verify.log" 2>&1; do
    tries=$((tries+1))
    if [ "$tries" -gt "$FIX_TRIES" ]; then
      printf -- '- Build failing after step "%s" (see .ai-run/verify.log)\n' "${step#- \[ \] }" >> HANDOFF.md
      git add -A && git commit -qm "wip: build failing, needs human" >/dev/null 2>&1
      echo "✗ Build still failing after $FIX_TRIES fix attempts. Stopping."; exit 2
    fi
    echo "  build failed → fix attempt $tries"
    "$HERE/ai-step.sh" fix "Read AGENTS.md. \`$VERIFY_CMD\` fails. Fix the root cause, do not disable checks or tests. Commit. Last output:
$(tail -40 "$LOG_DIR/verify.log")" > "$LOG_DIR/round-$round-fix-$tries.log" || sleep 60
  done

  git add -A && git commit -qm "wip: round $round" >/dev/null 2>&1 || true
done
echo "Stopped after $MAX_ROUNDS rounds. See HANDOFF.md."
