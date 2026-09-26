Update HANDOFF.md so another agent (Antigravity CLI `agy`, via `ai-run`) can continue without this conversation.

Format:
- First line: `STATUS: IN_PROGRESS` (or `STATUS: DONE` if everything is finished and the build passes)
- `## Goal`: one paragraph
- `## Next steps`: checkbox list, smallest steps first, each doable in one round, each starting with one tag
  `[plan] [code] [ui] [image] [test] [review] [docs] [bulk]` that picks the model, e.g. `- [ ] [ui] Add order history table`
- `## Done`: what is finished, files touched
- `## Blockers`: open bugs, decisions needed, failing checks

Then `git add -A` and commit with message `handoff: <short summary>`. Do not push.
If the user wants it to keep going unattended, run `ai-run` in the background.
