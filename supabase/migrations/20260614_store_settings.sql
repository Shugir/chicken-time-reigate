CREATE TABLE IF NOT EXISTS store_settings (
  id                int  PRIMARY KEY DEFAULT 1,
  is_open           bool NOT NULL DEFAULT true,
  prep_time_minutes int  NOT NULL DEFAULT 25,
  CONSTRAINT single_row CHECK (id = 1)
);

INSERT INTO store_settings (id, is_open, prep_time_minutes)
VALUES (1, true, 25)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE store_settings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'store_settings' AND policyname = 'public_read_store_settings'
  ) THEN
    CREATE POLICY public_read_store_settings ON store_settings
      FOR SELECT TO anon, authenticated USING (true);
  END IF;
END $$;
