-- 20260612_kitchen_rls.sql replaced the kitchen policies with USING (true),
-- which has no TO restriction (defaults to PUBLIC) and no status filter.
-- That exposes every order (all customers, all history, full PII) and
-- allows unrestricted UPDATEs to anyone holding the anon key.
-- Restore the original, narrowly-scoped kitchen policies from 20260607.

DROP POLICY IF EXISTS "kitchen_select_orders" ON orders;
DROP POLICY IF EXISTS "kitchen_update_orders" ON orders;
DROP POLICY IF EXISTS "kitchen_select_items" ON order_items;

CREATE POLICY "kitchen: read active orders"
  ON orders FOR SELECT
  USING (status IN ('preparing', 'ready'));

CREATE POLICY "kitchen: update status"
  ON orders FOR UPDATE
  USING (true)
  WITH CHECK (status IN ('preparing', 'ready', 'dispatched'));

CREATE POLICY "kitchen: read order items"
  ON order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
        AND orders.status IN ('preparing', 'ready')
    )
  );
