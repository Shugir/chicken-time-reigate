# Module 23: Dynamic Combo Meal Engine

**Date:** 2026-06-07  
**Status:** Approved  
**Approach:** Extend existing `menu_items` schema; combo stored as single CartItem with `combo_components` JSONB

---

## 1. Overview

Adds a Build-Your-Meal wizard to the customer-facing site. Customers pick Medium or Large, then choose a main, side, and drink. Each selection is filtered by the meal size rule. Final total = sum of item prices minus an active combo discount. Cart receives one bundled "Combo Meal" item; kitchen sees the individual components via `order_items.combo_components`.

---

## 2. Database Migration

**File:** `supabase/migrations/20260628_combo_meals.sql`

### New enums
```sql
CREATE TYPE combo_category_type AS ENUM ('main', 'side', 'drink');
CREATE TYPE size_tier_type AS ENUM ('regular', 'large');
```

### Extend `menu_items`
```sql
ALTER TABLE menu_items
  ADD COLUMN combo_category combo_category_type DEFAULT NULL,
  ADD COLUMN size_tier size_tier_type DEFAULT NULL;
```

### New table: `combo_discounts`
```sql
CREATE TABLE combo_discounts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_size      TEXT NOT NULL,         -- 'medium' | 'large'
  name           TEXT NOT NULL,         -- display label e.g. "Medium Meal Deal"
  discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_active      BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ DEFAULT now()
);

-- Seed defaults
INSERT INTO combo_discounts (meal_size, name, discount_amount, is_active) VALUES
  ('medium', 'Medium Meal Deal', 1.50, true),
  ('large',  'Large Meal Deal',  2.00, true);
```

### Extend `order_items`
```sql
ALTER TABLE order_items
  ADD COLUMN combo_components JSONB DEFAULT NULL;
```
`combo_components` shape: `[{ id: string, name: string, category: "main"|"side"|"drink", size_tier: "regular"|"large" }]`

---

## 3. Admin UI

**File:** `app/admin/page.tsx` (extend existing)

### 3a. ItemModal changes
- Extend `MenuItem` interface: add `combo_category: string | null`, `size_tier: string | null`
- Add two `<select>` dropdowns inside `ItemModal`:
  - **Combo Role** — options: `(none)`, `Main`, `Side`, `Drink` → maps to `null | 'main' | 'side' | 'drink'`
  - **Size Tier** — options: `(none)`, `Regular`, `Large` → maps to `null | 'regular' | 'large'`
- Both nullable; default `null` means item not part of combo system
- `POST /api/admin/menu-items` and `PATCH /api/admin/menu-items/[id]` already accept arbitrary columns — just add `combo_category` and `size_tier` to the DB payload

### 3b. Combos tab
- New tab in admin sidebar/tabs: **"Combos"**
- Shows table of `combo_discounts` rows
- Inline editable `discount_amount` per row (click-to-edit, PATCH on save)
- Toggle `is_active` per row
- Admin can add new entries (rare — mostly edit existing)

### 3c. New API routes
- `GET  /api/admin/combo-discounts` — list all
- `POST /api/admin/combo-discounts` — create
- `PATCH /api/admin/combo-discounts/[id]` — update `name`, `discount_amount`, `is_active`

All guarded by `hasPermission('manage_menu')` (same as menu-items routes).

---

## 4. Customer UI — Meal Builder Wizard

**File:** `app/menu/combo/page.tsx` (new)

### Wizard state
```ts
type MealSize = 'medium' | 'large'
interface ComboSelection {
  size:  MealSize | null
  main:  MenuItem | null
  side:  MenuItem | null
  drink: MenuItem | null
}
```

### Step flow

| Step | Content | Filter rule |
|------|---------|-------------|
| 1 | Size picker: Medium / Large | — |
| 2 | Main items grid | `combo_category = 'main'` (all sizes shown) |
| 3 | Side items grid | `combo_category = 'side'` + size filter (see §4a) |
| 4 | Drink items grid | `combo_category = 'drink'` + size filter (see §4a) |

### 4a. Size enforcement rules

**Medium selected:**
- Steps 3 and 4 filtered to `size_tier = 'regular'` only. No large options shown.

**Large selected:**
- Default: both regular and large shown for side and drink
- If user picks a **large side** → drinks filtered to `regular` only
- If user picks a **large drink** → sides filtered to `regular` only
- If user deselects side/drink → restriction lifts
- Rule: cannot have large side AND large drink simultaneously

### 4b. Data fetch
New public endpoint: `GET /api/menu/combo-items?category=main|side|drink`  
Returns `menu_items` where `combo_category = $category AND is_available = true`.  
Client-side filter applies `size_tier` rule from state (no separate API call per size change).

### 4c. Live price banner
```
Total = main.price + side.price + drink.price − combo_discount.discount_amount
```
`combo_discount` fetched once on mount from `GET /api/menu/combo-discounts?size=medium|large`.  
Banner updates on every selection change. Shows `--` when any slot is empty.  
New public endpoint: `GET /api/menu/combo-discounts?size=medium|large` → returns active discount for that size.

### 4d. Submit → cart
On step 4 "Add to Cart":
```ts
const comboItem: CartItem = {
  name:       `${size === 'large' ? 'Large' : 'Medium'} Combo Meal`,
  price:      discountedTotal,      // already discounted unit price
  quantity:   1,
  totalPrice: discountedTotal,
  extras:     [],
  removals:   [],
  notes:      null,
  combo_components: [
    { id: main.id,  name: main.name,  category: 'main',  size_tier: main.size_tier  ?? 'regular' },
    { id: side.id,  name: side.name,  category: 'side',  size_tier: side.size_tier  ?? 'regular' },
    { id: drink.id, name: drink.name, category: 'drink', size_tier: drink.size_tier ?? 'regular' },
  ],
}
```
Merges into existing `pendingCart` sessionStorage. Redirects to `/order` on success.

---

## 5. Checkout + Cart Integration

**Files:** `app/api/checkout/route.ts`, type shared between combo page and checkout

### CartItem type extension
```ts
interface ComboComponent {
  id:        string
  name:      string
  category:  'main' | 'side' | 'drink'
  size_tier: 'regular' | 'large'
}

interface CartItem {
  name:             string
  price:            number
  quantity:         number
  totalPrice:       number
  extras:           Extra[]
  removals:         string[]
  notes?:           string
  combo_components?: ComboComponent[]   // NEW — undefined for non-combo items
}
```

### order_items insert
Checkout API already maps `items` array to `order_items`. Extend the insert:
```ts
{
  order_id:          order.id,
  item_name:         item.name,
  quantity:          item.quantity,
  unit_price:        item.price,
  extras:            item.extras   ?? [],
  removals:          item.removals ?? [],
  notes:             item.notes    ?? null,
  combo_components:  item.combo_components ?? null,   // NEW
}
```

---

## 6. New API Routes Summary

| Route | Auth | Purpose |
|-------|------|---------|
| `GET /api/menu/combo-items` | Public | Fetch items by combo_category |
| `GET /api/menu/combo-discounts` | Public | Active discount for given size |
| `GET /api/admin/combo-discounts` | Admin | List all discounts |
| `POST /api/admin/combo-discounts` | Admin | Create discount entry |
| `PATCH /api/admin/combo-discounts/[id]` | Admin | Edit amount/name/active |

---

## 7. Files Changed / Created

| File | Action |
|------|--------|
| `supabase/migrations/20260628_combo_meals.sql` | Create |
| `app/admin/page.tsx` | Extend ItemModal + add Combos tab |
| `app/api/admin/combo-discounts/route.ts` | Create |
| `app/api/admin/combo-discounts/[id]/route.ts` | Create |
| `app/api/menu/combo-items/route.ts` | Create |
| `app/api/menu/combo-discounts/route.ts` | Create |
| `app/menu/combo/page.tsx` | Create |
| `app/api/checkout/route.ts` | Extend CartItem + insert |

---

## 8. Out of Scope

- Kitchen display changes (combo_components stored and visible in raw order data; dedicated kitchen UI changes deferred)
- Combo quantity > 1 (single combo per add-to-cart action; user can add multiple times)
- Mix-and-match extras on combo components (combo items added as-is, no customisation in wizard)
