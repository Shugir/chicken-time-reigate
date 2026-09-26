#!/usr/bin/env bash
# Install ai-router for your user account so every project gets Claude Code ↔ agy routing:
#   ~/.ai-router/            scripts + routes.conf (your model table)
#   ~/.local/bin/            ai-step, ai-run, ai-takeover on PATH
#   ~/.claude/commands/      /route and /handoff in every project
#   ~/.claude/CLAUDE.md      auto-delegation rules (between ai-router markers)
#   ~/.claude/settings.json  StopFailure hook (limit → agy takes over) + SessionStart status
# Usage: tools/ai-router/install.sh [--uninstall]
set -euo pipefail

SRC="$(cd "$(dirname "$0")" && pwd)"
AIR_HOME="${AI_ROUTER_HOME:-$HOME/.ai-router}"
CLAUDE_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
BIN_DIR="$HOME/.local/bin"
SETTINGS="$CLAUDE_DIR/settings.json"
MEMORY="$CLAUDE_DIR/CLAUDE.md"
command -v python3 >/dev/null || { echo "python3 is required" >&2; exit 1; }

# Adds or removes the ai-router hooks and permissions in settings.json, keeping everything else.
edit_settings() {
  python3 - "$SETTINGS" "$1" "$AIR_HOME" <<'PY'
import json, os, sys
path, mode, home = sys.argv[1:4]
data = {}
if os.path.exists(path) and os.path.getsize(path):
    with open(path) as f:
        data = json.load(f)
hooks = data.setdefault("hooks", {})
for event in ("StopFailure", "SessionStart"):
    groups = [g for g in hooks.get(event, [])
              if not any(".ai-router/" in h.get("command", "") for h in g.get("hooks", []))]
    if groups: hooks[event] = groups
    else: hooks.pop(event, None)
rules = ["Bash(ai-step:*)", "Bash(ai-run:*)"]
allow = data.setdefault("permissions", {}).setdefault("allow", [])
allow[:] = [r for r in allow if r not in rules]
if mode == "install":
    hooks.setdefault("StopFailure", []).append({"matcher": "rate_limit|billing_error",
        "hooks": [{"type": "command", "command": f"{home}/bin/ai-takeover", "timeout": 30}]})
    hooks.setdefault("SessionStart", []).append(
        {"hooks": [{"type": "command", "command": f"{home}/bin/ai-run --status --hook", "timeout": 10}]})
    allow.extend(rules)
if not hooks: data.pop("hooks")
if not allow: data["permissions"].pop("allow")
if not data["permissions"]: data.pop("permissions")
with open(path, "w") as f:
    json.dump(data, f, indent=2); f.write("\n")
PY
}

# Replaces the block between ai-router markers in ~/.claude/CLAUDE.md (or removes it).
edit_memory() {
  python3 - "$MEMORY" "$1" "$SRC/claude/CLAUDE.md" <<'PY'
import os, re, sys
path, mode, block_src = sys.argv[1:4]
text = open(path).read() if os.path.exists(path) else ""
text = re.sub(r"\n*<!-- BEGIN:ai-router -->.*?<!-- END:ai-router -->\n?", "\n", text, flags=re.S).strip()
if mode == "install":
    text = (text + "\n\n" if text else "") + open(block_src).read().strip()
open(path, "w").write(text + "\n" if text else "")
PY
}

mkdir -p "$CLAUDE_DIR/commands"
[ -f "$SETTINGS" ] && cp "$SETTINGS" "$SETTINGS.bak-ai-router"

if [ "${1:-}" = "--uninstall" ]; then
  edit_settings uninstall; edit_memory uninstall
  for b in ai-step ai-run ai-takeover; do rm -f "$BIN_DIR/$b"; done
  for c in route handoff; do
    cmp -s "$SRC/claude/commands/$c.md" "$CLAUDE_DIR/commands/$c.md" && rm -f "$CLAUDE_DIR/commands/$c.md"
  done
  [ -f "$AIR_HOME/routes.conf" ] && cp "$AIR_HOME/routes.conf" "$HOME/.ai-router-routes.conf.bak"
  rm -rf "$AIR_HOME"
  echo "ai-router removed. Your routes.conf was saved to ~/.ai-router-routes.conf.bak"
  exit 0
fi

mkdir -p "$AIR_HOME/bin" "$AIR_HOME/state" "$BIN_DIR"
cp "$SRC"/bin/* "$AIR_HOME/bin/"; chmod +x "$AIR_HOME"/bin/*
for b in ai-step ai-run ai-takeover; do ln -sf "$AIR_HOME/bin/$b" "$BIN_DIR/$b"; done

if [ -f "$AIR_HOME/routes.conf" ] && ! cmp -s "$SRC/routes.conf" "$AIR_HOME/routes.conf"; then
  cp "$SRC/routes.conf" "$AIR_HOME/routes.conf.new"
  echo "Kept your ~/.ai-router/routes.conf (the new default is in routes.conf.new)"
else
  cp "$SRC/routes.conf" "$AIR_HOME/routes.conf"
fi

for c in route handoff; do
  dst="$CLAUDE_DIR/commands/$c.md"
  [ -f "$dst" ] && ! cmp -s "$SRC/claude/commands/$c.md" "$dst" && cp "$dst" "$dst.bak"
  cp "$SRC/claude/commands/$c.md" "$dst"
done
edit_memory install
edit_settings install

case ":$PATH:" in *":$BIN_DIR:"*) ;; *)
  for rc in "$HOME/.zshrc" "$HOME/.bashrc"; do
    [ -f "$rc" ] && ! grep -q 'ai-router PATH' "$rc" && \
      printf '\nexport PATH="$HOME/.local/bin:$PATH"  # ai-router PATH\n' >> "$rc"
  done
  echo "Added ~/.local/bin to PATH in your shell rc. Open a new terminal." ;;
esac

echo "ai-router installed."
command -v claude >/dev/null || echo "  ! claude not found on PATH"
command -v agy >/dev/null || echo "  ! agy not found on PATH"
echo "Next: run \`agy models\` and put your exact model ids in ~/.ai-router/routes.conf"
