-- ============================================================
-- Enums
-- ============================================================

CREATE TYPE order_status AS ENUM (
  'pending',
  'preparing',
  'ready',
  'dispatched',
  'delivered'
);

-- ============================================================
-- Tables
-- ============================================================

-- Profiles: one row per auth user
CREATE TABLE profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT,
  phone       TEXT,
  address     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Menu items: food catalogue with flexible custom options via JSONB
-- e.g. custom_options: [{"name":"size","choices":["small","large"]}]
CREATE TABLE menu_items (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT        NOT NULL,
  description    TEXT,
  price          NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  image_url      TEXT,
  category       TEXT,
  is_available   BOOLEAN     NOT NULL DEFAULT TRUE,
  custom_options JSONB       NOT NULL DEFAULT '[]'::JSONB,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Orders: one row per customer order
CREATE TABLE orders (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID         NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  status          order_status NOT NULL DEFAULT 'pending',
  total_amount    NUMERIC(10,2) NOT NULL CHECK (total_amount >= 0),
  delivery_address TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Order items: line items linking orders to menu items
-- selected_options mirrors the JSONB shape from menu_items.custom_options
-- e.g. {"size":"large"}
CREATE TABLE order_items (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id         UUID          NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id     UUID          NOT NULL REFERENCES menu_items(id) ON DELETE RESTRICT,
  quantity         INT           NOT NULL CHECK (quantity > 0),
  unit_price       NUMERIC(10,2) NOT NULL CHECK (unit_price >= 0),
  selected_options JSONB         NOT NULL DEFAULT '{}'::JSONB,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Indexes
-- ============================================================

CREATE INDEX idx_orders_user_id   ON orders(user_id);
CREATE INDEX idx_orders_status    ON orders(status);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_menu_items_category  ON menu_items(category);

-- ============================================================
-- Updated-at trigger
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_menu_items_updated_at
  BEFORE UPDATE ON menu_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE profiles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders     ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- profiles: users manage only their own row
CREATE POLICY "profiles: select own"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "profiles: insert own"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles: update own"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- menu_items: public read, no direct writes from clients
CREATE POLICY "menu_items: public read"
  ON menu_items FOR SELECT
  USING (TRUE);

-- orders: users see and manage only their own orders
CREATE POLICY "orders: select own"
  ON orders FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "orders: insert own"
  ON orders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "orders: update own"
  ON orders FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- order_items: access via parent order ownership
CREATE POLICY "order_items: select via order"
  ON order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
        AND orders.user_id = auth.uid()
    )
  );

CREATE POLICY "order_items: insert via order"
  ON order_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
        AND orders.user_id = auth.uid()
    )
  );
