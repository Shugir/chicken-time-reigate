# Menu Item Offers & Promotional Pricing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `compare_at_price` to menu items so admins can set a higher "was" price that triggers an automatic 🔥 OFFER badge and strikethrough price on the customer menu.

**Architecture:** Single nullable column on `menu_items`; public API exposes it; admin ItemModal gets an optional input; `MenuCard` in `app/order/page.tsx` renders the offer UI conditionally when `compare_at_price > price`; cart and checkout are verified to use `price` only and need no changes.

**Tech Stack:** Next.js 15 App Router, TypeScript, Supabase PostgreSQL, Tailwind CSS, brand-red custom color.

---

## File Map

| File | Action | What changes |
|------|--------|-------------|
| `supabase/migrations/20260629_menu_offers.sql` | Create | ALTER TABLE adds compare_at_price column |
| `app/api/menu-items/route.ts` | Modify | Add compare_at_price to SELECT |
| `app/admin/page.tsx` | Modify | MenuItem interface + form state + input + payload |
| `app/order/page.tsx` | Modify | DbMenuItem + MenuItem + dbToMenuItem + MenuCard offer UI |

**Unchanged (verified safe):**
- `app/api/checkout/route.ts` — uses `i.totalPrice` from cart items; `compare_at_price` never enters cart state
- `components/ProductModal.tsx` — modal shows item price from `ProductItem.price`; no change needed

---

### Task 1: DB Migration — add compare_at_price column

**Files:**
- Create: `supabase/migrations/20260629_menu_offers.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/20260629_menu_offers.sql
ALTER TABLE menu_items
  ADD COLUMN IF NOT EXISTS compare_at_price NUMERIC(10,2) DEFAULT NULL;
```

- [ ] **Step 2: Apply via Supabase MCP**

Use the Supabase MCP tool `apply_migration` with:
- `project_id`: `nxvtfcfwvqfihqxmtgpc`
- `name`: `20260629_menu_offers`
- `query`: the SQL above

Alternatively use CLI:
```powershell
npx supabase db push --linked
```

- [ ] **Step 3: Verify column exists**

Run via Supabase MCP `execute_sql`:
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'menu_items' AND column_name = 'compare_at_price';
```
Expected: one row with `data_type = numeric`, `is_nullable = YES`.

- [ ] **Step 4: Commit**

```powershell
git add supabase/migrations/20260629_menu_offers.sql
git commit -m "feat: add compare_at_price column to menu_items"
```

---

### Task 2: API — expose compare_at_price in public menu-items GET

**Files:**
- Modify: `app/api/menu-items/route.ts:9`

Current SELECT string (line 9):
```
'id, name, description, price, image_url, category, is_available, custom_options, extras, removals, dietary_flags, allergens'
```

- [ ] **Step 1: Add compare_at_price to SELECT**

Replace that select string with:
```typescript
'id, name, description, price, compare_at_price, image_url, category, is_available, custom_options, extras, removals, dietary_flags, allergens'
```

Full updated file:
```typescript
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('menu_items')
    .select('id, name, description, price, compare_at_price, image_url, category, is_available, custom_options, extras, removals, dietary_flags, allergens')
    .eq('is_available', true)
    .order('category', { ascending: true })
    .order('name',     { ascending: true })

  if (error) {
    console.error('Menu items fetch error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
```

- [ ] **Step 2: Verify API returns field**

```powershell
curl http://localhost:3000/api/menu-items | python -m json.tool | Select-String compare_at_price
```
Expected: lines showing `"compare_at_price": null` for each item.

- [ ] **Step 3: Commit**

```powershell
git add app/api/menu-items/route.ts
git commit -m "feat: expose compare_at_price in public menu-items API"
```

---

### Task 3: Admin UI — add Compare at Price field to ItemModal

**Files:**
- Modify: `app/admin/page.tsx`

Changes needed in 4 places:
1. `MenuItem` interface (line ~29) — add `compare_at_price: number | null`
2. `EMPTY_FORM` constant (line ~253) — add `compare_at_price: null`
3. `ItemModal` form state initialiser (line ~256-267) — add `compare_at_price` from editingItem
4. `handleSubmit` payload (line ~324-337) — add `compare_at_price`
5. Input field in JSX — add after the Price input

- [ ] **Step 1: Add compare_at_price to MenuItem interface**

Find the `MenuItem` interface and add the new field after `price`:
```typescript
interface MenuItem {
  id: string
  name: string
  description: string | null
  price: number
  compare_at_price: number | null   // ADD THIS LINE
  image_url: string | null
  category: string
  is_available: boolean
  extras: Extra[]
  removals: string[]
  dietary_flags: string[]
  allergens: string[]
  created_at: string
  combo_category: 'main' | 'side' | 'drink' | null
  size_tier:      'regular' | 'large' | null
}
```

- [ ] **Step 2: Update EMPTY_FORM and form state init**

`EMPTY_FORM` currently is:
```typescript
const EMPTY_FORM = { name: '', description: '', price: '', image_url: '', category: '' }
```

Change to:
```typescript
const EMPTY_FORM = { name: '', description: '', price: '', compare_at_price: '', image_url: '', category: '' }
```

In `ItemModal`'s `useState` initialiser, the editing branch currently sets:
```typescript
{
  name:           editingItem.name,
  description:    editingItem.description ?? '',
  price:          editingItem.price.toFixed(2),
  image_url:      editingItem.image_url ?? '',
  category:       editingItem.category,
  combo_category: editingItem.combo_category ?? null,
  size_tier:      editingItem.size_tier ?? null,
}
```

Change to:
```typescript
{
  name:             editingItem.name,
  description:      editingItem.description ?? '',
  price:            editingItem.price.toFixed(2),
  compare_at_price: editingItem.compare_at_price != null ? editingItem.compare_at_price.toFixed(2) : '',
  image_url:        editingItem.image_url ?? '',
  category:         editingItem.category,
  combo_category:   editingItem.combo_category ?? null,
  size_tier:        editingItem.size_tier ?? null,
}
```

And the new-item branch (after the ternary `:`) currently ends with:
```typescript
: { ...EMPTY_FORM, category: categories[0]?.slug ?? '', combo_category: null as 'main' | 'side' | 'drink' | null, size_tier: null as 'regular' | 'large' | null }
```

No change needed here — `EMPTY_FORM` now includes `compare_at_price: ''`.

- [ ] **Step 3: Add compare_at_price to handleSubmit payload**

Find the `payload` object in `handleSubmit` (around line 324). After `price: parsed,` add:
```typescript
compare_at_price: form.compare_at_price ? parseFloat(form.compare_at_price as string) || null : null,
```

Full payload block:
```typescript
const payload = {
  name:             form.name.trim(),
  description:      form.description.trim() || null,
  price:            parsed,
  compare_at_price: form.compare_at_price ? parseFloat(form.compare_at_price as string) || null : null,
  image_url:        form.image_url.trim() || null,
  category:         form.category,
  is_available:     editingItem ? editingItem.is_available : true,
  removals,
  extras,
  dietary_flags:    dietaryFlags,
  allergens,
  combo_category:   form.combo_category,
  size_tier:        form.size_tier,
}
```

- [ ] **Step 4: Add Compare at Price input to ItemModal JSX**

Find the Price input block (it's a grid row with Price and Category). After the closing `</div>` of that grid row, add a new block:

```tsx
{/* Compare at Price */}
<div>
  <label className="block text-xs font-medium text-zinc-400 mb-1">
    Compare at Price (Optional)
  </label>
  <div className="relative">
    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">£</span>
    <input
      type="number"
      step="0.01"
      min="0"
      placeholder="0.00"
      value={form.compare_at_price ?? ''}
      onChange={(e) => setForm((f) => ({ ...f, compare_at_price: e.target.value }))}
      className={`w-full pl-7 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none ${inputCls}`}
    />
  </div>
  <p className="text-[11px] text-zinc-500 mt-1">
    If higher than the selling price, the item shows an offer badge with a crossed-out original price.
  </p>
</div>
```

- [ ] **Step 5: Verify in browser**

Navigate to `http://localhost:3000/admin`, open any menu item, scroll to bottom of modal. Confirm "Compare at Price (Optional)" input field with helper text is present below the price/category row.

- [ ] **Step 6: Commit**

```powershell
git add app/admin/page.tsx
git commit -m "feat: add compare_at_price field to admin ItemModal"
```

---

### Task 4: Customer MenuCard — offer badge and strikethrough price

**Files:**
- Modify: `app/order/page.tsx`

Changes in 4 places:
1. `DbMenuItem` interface — add `compare_at_price: number | null`
2. `MenuItem` type — `MenuItem = ProductItem & { dietaryFlags?: string[]; compare_at_price?: number | null }`
3. `dbToMenuItem` function — map `compare_at_price`
4. `MenuCard` component — add offer badge over image + conditional price rendering

- [ ] **Step 1: Extend DbMenuItem interface**

Find `interface DbMenuItem` (around line 229). Add after `price: number`:
```typescript
compare_at_price: number | null
```

Full updated interface:
```typescript
interface DbMenuItem {
  id: string
  name: string
  description: string | null
  price: number
  compare_at_price: number | null
  image_url: string | null
  category: string
  is_available: boolean
  extras:        Array<{ name: string; price: number }> | null
  removals:      string[] | null
  dietary_flags: string[] | null
  allergens: string[] | null
  custom_options: {
    emoji?: string
    badge?: string
    allergens?: string[]
    removables?: string[]
    add_ons?: Array<{ name: string; price: number }>
  } | null
}
```

- [ ] **Step 2: Extend MenuItem type**

Find the line (around line 23):
```typescript
type MenuItem = ProductItem & { dietaryFlags?: string[] }
```

Change to:
```typescript
type MenuItem = ProductItem & { dietaryFlags?: string[]; compare_at_price?: number | null }
```

- [ ] **Step 3: Map compare_at_price in dbToMenuItem**

Find `dbToMenuItem` (around line 250). Add `compare_at_price` to the returned object:
```typescript
function dbToMenuItem(item: DbMenuItem): MenuItem {
  const opts = item.custom_options ?? {}
  return {
    id:              item.id,
    name:            item.name,
    description:     item.description ?? '',
    price:           Number(item.price),
    compare_at_price: item.compare_at_price != null ? Number(item.compare_at_price) : null,
    category:        item.category.toLowerCase(),
    badge:           opts.badge,
    emoji:           opts.emoji ?? '🍽️',
    image:           item.image_url || FALLBACK_IMG,
    allergens:       item.allergens?.length ? item.allergens : (opts.allergens ?? []),
    removables:      item.removals?.length ? item.removals  : (opts.removables ?? []),
    add_ons:         item.extras?.length   ? item.extras    : (opts.add_ons    ?? []),
    dietaryFlags:    item.dietary_flags ?? [],
  }
}
```

- [ ] **Step 4: Add offer badge and price rendering to MenuCard**

Find the `MenuCard` component's image section. Currently it has:
```tsx
{item.badge && (
  <span className="absolute top-3 left-3 z-10 text-[10px] font-semibold px-2.5 py-1 rounded-full bg-white/95 text-zinc-800 tracking-wide border border-zinc-200/80">
    {item.badge}
  </span>
)}
{item.allergens && item.allergens.length > 0 && (
  <span className="absolute bottom-2 right-2 z-10 ...">
    ⚠ Allergens
  </span>
)}
```

Add the 🔥 OFFER badge just **before** the allergens span (after the existing badge span):
```tsx
{item.compare_at_price != null && item.compare_at_price > item.price && (
  <span className="absolute top-3 right-3 z-10 text-[10px] font-bold px-2.5 py-1 rounded-full bg-brand-red text-white tracking-wide shadow-md">
    🔥 OFFER
  </span>
)}
```

Then find the price display section (around line 335-338):
```tsx
<span className="font-heading font-bold text-lg text-zinc-900">
  £{item.price.toFixed(2)}
</span>
```

Replace with:
```tsx
{item.compare_at_price != null && item.compare_at_price > item.price ? (
  <div className="flex flex-col gap-0.5">
    <span className="text-xs text-zinc-400 line-through leading-none">
      £{item.compare_at_price.toFixed(2)}
    </span>
    <span className="font-heading font-bold text-lg text-brand-red leading-none">
      £{item.price.toFixed(2)}
    </span>
  </div>
) : (
  <span className="font-heading font-bold text-lg text-zinc-900">
    £{item.price.toFixed(2)}
  </span>
)}
```

- [ ] **Step 5: Verify cart/checkout safety (read-only check)**

Confirm in `app/order/page.tsx` line ~274-275 that `cartTotal` only uses `item.price`:
```typescript
function cartTotal(cart: Cart, items: MenuItem[]) {
  return Object.entries(cart).reduce((sum, [id, entry]) => {
    const item = items.find((m) => m.id === id)
    if (!item) return sum
    const extrasPrice = entry.extras.reduce((s, e) => s + e.price, 0)
    return sum + (item.price + extrasPrice) * entry.qty  // ← uses item.price only ✅
  }, 0)
}
```

Confirm in `app/api/checkout/route.ts` line ~81 that subtotal uses `i.totalPrice` from cart items (which come from `price`):
```typescript
const subtotal = items.reduce((sum, i) => sum + i.totalPrice, 0)  // ← totalPrice from cart ✅
```

No code changes needed. Both are safe.

- [ ] **Step 6: Test visually — tag an item with compare_at_price**

Run this via Supabase MCP execute_sql to set a test offer on Dirty Bird Burger:
```sql
UPDATE menu_items
SET compare_at_price = 11.99
WHERE name = 'Dirty Bird Burger';
```

Navigate to `http://localhost:3000/order`. Verify:
- 🔥 OFFER badge appears on Dirty Bird Burger card (top-right of image, red pill)
- Price shows `£11.99` struck through in muted text above `£8.99` in brand-red
- Adding to cart shows £8.99 in cart total, not £11.99

- [ ] **Step 7: Commit**

```powershell
git add app/order/page.tsx
git commit -m "feat: show offer badge and strikethrough price on MenuCard when compare_at_price > price"
```

---

## Verification Checklist

After all 4 tasks:

- [ ] `compare_at_price` column exists in `menu_items` (nullable numeric)
- [ ] `GET /api/menu-items` returns `compare_at_price` field
- [ ] Admin ItemModal: "Compare at Price" input present with helper text
- [ ] Setting `compare_at_price = 11.99` on an item priced at `£8.99` → 🔥 OFFER badge top-right of image
- [ ] Strikethrough `£11.99` + bold brand-red `£8.99` in card price section
- [ ] Items without `compare_at_price` render exactly as before (no visual change)
- [ ] Cart total and checkout use `price` only — `compare_at_price` never affects payment amount
