Delegate this task to the best model across Claude and Antigravity CLI: $ARGUMENTS

1. Pick one tag from `scripts/ai-routes.conf`:
   plan, fix, review, code, ui, image (images, icons, SVG, animations), test, docs, bulk (large reads, summaries).
2. Write a self-contained prompt: the goal, the files involved, constraints from AGENTS.md, and "commit when done, do not push".
3. Run `scripts/ai-step.sh <tag> "<prompt>"` with Bash (timeout 600000 or run in background).
4. When it returns, read `git log -1 --stat` and the diff. Check the result yourself before telling the user it is done.
   If exit code is 3, every model for that tag is out of quota: say so and offer another tag.
