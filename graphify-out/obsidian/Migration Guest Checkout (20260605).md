---
source_file: "supabase/migrations/20260605_guest_checkout.sql"
type: "document"
community: "Community None"
tags:
  - graphify/document
  - graphify/EXTRACTED
  - community/Community_None
---

# Migration: Guest Checkout (20260605)

## Connections
- [[DB Table order_items]] - `shares_data_with` [EXTRACTED]
- [[DB Table orders]] - `shares_data_with` [EXTRACTED]
- [[order_items.item_name Column]] - `implements` [EXTRACTED]
- [[orders.stripe_session_id Column]] - `implements` [EXTRACTED]
- [[orders.user_id (nullable - guest support)]] - `semantically_similar_to` [EXTRACTED]

#graphify/document #graphify/EXTRACTED #community/Community_None