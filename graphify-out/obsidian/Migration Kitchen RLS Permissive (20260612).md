---
source_file: "supabase/migrations/20260612_kitchen_rls.sql"
type: "document"
community: "Community None"
tags:
  - graphify/document
  - graphify/EXTRACTED
  - community/Community_None
---

# Migration: Kitchen RLS Permissive (20260612)

## Connections
- [[DB Table order_items]] - `shares_data_with` [EXTRACTED]
- [[DB Table orders]] - `shares_data_with` [EXTRACTED]
- [[RLS Policy kitchen read active orders]] - `references` [EXTRACTED]
- [[RLS Policy kitchen read order items]] - `references` [EXTRACTED]
- [[RLS Policy kitchen update status]] - `references` [EXTRACTED]
- [[RLS Policy kitchen_select_items (permissive)]] - `implements` [EXTRACTED]
- [[RLS Policy kitchen_select_orders (permissive)]] - `implements` [EXTRACTED]
- [[RLS Policy kitchen_update_orders (permissive)]] - `implements` [EXTRACTED]

#graphify/document #graphify/EXTRACTED #community/Community_None