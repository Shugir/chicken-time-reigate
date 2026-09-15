-- The kitchen policies restored in 20260915_fix_kitchen_rls_leak.sql correctly
-- scoped SELECT to status IN ('preparing','ready') and UPDATE's final state to
-- the same set, but neither has a TO restriction or an auth check — so any
-- authenticated customer (not just kitchen staff) can read every in-progress
-- order's name/items/price via their own account, and can attempt to update
-- any order's status. The kitchen route (/kitchen) already requires login via
-- middleware.ts, so the original "anon key, no auth required" premise no
-- longer applies. Gate these policies on staff_permissions_get_caller_role()
-- (existing SECURITY DEFINER helper, already used for staff_permissions'
-- own RLS) so only actual staff accounts can read/update active orders this
-- way, closing the customer-facing leak.

DROP POLICY IF EXISTS "kitchen: read active orders" ON orders;
DROP POLICY IF EXISTS "kitchen: update status" ON orders;
DROP POLICY IF EXISTS "kitchen: read order items" ON order_items;

CREATE POLICY "kitchen: read active orders"
  ON orders FOR SELECT
  USING (
    status IN ('preparing', 'ready')
    AND staff_permissions_get_caller_role() IS NOT NULL
  );

CREATE POLICY "kitchen: update status"
  ON orders FOR UPDATE
  USING (staff_permissions_get_caller_role() IS NOT NULL)
  WITH CHECK (status IN ('preparing', 'ready', 'dispatched'));

CREATE POLICY "kitchen: read order items"
  ON order_items FOR SELECT
  USING (
    staff_permissions_get_caller_role() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
        AND orders.status IN ('preparing', 'ready')
    )
  );
