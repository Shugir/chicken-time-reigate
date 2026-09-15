-- 20260915b_scope_kitchen_policies_to_staff.sql calls
-- staff_permissions_get_caller_role(), but no migration file in this repo
-- creates it -- it exists live from undocumented DDL applied before this
-- migration history began. A fresh environment (supabase db reset, or a
-- new project provisioned from these migrations) would fail on 20260915b
-- with "function does not exist". CREATE OR REPLACE is idempotent and
-- matches the function already live, so re-applying this to the current
-- project is a safe no-op; it only matters for reproducibility going
-- forward.

CREATE OR REPLACE FUNCTION public.staff_permissions_get_caller_role()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
AS $function$
  SELECT sp.role
  FROM staff_permissions sp
  INNER JOIN auth.users au ON au.email = sp.email
  WHERE au.id = auth.uid()
  LIMIT 1;
$function$;
