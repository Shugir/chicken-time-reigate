-- Add delivery_postcode to orders for explicit postcode storage separate from full address
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_postcode TEXT;
