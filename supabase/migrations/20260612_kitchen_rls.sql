-- Drop existing restrictive kitchen policies before replacing with permissive ones
DROP POLICY IF EXISTS "kitchen: read active orders" ON orders;
DROP POLICY IF EXISTS "kitchen: update status" ON orders;
DROP POLICY IF EXISTS "kitchen: read order items" ON order_items;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='orders'      AND policyname='kitchen_select_orders') THEN
    CREATE POLICY "kitchen_select_orders" ON orders FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='orders'      AND policyname='kitchen_update_orders') THEN
    CREATE POLICY "kitchen_update_orders" ON orders FOR UPDATE USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='order_items' AND policyname='kitchen_select_items') THEN
    CREATE POLICY "kitchen_select_items" ON order_items FOR SELECT USING (true);
  END IF;
END $$;
