@AGENTS.md

# Knowledge Graph (RAG)

A pre-built knowledge graph of this codebase lives in `graphify-out/`.

**Before answering any question about codebase structure, architecture, data flow, or "where is X defined":**
1. Check `graphify-out/graph.json` — 347 nodes, 477 edges, 37 communities
2. Check `graphify-out/GRAPH_REPORT.md` — god nodes, surprising connections, suggested questions

**Key facts from the graph:**
- `DB Table: menu_items` is god node (14 edges) — connected to ProductModal, Order Page, admin panel, all migrations, checkout API
- `DB Table: orders` and `DB Table: order_items` both 14/12 edges — central to checkout and kitchen flows
- `compilerOptions` highest-connected config node (16 edges)
- God nodes: `compilerOptions`, `DB Table: menu_items`, `DB Table: orders`, `DB Table: order_items`
- Communities: TypeScript Types & UI Components | DB Migration Schema | Landing Page Components | App Layout & Fonts | Next.js Type Declarations | File & Document SVG Icons | About Page Components

**To query the graph, run:**
```
/graphify query "<question>"        # BFS - broad context
/graphify query "<question>" --dfs  # DFS - trace a path
/graphify path "NodeA" "NodeB"      # shortest path
/graphify explain "NodeName"        # all connections to a node
```

Keep graph current: run `/graphify . --update` after adding or changing files.
