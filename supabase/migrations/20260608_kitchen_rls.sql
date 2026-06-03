-- Drop existing restrictive kitchen policies before replacing with permissive ones
DROP POLICY IF EXISTS "kitchen: read active orders" ON orders;
DROP POLICY IF EXISTS "kitchen: update status" ON orders;
DROP POLICY IF EXISTS "kitchen: read order items" ON order_items;

CREATE POLICY "kitchen_select_orders" ON orders FOR SELECT USING (true);
CREATE POLICY "kitchen_update_orders" ON orders FOR UPDATE USING (true);
CREATE POLICY "kitchen_select_items" ON order_items FOR SELECT USING (true);
