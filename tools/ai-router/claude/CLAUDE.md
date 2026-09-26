<!-- BEGIN:ai-router -->
# Model routing (ai-router)

`ai-step <tag> "prompt"` sends one task to the best available model across Claude Code and
Antigravity CLI (agy). `ai-run "goal"` works through a goal unattended and keeps going through
usage limits. Routing table: `~/.ai-router/routes.conf`.

Delegate on your own, without being asked, when a task fits one of these:
- `ai-step image`: images, icons, logos, illustrations, SVG, animations (CSS, Lottie, canvas)
- `ai-step bulk`: reading or summarising many files, large logs, inventories
- `ai-step docs`: READMEs, long docs, translations
- `ai-step review`: a second opinion on risky or security-sensitive changes
Give it a self-contained prompt (goal, files, constraints, "commit when done, do not push"),
then check the diff yourself before reporting. Do everything else yourself.
Exit code 3 means no model is available for that tag: do it yourself.

For long multi-step builds, keep `HANDOFF.md` current (see `/handoff`) so that if this session
hits its usage limit, agy continues automatically from where you stopped.
If a SessionStart note says a background ai-run is active or finished, tell the user first.
<!-- END:ai-router -->
