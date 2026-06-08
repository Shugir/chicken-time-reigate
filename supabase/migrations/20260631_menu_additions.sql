-- Add addable ingredients column to menu_items
-- This mirrors the existing `removals` column and allows admins to
-- define ingredients customers can request to be added to a dish.
ALTER TABLE menu_items
  ADD COLUMN IF NOT EXISTS additions text[] NOT NULL DEFAULT '{}';
