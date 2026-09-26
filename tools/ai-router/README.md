# ai-router

Routes coding work across Claude Code and Antigravity CLI (`agy`) by task type and remaining quota,
and keeps work going when a Claude session hits its usage limit.

## Install (once per machine)

```bash
tools/ai-router/install.sh
agy models                  # then put your exact model ids in ~/.ai-router/routes.conf
```

It installs into your user account, so every project gets it:

| Where | What |
|---|---|
| `~/.ai-router/` | `ai-step`, `ai-run`, `ai-takeover`, `routes.conf` (linked into `~/.local/bin`) |
| `~/.claude/commands/` | `/route`, `/handoff` |
| `~/.claude/CLAUDE.md` | rules so Claude delegates images, animations, bulk reads and docs on its own |
| `~/.claude/settings.json` | `StopFailure` hook (limit → agy takes over) and `SessionStart` status note |

Re-running is safe. `install.sh --uninstall` removes everything and keeps a copy of your routes.

## What happens automatically

- **In a chat**, Claude hands images, animations, bulk reading, docs and second-opinion reviews to
  the best model through `ai-step`, then checks the result.
- **When the chat hits its usage limit** inside a git repo, the `StopFailure` hook:
  1. marks every Claude model as cooling down,
  2. moves to a new `ai/auto-…` branch if you were on `main`/`master` and commits unfinished work there,
  3. has the strongest available agy model turn the conversation into tagged steps in `HANDOFF.md`,
  4. works through them in the background (`ai-run`), routing each step by tag, building after each,
     escalating build failures to the strongest model, going back to Claude when its cooldown ends.
- **Next time you open Claude Code** in that repo, it is told the run is active or finished and
  summarises it for you.

It never pushes. Opt out: `AI_TAKEOVER=0`, `touch ~/.ai-router/disabled`, or `touch .ai-run/no-takeover`.

## Commands

```bash
ai-run "goal"                # unattended from a goal (plans first)
ai-run --status | --stop
ai-step <tag|auto> "prompt"  # one routed task; exit 3 = no model available
PREFER=agy ai-run            # use agy first everywhere to save Claude quota
```

Tags: `plan fix review code ui image test docs bulk`. Order per tag is in `routes.conf`.
State is in `.ai-run/` per repo (git-excluded automatically) and quota cooldowns in `~/.ai-router/state/`.

## Limits

- Needs macOS or Linux (Windows: WSL), `git`, `python3`, and `claude` / `agy` on PATH.
- It can't read remaining quota; it learns from limit errors and cools that model down.
- Unattended steps run with `--dangerously-skip-permissions` on a branch. Set `SKIP_PERMS=0` to disable.
- agy flags and model ids come from third-party docs; check `agy --help` and `agy models`.
