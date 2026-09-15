-- supabase/migrations/20260916_fix_deals_rls.sql
--
-- Fix: the original "public can read active deals" policy on `deals` used
-- `USING (true)`, which does not actually filter on is_active — any client
-- with the public anon key (NEXT_PUBLIC_SUPABASE_ANON_KEY) could read every
-- deal row directly via PostgREST, including inactive/draft deals with full
-- targeting configs, bypassing this app's own API routes entirely.

DROP POLICY "public can read active deals" ON deals;

CREATE POLICY "public can read active deals"
  ON deals FOR SELECT USING (is_active);
