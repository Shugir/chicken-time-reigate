Update HANDOFF.md so another agent (Antigravity CLI `agy`) can continue without this conversation.

Format:
- First line: `STATUS: IN_PROGRESS` (or `STATUS: DONE` if everything is finished and `npm run build` passes)
- `## Goal`: one paragraph
- `## Next steps`: checkbox list, smallest steps first, each doable in one round
- `## Done`: what is finished, files touched
- `## Blockers`: open bugs, decisions needed, failing checks

Then `git add -A` and commit with message `handoff: <short summary>`. Do not push.
