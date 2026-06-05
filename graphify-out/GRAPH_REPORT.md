# Graph Report - chicken-time-reigate  (2026-06-06)

## Corpus Check
- 108 files · ~1,087,308 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 666 nodes · 1088 edges · 66 communities (42 shown, 24 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 52 edges (avg confidence: 0.88)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `1995899b`
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
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 57|Community 57]]
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 59|Community 59]]
- [[_COMMUNITY_Community 60|Community 60]]
- [[_COMMUNITY_Community 61|Community 61]]
- [[_COMMUNITY_Community 62|Community 62]]
- [[_COMMUNITY_Community 63|Community 63]]
- [[_COMMUNITY_Community 64|Community 64]]
- [[_COMMUNITY_Community 65|Community 65]]

## God Nodes (most connected - your core abstractions)
1. `supabaseAdmin` - 42 edges
2. `getUserPermissions` - 31 edges
3. `hasPermission()` - 26 edges
4. `compilerOptions` - 16 edges
5. `graph.json (177 nodes, 173 edges, 30 communities)` - 16 edges
6. `DB Table: menu_items` - 15 edges
7. `DB Table: orders` - 14 edges
8. `DB Table: order_items` - 13 edges
9. `ProductModal Component` - 12 edges
10. `dependencies` - 11 edges

## Surprising Connections (you probably didn't know these)
- `MENU_ITEMS Static Data` --references--> `Order Page (God Node)`  [INFERRED]
  app/order/page.tsx → CLAUDE.md
- `ProductItem Interface` --semantically_similar_to--> `DB Table: menu_items`  [INFERRED] [semantically similar]
  components/ProductModal.tsx → lib/supabase-admin.ts
- `ProductItem Interface` --conceptually_related_to--> `Community: Product Modal & Types`  [INFERRED]
  components/ProductModal.tsx → CLAUDE.md
- `AddOn Interface` --semantically_similar_to--> `menu_items.extras JSONB Column`  [INFERRED] [semantically similar]
  components/ProductModal.tsx → supabase/migrations/20260608_item_customizations.sql
- `Community: Product Modal & Types` --conceptually_related_to--> `ProductModal Component`  [INFERRED]
  CLAUDE.md → components/ProductModal.tsx

## Hyperedges (group relationships)
- **End-to-End Checkout Flow** — order_page_CartDrawer, session_storage_cart, checkout_page_CheckoutPage, api_delivery_zones_route, api_checkout_route, stripe_integration [EXTRACTED 0.95]
- **Delivery Zone Admin CRUD** — admin_delivery_DeliveryPage, admin_delivery_ZoneModal, api_admin_delivery_zones_route, api_admin_delivery_zones_id_route, db_table_delivery_zones [EXTRACTED 1.00]
- **Store Settings Read Write Split** — admin_settings_SettingsPage, api_admin_store_settings_route, api_store_settings_route, db_table_store_settings, order_page_OrderPage [INFERRED 0.85]

## Communities (66 total, 24 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.28
Nodes (7): Delivery, Driver, DriverLedgerPage(), fmtGbp(), LedgerData, Payout, toDateStr()

### Community 1 - "Community 1"
Cohesion: 0.06
Nodes (62): AboutPage(), oswald, STATS, VALUES, AdminPage(), AvailabilityToggle(), CATEGORIES, Category (+54 more)

### Community 2 - "Community 2"
Cohesion: 0.06
Nodes (32): eslintConfig, dependencies, lucide-react, next, react, react-dom, recharts, resend (+24 more)

### Community 3 - "Community 3"
Cohesion: 0.05
Nodes (21): DOW_LABELS, GET(), GET(), GET(), GET(), POST(), DELETE(), PATCH() (+13 more)

### Community 4 - "Community 4"
Cohesion: 0.17
Nodes (17): API Checkout POST, API: Kitchen Orders [id] Route (PATCH), API: Kitchen Orders Route (GET), API: Public Menu Items Route (GET), API: Stripe Webhook Route (POST), DB Table: orders, CustomerReceipt Print Component, Kitchen Dashboard Page (+9 more)

### Community 5 - "Community 5"
Cohesion: 0.07
Nodes (47): usePermissions(), AnalyticsData, AnalyticsPage(), CHART_THEME, DailyPoint, DowPoint, fmtGbp(), HourlyPoint (+39 more)

### Community 6 - "Community 6"
Cohesion: 0.13
Nodes (26): DeleteConfirm Zone Component, Delivery Zones Admin Page, ZoneModal Component, Admin Sidebar Nav Pattern, Admin Page Menu Manager, AvailabilityToggle Component, DeleteConfirmModal Component, ItemModal Component (+18 more)

### Community 7 - "Community 7"
Cohesion: 0.1
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 8 - "Community 8"
Cohesion: 0.15
Nodes (13): menu_items, order_items, orders, profiles, set_updated_at(), trg_menu_items_updated_at, trg_orders_updated_at, trg_profiles_updated_at (+5 more)

### Community 9 - "Community 9"
Cohesion: 0.25
Nodes (10): geistMono, geistSans, HOURS, inter, metadata, QUICK_LINKS, RootLayout(), NewsletterForm() (+2 more)

### Community 11 - "Community 11"
Cohesion: 0.47
Nodes (6): Auth Provider (TODO: Supabase/NextAuth), NewsletterForm Component, Sign In Page, Sign Up Page, SiteHeader Component, NAV_LINKS Static Config

### Community 12 - "Community 12"
Cohesion: 0.13
Nodes (17): AdminLayout(), PermissionsContext, PermissionsContextType, AnalyticsLayout(), CategoriesLayout(), DashboardLayout(), DeliveryLayout(), DriversLayout() (+9 more)

### Community 13 - "Community 13"
Cohesion: 0.29
Nodes (6): GRAPH_REPORT.md, graphify-out/ Directory, Knowledge Graph (RAG), This is NOT the Next.js you know, code:block1 (/graphify query "<question>"        # BFS - broad context), Knowledge Graph (RAG)

### Community 14 - "Community 14"
Cohesion: 0.33
Nodes (7): Next.js Breaking Changes Warning, Next.js Docs in node_modules, AGENTS.md Reference, .next/dev/types/routes.d.ts, next/image-types/global (type reference), next (type reference), Next.js Type Declarations

### Community 15 - "Community 15"
Cohesion: 0.53
Nodes (6): Document Representation, File/Document Icon SVG, Folded Corner Page Visual, Gray Color Styling (#666), Text Line Indicators, UI Icon Asset

### Community 16 - "Community 16"
Cohesion: 0.4
Nodes (5): Geist & Inter Google Fonts, App Metadata (Chicken Time Reigate), NewsletterForm Component (used in layout), Root Layout, SiteHeader Component (used in layout)

### Community 18 - "Community 18"
Cohesion: 0.47
Nodes (4): CartItem, CheckoutPage(), DeliveryZone, supabase

### Community 19 - "Community 19"
Cohesion: 0.4
Nodes (4): code:bash (npm run dev), Deploy on Vercel, Getting Started, Learn More

### Community 21 - "Community 21"
Cohesion: 0.67
Nodes (4): Globe SVG Icon, Next.js Public Asset, UI Icon, World Globe

### Community 22 - "Community 22"
Cohesion: 0.67
Nodes (3): About Page, About Stats Data (STATS), Brand Values Data (VALUES)

### Community 46 - "Community 46"
Cohesion: 0.12
Nodes (18): Community: About Page, Community: App Layout & Fonts, Community: Contact Page, Community: Core Package Manifest, Community: Landing Page, Community: Order Menu Components, Community: Product Modal & Types, Community: Supabase Database Schema (+10 more)

### Community 47 - "Community 47"
Cohesion: 0.06
Nodes (34): AdminSidebar(), ALL_NAV, Category, CategoryForm, EMPTY_FORM, DeleteConfirm(), DeliveryPage(), DeliveryZone (+26 more)

### Community 50 - "Community 50"
Cohesion: 0.24
Nodes (14): menu_items.extras JSONB Column, menu_items.removals JSONB Column, order_items.extras JSONB Column, order_items.notes Column, order_items.removals JSONB Column, DB Table: order_items, Migration: Item Customizations (20260608), Migration: Order Items Customizations (20260613) (+6 more)

### Community 53 - "Community 53"
Cohesion: 0.21
Nodes (11): fmtDate(), Order, OrderCard(), OrderItem, Profile, statusColor(), statusLabel(), supabase (+3 more)

### Community 56 - "Community 56"
Cohesion: 0.26
Nodes (9): CartItem, Extra, POST(), stripe, buildHtml(), EmailOrderData, OrderEmailStatus, sendOrderStatusEmail() (+1 more)

### Community 58 - "Community 58"
Cohesion: 0.12
Nodes (18): supabase/migrations/, AddItemModal Component, Admin Page, AvailabilityToggle Component, DeleteConfirmModal Component, MenuItem Interface (Admin), PriceCell Component, API: Admin Menu Items [id] Route (PATCH/DELETE) (+10 more)

### Community 59 - "Community 59"
Cohesion: 0.19
Nodes (13): MENU_ITEMS hardcoded duplicate — Supabase not yet wired, app/order/page.tsx, Cart Type (Record<string,number>), CartDrawer Component, cartTotal Helper, CATEGORIES Data, MenuCard Component, MENU_ITEMS Static Data (+5 more)

### Community 60 - "Community 60"
Cohesion: 0.22
Nodes (10): components/ProductModal.tsx, AddOn Interface, ALLERGEN_DETAILS Static Map, AllergyAccordion Sub-component, AllergyAccordion Component, ProductModal Component, ItemCategory Type, ProductItem Interface (+2 more)

### Community 61 - "Community 61"
Cohesion: 0.43
Nodes (8): Migration: Kitchen Policies (20260607), Migration: Kitchen RLS Permissive (20260612), RLS Policy: kitchen read active orders, RLS Policy: kitchen read order items, RLS Policy: kitchen_select_items (permissive), RLS Policy: kitchen_select_orders (permissive), RLS Policy: kitchen_update_orders (permissive), RLS Policy: kitchen update status

### Community 62 - "Community 62"
Cohesion: 0.4
Nodes (5): order_items.item_name Column, orders.stripe_session_id Column, orders.user_id (nullable - guest support), Migration: Allow Guest Orders (20260604), Migration: Guest Checkout (20260605)

### Community 63 - "Community 63"
Cohesion: 0.5
Nodes (4): Contact Page, FormState Type, Opening Hours Data (HOURS), InputField Component

## Ambiguous Edges - Review These
- `Supabase Admin Client` → `Sign In Page`  [AMBIGUOUS]
  app/sign-in/page.tsx · relation: shares_data_with
- `Supabase Admin Client` → `Sign In Page`  [AMBIGUOUS]
  app/sign-in/page.tsx · relation: shares_data_with

## Knowledge Gaps
- **178 isolated node(s):** `DIETARY_FLAGS`, `DIETARY_FLAGS`, `eslintConfig`, `config`, `nextConfig` (+173 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **24 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Supabase Admin Client` and `Sign In Page`?**
  _Edge tagged AMBIGUOUS (relation: shares_data_with) - confidence is low._
- **What is the exact relationship between `Supabase Admin Client` and `Sign In Page`?**
  _Edge tagged AMBIGUOUS (relation: shares_data_with) - confidence is low._
- **Why does `supabaseAdmin` connect `Community 3` to `Community 56`, `Community 12`?**
  _High betweenness centrality (0.151) - this node is a cross-community bridge._
- **Why does `Supabase Admin Client` connect `Community 4` to `Community 11`, `Community 65`, `Community 58`, `Community 3`?**
  _High betweenness centrality (0.146) - this node is a cross-community bridge._
- **Why does `Extra` connect `Community 1` to `Community 3`?**
  _High betweenness centrality (0.122) - this node is a cross-community bridge._
- **What connects `DIETARY_FLAGS`, `DIETARY_FLAGS`, `eslintConfig` to the rest of the system?**
  _182 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.06 - nodes in this community are weakly interconnected._