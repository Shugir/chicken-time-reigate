---
source_file: "supabase/migrations/20260607_kitchen_policies.sql"
type: "document"
community: "Community None"
tags:
  - graphify/document
  - graphify/EXTRACTED
  - community/Community_None
---

# Migration: Kitchen Policies (20260607)

## Connections
- [[DB Table order_items]] - `shares_data_with` [EXTRACTED]
- [[DB Table orders]] - `shares_data_with` [EXTRACTED]
- [[RLS Policy kitchen read active orders]] - `implements` [EXTRACTED]
- [[RLS Policy kitchen read order items]] - `implements` [EXTRACTED]
- [[RLS Policy kitchen update status]] - `implements` [EXTRACTED]

#graphify/document #graphify/EXTRACTED #community/Community_None