Delegate this task to the best model across Claude and Antigravity CLI: $ARGUMENTS

1. Pick one tag from `~/.ai-router/routes.conf`:
   plan, fix, review, code, ui, image (images, icons, SVG, animations), test, docs, bulk (large reads, summaries).
2. Write a self-contained prompt: the goal, the files involved, constraints from AGENTS.md / CLAUDE.md, and "commit when done, do not push".
3. Run `ai-step <tag> "<prompt>"` with Bash (timeout 600000, or in the background for long work).
4. When it returns, read `git log -1 --stat` and the diff. Check the result yourself before telling the user it is done.
   If the exit code is 3, every model for that tag is out of quota: do it yourself or offer another tag.
