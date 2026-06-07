# Graph Report - chicken-time-reigate  (2026-06-07)

## Corpus Check
- 151 files · ~1,798,283 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 948 nodes · 1511 edges · 108 communities (55 shown, 53 thin omitted)
- Extraction: 96% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 52 edges (avg confidence: 0.88)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `c13968e8`
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
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
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
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 57|Community 57]]
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 59|Community 59]]
- [[_COMMUNITY_Community 61|Community 61]]
- [[_COMMUNITY_Community 63|Community 63]]
- [[_COMMUNITY_Community 64|Community 64]]
- [[_COMMUNITY_Community 66|Community 66]]
- [[_COMMUNITY_Community 67|Community 67]]
- [[_COMMUNITY_Community 68|Community 68]]
- [[_COMMUNITY_Community 69|Community 69]]
- [[_COMMUNITY_Community 70|Community 70]]
- [[_COMMUNITY_Community 72|Community 72]]
- [[_COMMUNITY_Community 73|Community 73]]
- [[_COMMUNITY_Community 74|Community 74]]
- [[_COMMUNITY_Community 75|Community 75]]
- [[_COMMUNITY_Community 76|Community 76]]
- [[_COMMUNITY_Community 77|Community 77]]
- [[_COMMUNITY_Community 78|Community 78]]
- [[_COMMUNITY_Community 79|Community 79]]
- [[_COMMUNITY_Community 80|Community 80]]
- [[_COMMUNITY_Community 81|Community 81]]
- [[_COMMUNITY_Community 82|Community 82]]
- [[_COMMUNITY_Community 83|Community 83]]
- [[_COMMUNITY_Community 84|Community 84]]
- [[_COMMUNITY_Community 85|Community 85]]
- [[_COMMUNITY_Community 86|Community 86]]
- [[_COMMUNITY_Community 87|Community 87]]
- [[_COMMUNITY_Community 88|Community 88]]
- [[_COMMUNITY_Community 89|Community 89]]
- [[_COMMUNITY_Community 90|Community 90]]
- [[_COMMUNITY_Community 91|Community 91]]
- [[_COMMUNITY_Community 92|Community 92]]
- [[_COMMUNITY_Community 93|Community 93]]
- [[_COMMUNITY_Community 95|Community 95]]
- [[_COMMUNITY_Community 96|Community 96]]
- [[_COMMUNITY_Community 97|Community 97]]
- [[_COMMUNITY_Community 98|Community 98]]
- [[_COMMUNITY_Community 101|Community 101]]
- [[_COMMUNITY_Community 102|Community 102]]
- [[_COMMUNITY_Community 104|Community 104]]
- [[_COMMUNITY_Community 105|Community 105]]
- [[_COMMUNITY_Community 106|Community 106]]

## God Nodes (most connected - your core abstractions)
1. `supabaseAdmin` - 64 edges
2. `getUserPermissions` - 37 edges
3. `hasPermission()` - 32 edges
4. `compilerOptions` - 16 edges
5. `PATCH()` - 16 edges
6. `graph.json (177 nodes, 173 edges, 30 communities)` - 16 edges
7. `DB Table: menu_items` - 15 edges
8. `Task 4: Customer MenuCard — offer badge and strikethrough price` - 14 edges
9. `DB Table: orders` - 14 edges
10. `DB Table: order_items` - 13 edges

## Surprising Connections (you probably didn't know these)
- `ProductItem Interface` --semantically_similar_to--> `DB Table: menu_items`  [INFERRED] [semantically similar]
  components/ProductModal.tsx → lib/supabase-admin.ts
- `ProductItem Interface` --conceptually_related_to--> `Community: Product Modal & Types`  [INFERRED]
  components/ProductModal.tsx → CLAUDE.md
- `OrderSelection Interface` --semantically_similar_to--> `DB Table: order_items`  [INFERRED] [semantically similar]
  components/ProductModal.tsx → lib/supabase-admin.ts
- `OrderSelection Interface` --semantically_similar_to--> `order_items.notes Column`  [INFERRED] [semantically similar]
  components/ProductModal.tsx → supabase/migrations/20260609_order_items_notes.sql
- `OrderSelection Interface` --semantically_similar_to--> `order_items.extras JSONB Column`  [INFERRED] [semantically similar]
  components/ProductModal.tsx → supabase/migrations/20260613_order_items_customizations.sql

## Hyperedges (group relationships)
- **End-to-End Checkout Flow** — order_page_CartDrawer, session_storage_cart, checkout_page_CheckoutPage, api_delivery_zones_route, api_checkout_route, stripe_integration [EXTRACTED 0.95]
- **Delivery Zone Admin CRUD** — admin_delivery_DeliveryPage, admin_delivery_ZoneModal, api_admin_delivery_zones_route, api_admin_delivery_zones_id_route, db_table_delivery_zones [EXTRACTED 1.00]
- **Store Settings Read Write Split** — admin_settings_SettingsPage, api_admin_store_settings_route, api_store_settings_route, db_table_store_settings, order_page_OrderPage [INFERRED 0.85]

## Communities (108 total, 53 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.08
Nodes (33): CartItem, ComboComponent, Extra, POST(), stripe, POST(), buildHtml(), EmailOrderData (+25 more)

### Community 1 - "Community 1"
Cohesion: 0.12
Nodes (19): AboutPage(), oswald, STATS, VALUES, oswald, POPULAR, REASONS, ComboBuilderPage() (+11 more)

### Community 2 - "Community 2"
Cohesion: 0.06
Nodes (33): eslintConfig, dependencies, lucide-react, next, react, react-dom, react-hot-toast, recharts (+25 more)

### Community 3 - "Community 3"
Cohesion: 0.24
Nodes (3): GET(), PATCH(), supabaseAdmin

### Community 4 - "Community 4"
Cohesion: 0.17
Nodes (20): BADGE_STYLES, CARD_GRADIENT, Cart, cartCount(), CartDrawer(), CartEntry, cartTotal(), CATEGORIES (+12 more)

### Community 5 - "Community 5"
Cohesion: 0.12
Nodes (18): supabase/migrations/, AddItemModal Component, Admin Page, AvailabilityToggle Component, DeleteConfirmModal Component, MenuItem Interface (Admin), PriceCell Component, API: Admin Menu Items [id] Route (PATCH/DELETE) (+10 more)

### Community 6 - "Community 6"
Cohesion: 0.13
Nodes (26): DeleteConfirm Zone Component, Delivery Zones Admin Page, ZoneModal Component, Admin Sidebar Nav Pattern, Admin Page Menu Manager, AvailabilityToggle Component, DeleteConfirmModal Component, ItemModal Component (+18 more)

### Community 7 - "Community 7"
Cohesion: 0.1
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 8 - "Community 8"
Cohesion: 0.16
Nodes (12): menu_items, order_items, orders, profiles, set_updated_at(), trg_menu_items_updated_at, trg_orders_updated_at, trg_profiles_updated_at (+4 more)

### Community 9 - "Community 9"
Cohesion: 0.12
Nodes (22): geistMono, geistSans, HOURS, inter, metadata, QUICK_LINKS, RootLayout(), buildHoursRows() (+14 more)

### Community 11 - "Community 11"
Cohesion: 0.16
Nodes (22): AdminPage(), AvailabilityToggle(), CATEGORIES, Category, CATEGORY_COLOURS, CATEGORY_LABELS, COLOUR_PALETTE, COMMON_ALLERGENS (+14 more)

### Community 12 - "Community 12"
Cohesion: 0.12
Nodes (20): AdminLayout(), PermissionsContext, PermissionsContextType, AnalyticsLayout(), CategoriesLayout(), CombosLayout(), DashboardLayout(), DeliveryLayout() (+12 more)

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
Cohesion: 0.25
Nodes (15): AccountPage(), fmtDate(), OfferCard(), Order, OrderCard(), OrderItem, Profile, PromoCode (+7 more)

### Community 19 - "Community 19"
Cohesion: 0.4
Nodes (4): code:bash (npm run dev), Deploy on Vercel, Getting Started, Learn More

### Community 21 - "Community 21"
Cohesion: 0.67
Nodes (4): Globe SVG Icon, Next.js Public Asset, UI Icon, World Globe

### Community 22 - "Community 22"
Cohesion: 0.67
Nodes (3): About Page, About Stats Data (STATS), Brand Values Data (VALUES)

### Community 50 - "Community 50"
Cohesion: 0.23
Nodes (12): menu_items.extras JSONB Column, menu_items.removals JSONB Column, order_items.extras JSONB Column, order_items.notes Column, order_items.removals JSONB Column, Migration: Item Customizations (20260608), Migration: Order Items Customizations (20260613), Migration: Order Items Notes (20260609) (+4 more)

### Community 56 - "Community 56"
Cohesion: 0.04
Nodes (45): code:sql (-- Module 23: Dynamic Combo Meal Engine), code:block10 (GET http://localhost:3000/api/admin/combo-discounts), code:bash (git add app/api/admin/combo-discounts/route.ts "app/api/admi), code:typescript (combo_category: 'main' | 'side' | 'drink' | null), code:typescript (combo_category: editItem?.combo_category ?? null,), code:tsx ({/* Combo Role */}), code:typescript (combo_category: form.combo_category,), code:block16 (GET http://localhost:3000/api/menu/combo-items?category=main) (+37 more)

### Community 61 - "Community 61"
Cohesion: 0.12
Nodes (26): API: Kitchen Orders Route (GET), order_items.item_name Column, orders.stripe_session_id Column, orders.user_id (nullable - guest support), DB Table: order_items, DB Table: orders, Order Interface (Kitchen), OrderItem Interface (Kitchen) (+18 more)

### Community 67 - "Community 67"
Cohesion: 0.5
Nodes (4): Landing Page, Oswald Font (Landing Page), Popular Items Data (POPULAR), Why Choose Us Data (REASONS)

### Community 69 - "Community 69"
Cohesion: 0.18
Nodes (13): API Checkout POST, API: Kitchen Orders [id] Route (PATCH), API: Public Menu Items Route (GET), API: Stripe Webhook Route (POST), CustomerReceipt Print Component, Kitchen Dashboard Page, KitchenTicket Print Component, OrderCard Component (+5 more)

### Community 72 - "Community 72"
Cohesion: 0.05
Nodes (44): AdminSidebar(), ALL_NAV, usePermissions(), Category, CategoryForm, EMPTY_FORM, ComboDiscount, AdminDataTable() (+36 more)

### Community 74 - "Community 74"
Cohesion: 0.06
Nodes (52): AnalyticsData, AnalyticsPage(), CHART_THEME, DailyPoint, DowPoint, fmtGbp(), HourlyPoint, PERIODS (+44 more)

### Community 77 - "Community 77"
Cohesion: 0.3
Nodes (10): AddOn, ALLERGEN_DETAILS, AllergyAccordion(), CATEGORY_GRADIENT, ItemCategory, OrderSelection, ProductItem, ProductModal() (+2 more)

### Community 78 - "Community 78"
Cohesion: 0.48
Nodes (5): DriverDashboard(), mapsUrl(), multiStopMapsUrl(), Order, supabase

### Community 79 - "Community 79"
Cohesion: 0.14
Nodes (17): Community: About Page, Community: App Layout & Fonts, Community: Contact Page, Community: Core Package Manifest, Community: Landing Page, Community: Order Menu Components, Community: Product Modal & Types, Community: Supabase Database Schema (+9 more)

### Community 80 - "Community 80"
Cohesion: 0.19
Nodes (15): components/ProductModal.tsx, Cart Type (Record<string,number>), CATEGORIES Data, MenuCard Component, Order Page, AddOn Interface, ALLERGEN_DETAILS Static Map, AllergyAccordion Sub-component (+7 more)

### Community 81 - "Community 81"
Cohesion: 0.25
Nodes (6): EMPTY, FormState, HOURS, InputField(), oswald, SUBJECTS

### Community 82 - "Community 82"
Cohesion: 0.47
Nodes (6): Auth Provider (TODO: Supabase/NextAuth), NewsletterForm Component, Sign In Page, Sign Up Page, SiteHeader Component, NAV_LINKS Static Config

### Community 83 - "Community 83"
Cohesion: 0.47
Nodes (4): CartItem, CheckoutPage(), DeliveryZone, supabase

### Community 85 - "Community 85"
Cohesion: 0.5
Nodes (4): getStep(), OrderData, STEPS, TrackPage()

### Community 91 - "Community 91"
Cohesion: 0.6
Nodes (3): combo_discounts, menu_items, order_items

### Community 96 - "Community 96"
Cohesion: 0.05
Nodes (38): code:sql (-- supabase/migrations/20260629_menu_offers.sql), code:typescript (interface MenuItem {), code:typescript (const EMPTY_FORM = { name: '', description: '', price: '', i), code:typescript (const EMPTY_FORM = { name: '', description: '', price: '', c), code:typescript ({), code:typescript ({), code:typescript (: { ...EMPTY_FORM, category: categories[0]?.slug ?? '', comb), code:typescript (compare_at_price: form.compare_at_price ? parseFloat(form.co) (+30 more)

### Community 98 - "Community 98"
Cohesion: 0.06
Nodes (32): 1. Overview, 2. Database Migration, 3. Admin UI, 3a. ItemModal changes, 3b. Combos tab, 3c. New API routes, 4. Customer UI — Meal Builder Wizard, 4a. Size enforcement rules (+24 more)

### Community 102 - "Community 102"
Cohesion: 0.5
Nodes (4): Contact Page, FormState Type, Opening Hours Data (HOURS), InputField Component

## Ambiguous Edges - Review These
- `Supabase Admin Client` → `Sign In Page`  [AMBIGUOUS]
  app/sign-in/page.tsx · relation: shares_data_with
- `Supabase Admin Client` → `Sign In Page`  [AMBIGUOUS]
  app/sign-in/page.tsx · relation: shares_data_with

## Knowledge Gaps
- **289 isolated node(s):** `eslintConfig`, `config`, `nextConfig`, `name`, `version` (+284 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **53 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Supabase Admin Client` and `Sign In Page`?**
  _Edge tagged AMBIGUOUS (relation: shares_data_with) - confidence is low._
- **What is the exact relationship between `Supabase Admin Client` and `Sign In Page`?**
  _Edge tagged AMBIGUOUS (relation: shares_data_with) - confidence is low._
- **Why does `supabaseAdmin` connect `Community 3` to `Community 0`, `Community 12`, `Community 68`, `Community 70`, `Community 73`, `Community 75`, `Community 76`, `Community 84`, `Community 87`, `Community 89`, `Community 90`, `Community 92`, `Community 93`, `Community 94`, `Community 95`, `Community 97`, `Community 99`, `Community 100`, `Community 101`, `Community 104`, `Community 107`, `Community 108`?**
  _High betweenness centrality (0.109) - this node is a cross-community bridge._
- **Why does `Extra` connect `Community 11` to `Community 0`, `Community 1`?**
  _High betweenness centrality (0.095) - this node is a cross-community bridge._
- **Why does `Supabase Admin Client` connect `Community 69` to `Community 0`, `Community 82`, `Community 61`, `Community 5`?**
  _High betweenness centrality (0.094) - this node is a cross-community bridge._
- **What connects `eslintConfig`, `config`, `nextConfig` to the rest of the system?**
  _293 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.08 - nodes in this community are weakly interconnected._