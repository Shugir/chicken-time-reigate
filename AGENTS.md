<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Multi-agent handoff (Claude Code ↔ Antigravity CLI)

Claude Code and `agy` both work on this repo and take turns when a usage limit hits.
- `HANDOFF.md` is the shared state. Read it first. Keep it current after every meaningful step.
- Every step in `HANDOFF.md` starts with a tag that picks the model: `[plan] [code] [ui] [image] [test] [review] [docs] [bulk]`.
  The tag → model order lives in `scripts/ai-routes.conf`.
- Work one step at a time, run `npm run build` after changes, commit after each step.
- Never push, force-push, or edit `.env*` files unattended.
- Unattended runs: `scripts/ai-run.sh "goal"`. One routed task: `scripts/ai-step.sh <tag> "prompt"`.
- In Claude Code, `/route <task>` delegates a task (e.g. images and animations to Gemini Flash) and `/handoff` saves state.
