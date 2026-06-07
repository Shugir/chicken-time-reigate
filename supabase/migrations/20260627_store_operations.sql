-- Module 21: Store Operations & Settings Engine

ALTER TABLE store_settings
  ADD COLUMN IF NOT EXISTS is_accepting_orders BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS contact_email TEXT,
  ADD COLUMN IF NOT EXISTS contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS store_address TEXT,
  ADD COLUMN IF NOT EXISTS business_hours JSONB DEFAULT '{
    "monday":    {"enabled": true, "open": "11:00", "close": "22:00"},
    "tuesday":   {"enabled": true, "open": "11:00", "close": "22:00"},
    "wednesday": {"enabled": true, "open": "11:00", "close": "22:00"},
    "thursday":  {"enabled": true, "open": "11:00", "close": "22:00"},
    "friday":    {"enabled": true, "open": "11:00", "close": "23:00"},
    "saturday":  {"enabled": true, "open": "11:00", "close": "23:00"},
    "sunday":    {"enabled": true, "open": "12:00", "close": "21:00"}
  }'::jsonb,
  ADD COLUMN IF NOT EXISTS holidays JSONB DEFAULT '[]'::jsonb;

-- Backfill defaults on the singleton row
UPDATE store_settings SET
  is_accepting_orders = COALESCE(is_accepting_orders, true),
  business_hours = COALESCE(business_hours, '{
    "monday":    {"enabled": true, "open": "11:00", "close": "22:00"},
    "tuesday":   {"enabled": true, "open": "11:00", "close": "22:00"},
    "wednesday": {"enabled": true, "open": "11:00", "close": "22:00"},
    "thursday":  {"enabled": true, "open": "11:00", "close": "22:00"},
    "friday":    {"enabled": true, "open": "11:00", "close": "23:00"},
    "saturday":  {"enabled": true, "open": "11:00", "close": "23:00"},
    "sunday":    {"enabled": true, "open": "12:00", "close": "21:00"}
  }'::jsonb),
  holidays = COALESCE(holidays, '[]'::jsonb)
WHERE id = 1;
