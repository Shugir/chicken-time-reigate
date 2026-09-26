-- Clears the Supabase security advisor warnings without changing what the app can do.

-- 1. Pin search_path on functions that had none (lint 0011).
ALTER FUNCTION public.set_updated_at() SET search_path = public;
ALTER FUNCTION public.staff_permissions_get_caller_role() SET search_path = public;

-- 2. staff_permissions_get_caller_role is SECURITY DEFINER and only exists for RLS
--    policies (orders, order_items, staff_permissions). Move it out of the API-exposed
--    public schema so it can't be called as /rest/v1/rpc/... (lints 0028/0029).
--    Policies reference it by OID, so they keep working unchanged; roles that
--    evaluate those policies still need USAGE on the schema and EXECUTE (kept).
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO anon, authenticated, service_role;
ALTER FUNCTION public.staff_permissions_get_caller_role() SET SCHEMA private;

-- 3. Trigger / event-trigger functions are never meant to be called directly.
--    Triggers fire regardless of the caller's EXECUTE privilege.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;

-- 4. Server-only tables: RLS is on with no policies, i.e. deny-all for anon and
--    authenticated; the app reaches them only through the service role (API routes).
--    State that intent explicitly (lint 0008). The service role bypasses RLS.
CREATE POLICY combo_discounts_server_only       ON public.combo_discounts       FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY driver_payouts_server_only        ON public.driver_payouts        FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY drivers_server_only               ON public.drivers               FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY loyalty_transactions_server_only  ON public.loyalty_transactions  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY promotions_server_only            ON public.promotions            FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
