-- Allow guest orders (no auth required at checkout)
ALTER TABLE orders ALTER COLUMN user_id DROP NOT NULL;

-- Track Stripe session for reconciliation
ALTER TABLE orders ADD COLUMN IF NOT EXISTS stripe_session_id TEXT;

-- Allow cart items not yet in menu_items table, store name as fallback
ALTER TABLE order_items ALTER COLUMN menu_item_id DROP NOT NULL;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS item_name TEXT;
