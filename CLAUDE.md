@AGENTS.md

# Knowledge Graph (RAG)

A pre-built knowledge graph of this codebase lives in `graphify-out/`.

**Before answering any question about codebase structure, architecture, data flow, or "where is X defined":**
1. Check `graphify-out/graph.json` — 194 nodes, 217 edges, 25 communities
2. Check `graphify-out/GRAPH_REPORT.md` — god nodes, surprising connections, suggested questions

**Key facts from the graph:**
- `ProductItem Interface` (components/ProductModal.tsx) mirrors `DB Table: menu_items` (supabase/migrations/) — structurally identical, not yet connected in code
- `MENU_ITEMS Static Data` (app/order/page.tsx) is hardcoded duplicate of the DB table — wiring to Supabase not yet done
- God nodes: `compilerOptions`, `Order Page`, `Initial DB Schema Migration`, `ProductItem Interface`, `MENU_ITEMS Static Data`, `ProductModal Component`
- Communities: TypeScript Types & UI Components | Order Menu Components | Supabase Database Schema | Landing Page | About Page | Contact Page | App Layout & Fonts | Core Package Dependencies | CLAUDE.md & Knowledge Graph RAG | AGENTS.md & Framework Rules

**To query the graph, run:**
```
/graphify query "<question>"        # BFS - broad context
/graphify query "<question>" --dfs  # DFS - trace a path
/graphify path "NodeA" "NodeB"      # shortest path
/graphify explain "NodeName"        # all connections to a node
```

Keep graph current: run `/graphify . --update` after adding or changing files.
