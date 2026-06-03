-- Kitchen terminal: read active orders (anon key, no auth required)
CREATE POLICY "kitchen: read active orders"
  ON orders FOR SELECT
  USING (status IN ('preparing', 'ready'));

-- Kitchen terminal: advance order status
CREATE POLICY "kitchen: update status"
  ON orders FOR UPDATE
  USING (true)
  WITH CHECK (status IN ('preparing', 'ready', 'dispatched'));

-- Kitchen terminal: read items for active orders
CREATE POLICY "kitchen: read order items"
  ON order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
        AND orders.status IN ('preparing', 'ready')
    )
  );
