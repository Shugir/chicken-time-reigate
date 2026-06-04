---
source_file: "supabase/migrations/20260603_initial_schema.sql"
type: "code"
community: "Supabase Database Schema"
location: "lines 43-53"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/Supabase_Database_Schema
---

# DB Table: orders

## Connections
- [[DB Enum order_status]] - `references` [EXTRACTED]
- [[DB Table order_items]] - `references` [EXTRACTED]
- [[Initial DB Schema Migration]] - `references` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/Supabase_Database_Schema