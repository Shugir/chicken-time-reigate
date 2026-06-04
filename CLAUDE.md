@AGENTS.md

# Knowledge Graph (RAG)

A pre-built knowledge graph of this codebase lives in `graphify-out/`.

**Before answering any question about codebase structure, architecture, data flow, or "where is X defined":**
1. Check `graphify-out/graph.json` — 421 nodes, 633 edges, 42 communities
2. Check `graphify-out/GRAPH_REPORT.md` — god nodes, surprising connections, suggested questions

**Key facts from the graph:**
- `DB Table: menu_items` (15 edges), `DB Table: orders` (14), `DB Table: order_items` (13) — central DB nodes
- `supabaseAdmin` (13 edges) — connects every API route to the DB
- `ProductModal Component` (12 edges) — bridges menu data, cart, and ordering flow
- God nodes: `compilerOptions`, `DB Table: menu_items`, `DB Table: orders`, `supabaseAdmin`, `ProductModal Component`, `Order Page`
- New communities added: Delivery Admin UI | Store Settings Admin | Checkout Page | Checkout Cart Types | Graphify RAG Tools

**To query the graph, run:**
```
/graphify query "<question>"        # BFS - broad context
/graphify query "<question>" --dfs  # DFS - trace a path
/graphify path "NodeA" "NodeB"      # shortest path
/graphify explain "NodeName"        # all connections to a node
```

Keep graph current: run `/graphify . --update` after adding or changing files.
