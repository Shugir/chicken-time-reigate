-- Ensure public read access exists on menu_items (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'menu_items'
      AND policyname = 'menu_items: public read'
  ) THEN
    CREATE POLICY "menu_items: public read"
      ON menu_items FOR SELECT
      USING (TRUE);
  END IF;
END $$;
