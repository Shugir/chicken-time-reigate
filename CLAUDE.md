@AGENTS.md

# Knowledge Graph (RAG)

A pre-built knowledge graph of this codebase lives in `graphify-out/`.

**Before answering any question about codebase structure, architecture, data flow, or "where is X defined":**
1. Check `graphify-out/graph.json`
2. Check `graphify-out/GRAPH_REPORT.md` — god nodes, surprising connections, suggested questions

**To query the graph, run:**
```
/graphify query "<question>"        # BFS - broad context
/graphify query "<question>" --dfs  # DFS - trace a path
/graphify path "NodeA" "NodeB"      # shortest path
/graphify explain "NodeName"        # all connections to a node
```

Keep graph current: run `/graphify . --update` after adding or changing files.
