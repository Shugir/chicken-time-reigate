# Graph Report - .  (2026-06-04)

## Corpus Check
- 46 files · ~1,064,631 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 421 nodes · 633 edges · 42 communities (32 shown, 10 thin omitted)
- Extraction: 91% EXTRACTED · 9% INFERRED · 0% AMBIGUOUS · INFERRED: 54 edges (avg confidence: 0.88)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Core Domain Model & RAG|Core Domain Model & RAG]]
- [[_COMMUNITY_Admin & About Pages|Admin & About Pages]]
- [[_COMMUNITY_Package Dependencies|Package Dependencies]]
- [[_COMMUNITY_API Routes & Handlers|API Routes & Handlers]]
- [[_COMMUNITY_Menu Admin Components|Menu Admin Components]]
- [[_COMMUNITY_Product Modal & Customizations|Product Modal & Customizations]]
- [[_COMMUNITY_Delivery Admin UI|Delivery Admin UI]]
- [[_COMMUNITY_TypeScript Compiler Config|TypeScript Compiler Config]]
- [[_COMMUNITY_Initial DB Schema|Initial DB Schema]]
- [[_COMMUNITY_App Layout & Fonts|App Layout & Fonts]]
- [[_COMMUNITY_Brand & Identity|Brand & Identity]]
- [[_COMMUNITY_Delivery Page Nodes|Delivery Page Nodes]]
- [[_COMMUNITY_Kitchen RLS Policies|Kitchen RLS Policies]]
- [[_COMMUNITY_Graphify RAG Tools|Graphify RAG Tools]]
- [[_COMMUNITY_Dev Config & Agents|Dev Config & Agents]]
- [[_COMMUNITY_File SVG Icons|File SVG Icons]]
- [[_COMMUNITY_App Root Layout|App Root Layout]]
- [[_COMMUNITY_Store Settings Admin|Store Settings Admin]]
- [[_COMMUNITY_Checkout Page|Checkout Page]]
- [[_COMMUNITY_README & Docs|README & Docs]]
- [[_COMMUNITY_Contact Page|Contact Page]]
- [[_COMMUNITY_Globe SVG Icon|Globe SVG Icon]]
- [[_COMMUNITY_About Page|About Page]]
- [[_COMMUNITY_Store Settings Migration|Store Settings Migration]]
- [[_COMMUNITY_Checkout Cart Types|Checkout Cart Types]]
- [[_COMMUNITY_Next.js Config|Next.js Config]]
- [[_COMMUNITY_Next & Vercel SVGs|Next & Vercel SVGs]]
- [[_COMMUNITY_Guest Orders Migration|Guest Orders Migration]]
- [[_COMMUNITY_Item Customizations Migration|Item Customizations Migration]]
- [[_COMMUNITY_TSConfig Root|TSConfig Root]]
- [[_COMMUNITY_Cart Count Helper|Cart Count Helper]]
- [[_COMMUNITY_README Project|README Project]]
- [[_COMMUNITY_Window SVG Icon|Window SVG Icon]]

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 16 edges
2. `graph.json (177 nodes, 173 edges, 30 communities)` - 16 edges
3. `DB Table: menu_items` - 15 edges
4. `DB Table: orders` - 14 edges
5. `DB Table: order_items` - 13 edges
6. `supabaseAdmin` - 13 edges
7. `ProductModal Component` - 12 edges
8. `Order Page` - 11 edges
9. `ProductItem Interface` - 11 edges
10. `Initial DB Schema Migration` - 10 edges

## Surprising Connections (you probably didn't know these)
- `MENU_ITEMS Static Data` --references--> `app/order/page.tsx`  [EXTRACTED]
  app/order/page.tsx → CLAUDE.md
- `MENU_ITEMS Static Data` --rationale_for--> `MENU_ITEMS hardcoded duplicate — Supabase not yet wired`  [EXTRACTED]
  app/order/page.tsx → CLAUDE.md
- `MENU_ITEMS Static Data` --references--> `Order Page (God Node)`  [INFERRED]
  app/order/page.tsx → CLAUDE.md
- `ProductItem Interface` --semantically_similar_to--> `DB Table: menu_items`  [INFERRED] [semantically similar]
  components/ProductModal.tsx → lib/supabase-admin.ts
- `ProductItem Interface` --references--> `components/ProductModal.tsx`  [EXTRACTED]
  components/ProductModal.tsx → CLAUDE.md

## Hyperedges (group relationships)
- **End-to-End Checkout Flow** — order_page_CartDrawer, session_storage_cart, checkout_page_CheckoutPage, api_delivery_zones_route, api_checkout_route, stripe_integration [EXTRACTED 0.95]
- **Delivery Zone Admin CRUD** — admin_delivery_DeliveryPage, admin_delivery_ZoneModal, api_admin_delivery_zones_route, api_admin_delivery_zones_id_route, db_table_delivery_zones [EXTRACTED 1.00]
- **Store Settings Read Write Split** — admin_settings_SettingsPage, api_admin_store_settings_route, api_store_settings_route, db_table_store_settings, order_page_OrderPage [INFERRED 0.85]

## Communities (42 total, 10 thin omitted)

### Community 0 - "Core Domain Model & RAG"
Cohesion: 0.05
Nodes (66): Community: About Page, Community: App Layout & Fonts, Community: Contact Page, Community: Core Package Manifest, Community: Landing Page, Community: Order Menu Components, Community: Product Modal & Types, Community: Supabase Database Schema (+58 more)

### Community 1 - "Admin & About Pages"
Cohesion: 0.07
Nodes (39): STATS, VALUES, AdminPage(), AvailabilityToggle(), CATEGORIES, Category, CATEGORY_COLOURS, CATEGORY_LABELS (+31 more)

### Community 2 - "Package Dependencies"
Cohesion: 0.06
Nodes (29): dependencies, next, react, react-dom, devDependencies, eslint, @tailwindcss/postcss, @types/node (+21 more)

### Community 3 - "API Routes & Handlers"
Cohesion: 0.12
Nodes (13): CartItem, Extra, POST(), stripe, GET(), DELETE(), PATCH(), supabaseAdmin (+5 more)

### Community 4 - "Menu Admin Components"
Cohesion: 0.09
Nodes (31): AddItemModal Component, Admin Page, AvailabilityToggle Component, DeleteConfirmModal Component, PriceCell Component, API: Admin Menu Items [id] Route (PATCH/DELETE), API: Admin Menu Items Route (GET/POST), API Checkout POST (+23 more)

### Community 5 - "Product Modal & Customizations"
Cohesion: 0.14
Nodes (25): AddOn, ALLERGEN_DETAILS, AllergyAccordion(), CATEGORY_GRADIENT, ItemCategory, OrderSelection, ProductItem, ProductModal() (+17 more)

### Community 6 - "Delivery Admin UI"
Cohesion: 0.13
Nodes (26): DeleteConfirm Zone Component, Delivery Zones Admin Page, ZoneModal Component, Admin Sidebar Nav Pattern, Admin Page Menu Manager, AvailabilityToggle Component, DeleteConfirmModal Component, ItemModal Component (+18 more)

### Community 7 - "TypeScript Compiler Config"
Cohesion: 0.1
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 8 - "Initial DB Schema"
Cohesion: 0.19
Nodes (9): profiles, set_updated_at(), trg_menu_items_updated_at, trg_orders_updated_at, trg_profiles_updated_at, order_items, orders, order_items (+1 more)

### Community 9 - "App Layout & Fonts"
Cohesion: 0.25
Nodes (10): geistMono, geistSans, HOURS, inter, metadata, QUICK_LINKS, RootLayout(), NewsletterForm() (+2 more)

### Community 10 - "Brand & Identity"
Cohesion: 0.33
Nodes (11): Clock Face Motif, Flat Cartoon Badge Logo Style, Ornate Artisan Illustrated Logo Style, Tagline: Piri Piri & Perfection, Rooster Mascot — Chef Character, Primary Brand Logo Mockup (Website Context), Chicken Time Flat Badge Logo (PNG), Logo v1 — Clean Transparent Badge (PNG) (+3 more)

### Community 11 - "Delivery Page Nodes"
Cohesion: 0.43
Nodes (6): DeleteConfirm(), DeliveryPage(), DeliveryZone, NAV, SaveState, ZoneModal()

### Community 12 - "Kitchen RLS Policies"
Cohesion: 0.43
Nodes (8): Migration: Kitchen Policies (20260607), Migration: Kitchen RLS Permissive (20260612), RLS Policy: kitchen read active orders, RLS Policy: kitchen read order items, RLS Policy: kitchen_select_items (permissive), RLS Policy: kitchen_select_orders (permissive), RLS Policy: kitchen_update_orders (permissive), RLS Policy: kitchen update status

### Community 13 - "Graphify RAG Tools"
Cohesion: 0.29
Nodes (5): GRAPH_REPORT.md, graphify-out/ Directory, Knowledge Graph (RAG), This is NOT the Next.js you know, code:block1 (/graphify query "<question>"        # BFS - broad context)

### Community 14 - "Dev Config & Agents"
Cohesion: 0.33
Nodes (7): Next.js Breaking Changes Warning, Next.js Docs in node_modules, AGENTS.md Reference, .next/dev/types/routes.d.ts, next/image-types/global (type reference), next (type reference), Next.js Type Declarations

### Community 15 - "File SVG Icons"
Cohesion: 0.53
Nodes (6): Document Representation, File/Document Icon SVG, Folded Corner Page Visual, Gray Color Styling (#666), Text Line Indicators, UI Icon Asset

### Community 16 - "App Root Layout"
Cohesion: 0.33
Nodes (6): Geist & Inter Google Fonts, App Metadata (Chicken Time Reigate), NewsletterForm Component (used in layout), Root Layout, SiteHeader Component (used in layout), Next.js Config

### Community 17 - "Store Settings Admin"
Cohesion: 0.6
Nodes (3): SaveState, SettingsPage(), StoreSettings

### Community 18 - "Checkout Page"
Cohesion: 0.6
Nodes (3): CartItem, CheckoutPage(), DeliveryZone

### Community 19 - "README & Docs"
Cohesion: 0.4
Nodes (4): code:bash (npm run dev), Deploy on Vercel, Getting Started, Learn More

### Community 20 - "Contact Page"
Cohesion: 0.5
Nodes (4): Contact Page, FormState Type, Opening Hours Data (HOURS), InputField Component

### Community 21 - "Globe SVG Icon"
Cohesion: 0.67
Nodes (4): Globe SVG Icon, Next.js Public Asset, UI Icon, World Globe

### Community 22 - "About Page"
Cohesion: 0.67
Nodes (3): About Page, About Stats Data (STATS), Brand Values Data (VALUES)

## Ambiguous Edges - Review These
- `Supabase Admin Client` → `Sign In Page`  [AMBIGUOUS]
  app/sign-in/page.tsx · relation: shares_data_with
- `Supabase Admin Client` → `Sign In Page`  [AMBIGUOUS]
  app/sign-in/page.tsx · relation: shares_data_with

## Knowledge Gaps
- **124 isolated node(s):** `store_settings`, `IconComponent`, `NAV_LINKS`, `version`, `private` (+119 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **10 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Supabase Admin Client` and `Sign In Page`?**
  _Edge tagged AMBIGUOUS (relation: shares_data_with) - confidence is low._
- **What is the exact relationship between `Supabase Admin Client` and `Sign In Page`?**
  _Edge tagged AMBIGUOUS (relation: shares_data_with) - confidence is low._
- **Why does `Supabase Admin Client` connect `Menu Admin Components` to `Admin & About Pages`, `API Routes & Handlers`?**
  _High betweenness centrality (0.163) - this node is a cross-community bridge._
- **Why does `stripe` connect `API Routes & Handlers` to `Package Dependencies`?**
  _High betweenness centrality (0.111) - this node is a cross-community bridge._
- **Why does `dependencies` connect `Package Dependencies` to `API Routes & Handlers`?**
  _High betweenness centrality (0.104) - this node is a cross-community bridge._
- **Are the 7 inferred relationships involving `DB Table: menu_items` (e.g. with `MENU_ITEMS Static Data` and `ProductItem Interface`) actually correct?**
  _`DB Table: menu_items` has 7 INFERRED edges - model-reasoned connections that need verification._
- **Are the 4 inferred relationships involving `DB Table: order_items` (e.g. with `OrderSelection Interface` and `API: Kitchen Orders Route (GET)`) actually correct?**
  _`DB Table: order_items` has 4 INFERRED edges - model-reasoned connections that need verification._