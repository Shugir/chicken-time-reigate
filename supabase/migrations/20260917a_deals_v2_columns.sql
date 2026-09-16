-- supabase/migrations/20260917a_deals_v2_columns.sql

ALTER TABLE deals
  ADD COLUMN available_from  TIMESTAMPTZ,
  ADD COLUMN available_until TIMESTAMPTZ,
  ADD COLUMN image_url       TEXT,
  ADD COLUMN custom_label    TEXT;
