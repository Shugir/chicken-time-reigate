# Graph Report - chicken-time-reigate  (2026-06-04)

## Corpus Check
- 55 files · ~1,067,112 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 427 nodes · 631 edges · 45 communities (32 shown, 13 thin omitted)
- Extraction: 91% EXTRACTED · 8% INFERRED · 0% AMBIGUOUS · INFERRED: 53 edges (avg confidence: 0.88)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `b6e0fb9f`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 16 edges
2. `graph.json (177 nodes, 173 edges, 30 communities)` - 16 edges
3. `supabaseAdmin` - 16 edges
4. `DB Table: menu_items` - 15 edges
5. `DB Table: orders` - 14 edges
6. `DB Table: order_items` - 13 edges
7. `ProductModal Component` - 12 edges
8. `Order Page` - 11 edges
9. `ProductItem Interface` - 11 edges
10. `Initial DB Schema Migration` - 10 edges

## Surprising Connections (you probably didn't know these)
- `OrderSelection Interface` --semantically_similar_to--> `DB Table: order_items`  [INFERRED] [semantically similar]
  components/ProductModal.tsx → lib/supabase-admin.ts
- `Initial DB Schema Migration` --conceptually_related_to--> `Community: Supabase Database Schema`  [INFERRED]
  supabase/migrations/20260603_initial_schema.sql → CLAUDE.md
- `DB Table: order_items` --semantically_similar_to--> `OrderSelection Interface`  [INFERRED] [semantically similar]
  lib/supabase-admin.ts → components/ProductModal.tsx
- `MENU_ITEMS Static Data` --references--> `app/order/page.tsx`  [EXTRACTED]
  app/order/page.tsx → CLAUDE.md
- `MENU_ITEMS Static Data` --rationale_for--> `MENU_ITEMS hardcoded duplicate — Supabase not yet wired`  [EXTRACTED]
  app/order/page.tsx → CLAUDE.md

## Hyperedges (group relationships)
- **End-to-End Checkout Flow** — order_page_CartDrawer, session_storage_cart, checkout_page_CheckoutPage, api_delivery_zones_route, api_checkout_route, stripe_integration [EXTRACTED 0.95]
- **Delivery Zone Admin CRUD** — admin_delivery_DeliveryPage, admin_delivery_ZoneModal, api_admin_delivery_zones_route, api_admin_delivery_zones_id_route, db_table_delivery_zones [EXTRACTED 1.00]
- **Store Settings Read Write Split** — admin_settings_SettingsPage, api_admin_store_settings_route, api_store_settings_route, db_table_store_settings, order_page_OrderPage [INFERRED 0.85]

## Communities (45 total, 13 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.05
Nodes (60): Community: About Page, Community: App Layout & Fonts, Community: Contact Page, Community: Core Package Manifest, Community: Landing Page, Community: Order Menu Components, Community: Product Modal & Types, Community: Supabase Database Schema (+52 more)

### Community 1 - "Community 1"
Cohesion: 0.09
Nodes (33): STATS, VALUES, AdminPage(), AvailabilityToggle(), CATEGORIES, Category, CATEGORY_COLOURS, CATEGORY_LABELS (+25 more)

### Community 2 - "Community 2"
Cohesion: 0.06
Nodes (29): dependencies, next, react, react-dom, devDependencies, eslint, @tailwindcss/postcss, @types/node (+21 more)

### Community 3 - "Community 3"
Cohesion: 0.1
Nodes (14): CartItem, Extra, POST(), stripe, GET(), DELETE(), PATCH(), supabaseAdmin (+6 more)

### Community 4 - "Community 4"
Cohesion: 0.07
Nodes (45): AddItemModal Component, Admin Page, AvailabilityToggle Component, DeleteConfirmModal Component, PriceCell Component, API: Admin Menu Items [id] Route (PATCH/DELETE), API: Admin Menu Items Route (GET/POST), API Checkout POST (+37 more)

### Community 5 - "Community 5"
Cohesion: 0.14
Nodes (25): AddOn, ALLERGEN_DETAILS, AllergyAccordion(), CATEGORY_GRADIENT, ItemCategory, OrderSelection, ProductItem, ProductModal() (+17 more)

### Community 6 - "Community 6"
Cohesion: 0.13
Nodes (26): DeleteConfirm Zone Component, Delivery Zones Admin Page, ZoneModal Component, Admin Sidebar Nav Pattern, Admin Page Menu Manager, AvailabilityToggle Component, DeleteConfirmModal Component, ItemModal Component (+18 more)

### Community 7 - "Community 7"
Cohesion: 0.1
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 8 - "Community 8"
Cohesion: 0.19
Nodes (9): profiles, set_updated_at(), trg_menu_items_updated_at, trg_orders_updated_at, trg_profiles_updated_at, order_items, orders, order_items (+1 more)

### Community 9 - "Community 9"
Cohesion: 0.25
Nodes (10): geistMono, geistSans, HOURS, inter, metadata, QUICK_LINKS, RootLayout(), NewsletterForm() (+2 more)

### Community 11 - "Community 11"
Cohesion: 0.43
Nodes (6): DeleteConfirm(), DeliveryPage(), DeliveryZone, NAV, SaveState, ZoneModal()

### Community 12 - "Community 12"
Cohesion: 0.29
Nodes (3): NAV, Promotion, SaveState

### Community 13 - "Community 13"
Cohesion: 0.29
Nodes (5): GRAPH_REPORT.md, graphify-out/ Directory, Knowledge Graph (RAG), This is NOT the Next.js you know, code:block1 (/graphify query "<question>"        # BFS - broad context)

### Community 14 - "Community 14"
Cohesion: 0.33
Nodes (7): Next.js Breaking Changes Warning, Next.js Docs in node_modules, AGENTS.md Reference, .next/dev/types/routes.d.ts, next/image-types/global (type reference), next (type reference), Next.js Type Declarations

### Community 15 - "Community 15"
Cohesion: 0.53
Nodes (6): Document Representation, File/Document Icon SVG, Folded Corner Page Visual, Gray Color Styling (#666), Text Line Indicators, UI Icon Asset

### Community 16 - "Community 16"
Cohesion: 0.33
Nodes (6): Geist & Inter Google Fonts, App Metadata (Chicken Time Reigate), NewsletterForm Component (used in layout), Root Layout, SiteHeader Component (used in layout), Next.js Config

### Community 17 - "Community 17"
Cohesion: 0.6
Nodes (3): SaveState, SettingsPage(), StoreSettings

### Community 18 - "Community 18"
Cohesion: 0.6
Nodes (3): CartItem, CheckoutPage(), DeliveryZone

### Community 19 - "Community 19"
Cohesion: 0.4
Nodes (4): code:bash (npm run dev), Deploy on Vercel, Getting Started, Learn More

### Community 20 - "Community 20"
Cohesion: 0.5
Nodes (4): Contact Page, FormState Type, Opening Hours Data (HOURS), InputField Component

### Community 21 - "Community 21"
Cohesion: 0.67
Nodes (4): Globe SVG Icon, Next.js Public Asset, UI Icon, World Globe

### Community 22 - "Community 22"
Cohesion: 0.67
Nodes (3): About Page, About Stats Data (STATS), Brand Values Data (VALUES)

### Community 42 - "Community 42"
Cohesion: 0.47
Nodes (6): Auth Provider (TODO: Supabase/NextAuth), NewsletterForm Component, Sign In Page, Sign Up Page, SiteHeader Component, NAV_LINKS Static Config

## Ambiguous Edges - Review These
- `Supabase Admin Client` → `Sign In Page`  [AMBIGUOUS]
  app/sign-in/page.tsx · relation: shares_data_with
- `Supabase Admin Client` → `Sign In Page`  [AMBIGUOUS]
  app/sign-in/page.tsx · relation: shares_data_with

## Knowledge Gaps
- **130 isolated node(s):** `Promotion`, `SaveState`, `NAV`, `delivery_zones`, `promotions` (+125 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **13 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Supabase Admin Client` and `Sign In Page`?**
  _Edge tagged AMBIGUOUS (relation: shares_data_with) - confidence is low._
- **What is the exact relationship between `Supabase Admin Client` and `Sign In Page`?**
  _Edge tagged AMBIGUOUS (relation: shares_data_with) - confidence is low._
- **Why does `Supabase Admin Client` connect `Community 4` to `Community 0`, `Community 42`, `Community 3`?**
  _High betweenness centrality (0.166) - this node is a cross-community bridge._
- **Why does `stripe` connect `Community 3` to `Community 2`?**
  _High betweenness centrality (0.110) - this node is a cross-community bridge._
- **Why does `dependencies` connect `Community 2` to `Community 3`?**
  _High betweenness centrality (0.103) - this node is a cross-community bridge._
- **Are the 7 inferred relationships involving `DB Table: menu_items` (e.g. with `MENU_ITEMS Static Data` and `ProductItem Interface`) actually correct?**
  _`DB Table: menu_items` has 7 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Promotion`, `SaveState`, `NAV` to the rest of the system?**
  _134 weakly-connected nodes found - possible documentation gaps or missing edges._