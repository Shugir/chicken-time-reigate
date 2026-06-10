ALTER TABLE store_settings
  ADD COLUMN IF NOT EXISTS email_sender_name    TEXT NOT NULL DEFAULT 'Restaurant Orders',
  ADD COLUMN IF NOT EXISTS email_sender_address TEXT;
