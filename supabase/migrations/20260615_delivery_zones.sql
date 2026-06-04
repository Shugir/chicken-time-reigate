CREATE TABLE IF NOT EXISTS delivery_zones (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  postcode_prefix     text        NOT NULL UNIQUE,
  delivery_fee        numeric(6,2) NOT NULL DEFAULT 1.99,
  min_order_amount    numeric(6,2) NOT NULL DEFAULT 0,
  is_active           boolean     NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now()
);

INSERT INTO delivery_zones (postcode_prefix, delivery_fee, min_order_amount)
VALUES
  ('RH2', 1.99, 0),
  ('RH3', 1.99, 0),
  ('RH4', 2.49, 10),
  ('RH5', 2.99, 15)
ON CONFLICT (postcode_prefix) DO NOTHING;

ALTER TABLE delivery_zones ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'delivery_zones' AND policyname = 'public_read_delivery_zones'
  ) THEN
    CREATE POLICY public_read_delivery_zones ON delivery_zones
      FOR SELECT TO anon, authenticated USING (true);
  END IF;
END $$;
