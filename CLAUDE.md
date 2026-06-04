@AGENTS.md

# Knowledge Graph (RAG)

A pre-built knowledge graph of this codebase lives in `graphify-out/`.

**Before answering any question about codebase structure, architecture, data flow, or "where is X defined":**
1. Check `graphify-out/graph.json` — 311 nodes, 384 edges, 34 communities
2. Check `graphify-out/GRAPH_REPORT.md` — god nodes, surprising connections, suggested questions

**Key facts from the graph:**
- `DB Table: menu_items` is god node connected to ProductModal, Order Page, admin panel, all migrations, and checkout API
- `page.tsx` (degree=56) is the highest-connected node — order/page.tsx acts as central hub for menu, cart, and Supabase
- `extras`/`removals` JSONB columns now wired end-to-end: DB → public API → ProductModal → cart → checkout → kitchen
- God nodes: `page.tsx`, `compilerOptions`, `DB Table: menu_items`, `DB Table: orders`, `DB Table: order_items`, `ProductModal.tsx`, `Order Page`
- Communities: TypeScript Types & UI Components | API Routes & TS Types | DB Migration Schema | CLAUDE.md & Agents | Config Files | Contact Page | Next.js Type Declarations | File & Document SVG Icons | App Layout & Fonts

**To query the graph, run:**
```
/graphify query "<question>"        # BFS - broad context
/graphify query "<question>" --dfs  # DFS - trace a path
/graphify path "NodeA" "NodeB"      # shortest path
/graphify explain "NodeName"        # all connections to a node
```

Keep graph current: run `/graphify . --update` after adding or changing files.
