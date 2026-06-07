# Module 23: Dynamic Combo Meal Engine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Build-Your-Meal combo engine: tag existing `menu_items` with combo roles, manage per-size discounts from admin, expose a 4-step customer wizard at `/menu/combo`, and persist combo bundles through cart → checkout → `order_items`.

**Architecture:** Extend `menu_items` with nullable `combo_category`/`size_tier` enum columns and add a `combo_discounts` table. Admin gets two entry points: updated ItemModal dropdowns and a new `/admin/combos` page. Customer wizard fetches tagged items, enforces size rules client-side, computes live price, and writes one `CartItem` with `combo_components` JSONB to `pendingCart` → redirects to `/checkout` directly (bypasses `/order` page cart which would overwrite sessionStorage). Checkout API maps `combo_components` into the new `order_items.combo_components` column.

**Tech Stack:** Next.js 15 App Router, TypeScript, Supabase (PostgreSQL + supabase-admin), Tailwind CSS, lucide-react

---

## File Map

| File | Action |
|------|--------|
| `supabase/migrations/20260628_combo_meals.sql` | Create |
| `app/api/menu/combo-items/route.ts` | Create |
| `app/api/menu/combo-discounts/route.ts` | Create |
| `app/api/admin/combo-discounts/route.ts` | Create |
| `app/api/admin/combo-discounts/[id]/route.ts` | Create |
| `app/admin/combos/layout.tsx` | Create |
| `app/admin/combos/page.tsx` | Create |
| `components/admin/admin-sidebar.tsx` | Modify — add Combos nav entry |
| `app/admin/page.tsx` | Modify — extend MenuItem + ItemModal |
| `app/menu/combo/page.tsx` | Create |
| `app/api/checkout/route.ts` | Modify — CartItem + order_items insert |
| `app/order/page.tsx` | Modify — add combo entry point banner |

---

### Task 1: DB Migration

**Files:**
- Create: `supabase/migrations/20260628_combo_meals.sql`

- [ ] **Step 1: Write migration**

Create `supabase/migrations/20260628_combo_meals.sql`:

```sql
-- Module 23: Dynamic Combo Meal Engine

-- 1. Enums
DO $$ BEGIN
  CREATE TYPE combo_category_type AS ENUM ('main', 'side', 'drink');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE size_tier_type AS ENUM ('regular', 'large');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Tag existing menu items
ALTER TABLE menu_items
  ADD COLUMN IF NOT EXISTS combo_category combo_category_type DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS size_tier      size_tier_type      DEFAULT NULL;

-- 3. Per-size combo discount configuration
CREATE TABLE IF NOT EXISTS combo_discounts (
  id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_size       TEXT    NOT NULL CHECK (meal_size IN ('medium', 'large')),
  name            TEXT    NOT NULL,
  discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Seed default discount rows (idempotent)
INSERT INTO combo_discounts (meal_size, name, discount_amount, is_active)
  VALUES
    ('medium', 'Medium Meal Deal', 1.50, true),
    ('large',  'Large Meal Deal',  2.00, true)
  ON CONFLICT DO NOTHING;

-- 4. Store combo component breakdown on order items
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS combo_components JSONB DEFAULT NULL;
-- Shape: [{ id: uuid, name: text, category: "main"|"side"|"drink", size_tier: "regular"|"large" }]
```

- [ ] **Step 2: Apply migration via Supabase MCP**

Use Supabase MCP tool `apply_migration`:
- `name`: `20260628_combo_meals`
- `query`: paste the SQL above

- [ ] **Step 3: Verify**

Via Supabase MCP `execute_sql`:
```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'menu_items' AND column_name IN ('combo_category', 'size_tier');
-- Expected: 2 rows

SELECT COUNT(*) FROM combo_discounts;
-- Expected: 2

SELECT column_name FROM information_schema.columns
WHERE table_name = 'order_items' AND column_name = 'combo_components';
-- Expected: 1 row
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260628_combo_meals.sql
git commit -m "feat(db): combo_category/size_tier on menu_items, combo_discounts table, combo_components on order_items"
```

---

### Task 2: Public APIs — combo-items and combo-discounts

**Files:**
- Create: `app/api/menu/combo-items/route.ts`
- Create: `app/api/menu/combo-discounts/route.ts`

- [ ] **Step 1: Create combo-items route**

Create `app/api/menu/combo-items/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(request: NextRequest) {
  const category = request.nextUrl.searchParams.get('category')
  if (!category || !['main', 'side', 'drink'].includes(category)) {
    return NextResponse.json({ error: 'category must be main, side, or drink' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('menu_items')
    .select('id, name, description, price, image_url, size_tier')
    .eq('combo_category', category)
    .eq('is_available', true)
    .order('name')

  if (error) return NextResponse.json({ error: 'Failed to fetch combo items' }, { status: 500 })
  return NextResponse.json(data ?? [])
}
```

- [ ] **Step 2: Create combo-discounts route**

Create `app/api/menu/combo-discounts/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(request: NextRequest) {
  const size = request.nextUrl.searchParams.get('size')
  if (!size || !['medium', 'large'].includes(size)) {
    return NextResponse.json({ error: 'size must be medium or large' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('combo_discounts')
    .select('id, meal_size, name, discount_amount')
    .eq('meal_size', size)
    .eq('is_active', true)
    .maybeSingle()

  if (error) return NextResponse.json({ error: 'Failed to fetch discount' }, { status: 500 })
  return NextResponse.json(data ?? null)
}
```

- [ ] **Step 3: Verify (dev server running)**

```
GET http://localhost:3000/api/menu/combo-items?category=main
→ [] (no items tagged yet — correct)

GET http://localhost:3000/api/menu/combo-items?category=invalid
→ {"error":"category must be main, side, or drink"}

GET http://localhost:3000/api/menu/combo-discounts?size=medium
→ {"id":"...","meal_size":"medium","name":"Medium Meal Deal","discount_amount":1.5}

GET http://localhost:3000/api/menu/combo-discounts?size=large
→ {"id":"...","meal_size":"large","name":"Large Meal Deal","discount_amount":2}
```

- [ ] **Step 4: Commit**

```bash
git add app/api/menu/combo-items/route.ts app/api/menu/combo-discounts/route.ts
git commit -m "feat(api): public combo-items and combo-discounts endpoints"
```

---

### Task 3: Admin API — combo-discounts CRUD

**Files:**
- Create: `app/api/admin/combo-discounts/route.ts`
- Create: `app/api/admin/combo-discounts/[id]/route.ts`

> Auth note: all admin API routes rely on Next.js middleware (`middleware.ts`) for session check + `supabaseAdmin` for data. No per-route `hasPermission` call needed — matches existing pattern in `app/api/admin/promotions/route.ts`.

- [ ] **Step 1: Create collection route**

Create `app/api/admin/combo-discounts/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('combo_discounts')
    .select('*')
    .order('meal_size')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(request: NextRequest) {
  const { meal_size, name, discount_amount, is_active = true } = await request.json()

  if (!meal_size || !['medium', 'large'].includes(meal_size)) {
    return NextResponse.json({ error: 'meal_size must be medium or large' }, { status: 400 })
  }
  if (!name?.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }
  const amount = parseFloat(discount_amount)
  if (isNaN(amount) || amount < 0) {
    return NextResponse.json({ error: 'discount_amount must be a non-negative number' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('combo_discounts')
    .insert({ meal_size, name: name.trim(), discount_amount: amount, is_active })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
```

- [ ] **Step 2: Create item route**

Create `app/api/admin/combo-discounts/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const body = await request.json()

  const update: Record<string, unknown> = {}
  if ('name' in body)            update.name            = String(body.name).trim()
  if ('discount_amount' in body) update.discount_amount = parseFloat(body.discount_amount)
  if ('is_active' in body)       update.is_active       = Boolean(body.is_active)

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }
  if ('discount_amount' in update && isNaN(update.discount_amount as number)) {
    return NextResponse.json({ error: 'discount_amount must be a number' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('combo_discounts')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
```

- [ ] **Step 3: Verify**

```
GET http://localhost:3000/api/admin/combo-discounts
→ [{id, meal_size:"large", name:"Large Meal Deal", discount_amount:2, ...}, {id, meal_size:"medium",...}]
```

- [ ] **Step 4: Commit**

```bash
git add app/api/admin/combo-discounts/route.ts "app/api/admin/combo-discounts/[id]/route.ts"
git commit -m "feat(api): admin combo-discounts GET/POST/PATCH"
```

---

### Task 4: Admin ItemModal — combo_category and size_tier fields

**Files:**
- Modify: `app/admin/page.tsx`

- [ ] **Step 1: Read MenuItem interface in `app/admin/page.tsx`**

Open `app/admin/page.tsx`. Search for `interface MenuItem`. It should have fields: `id, name, description, price, image_url, category, is_available, extras, removals, dietary_flags, allergens, created_at`.

- [ ] **Step 2: Add fields to MenuItem interface**

Find `interface MenuItem {` and add two fields before the closing `}`:

```typescript
  combo_category: 'main' | 'side' | 'drink' | null
  size_tier:      'regular' | 'large' | null
```

- [ ] **Step 3: Seed initial form state with new fields**

Inside `ItemModal`, find the `useState` that initialises the form state from `editItem`. The object will have a line like `name: editItem?.name ?? ''`. Add to that same object:

```typescript
  combo_category: editItem?.combo_category ?? null,
  size_tier:      editItem?.size_tier ?? null,
```

- [ ] **Step 4: Add dropdowns to ItemModal form JSX**

Inside the ItemModal form, after the existing `category` select and before the submit/action buttons, add:

```tsx
{/* Combo Role */}
<div>
  <label className="block text-xs font-medium text-zinc-400 mb-1">Combo Role</label>
  <select
    value={form.combo_category ?? ''}
    onChange={e =>
      setForm(f => ({
        ...f,
        combo_category: (e.target.value || null) as 'main' | 'side' | 'drink' | null,
      }))
    }
    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-red"
  >
    <option value="">None</option>
    <option value="main">Main</option>
    <option value="side">Side</option>
    <option value="drink">Drink</option>
  </select>
</div>

{/* Size Tier */}
<div>
  <label className="block text-xs font-medium text-zinc-400 mb-1">Size Tier</label>
  <select
    value={form.size_tier ?? ''}
    onChange={e =>
      setForm(f => ({
        ...f,
        size_tier: (e.target.value || null) as 'regular' | 'large' | null,
      }))
    }
    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-red"
  >
    <option value="">None</option>
    <option value="regular">Regular</option>
    <option value="large">Large</option>
  </select>
</div>
```

- [ ] **Step 5: Add fields to DB payload in ItemModal submit handler**

Find the `fetch('/api/admin/menu-items'` call inside ItemModal and the body object. It has `name, description, price, ...`. Add:

```typescript
  combo_category: form.combo_category,
  size_tier:      form.size_tier,
```

- [ ] **Step 6: Verify**

Navigate to `http://localhost:3000/admin`. Edit any menu item. Verify two new dropdowns appear: "Combo Role" and "Size Tier". Tag one item: `combo_category = 'main'`, `size_tier = 'regular'`. Save. Reopen the item — verify values persisted. Then check:

```
GET http://localhost:3000/api/menu/combo-items?category=main
→ [{id, name, price, size_tier:"regular", ...}]
```

- [ ] **Step 7: Commit**

```bash
git add app/admin/page.tsx
git commit -m "feat(admin): combo_category and size_tier dropdowns in ItemModal"
```

---

### Task 5: Admin Combos page + sidebar link

**Files:**
- Create: `app/admin/combos/layout.tsx`
- Create: `app/admin/combos/page.tsx`
- Modify: `components/admin/admin-sidebar.tsx`

- [ ] **Step 1: Create layout**

Create `app/admin/combos/layout.tsx`:

```typescript
import { ReactNode } from 'react'
import { getUserPermissions, hasPermission } from '@/lib/get-user-permissions'
import AccessDenied from '@/components/admin/access-denied'

export default async function CombosLayout({ children }: { children: ReactNode }) {
  const perms = await getUserPermissions()
  if (!perms || !hasPermission(perms, 'MenuManager')) return <AccessDenied />
  return <>{children}</>
}
```

- [ ] **Step 2: Create combos admin page**

Create `app/admin/combos/page.tsx`:

```tsx
'use client'

import { useState, useEffect } from 'react'
import { Pencil, Check, X } from 'lucide-react'
import AdminSidebar from '@/components/admin/admin-sidebar'

interface ComboDiscount {
  id: string
  meal_size: string
  name: string
  discount_amount: number
  is_active: boolean
}

export default function CombosAdminPage() {
  const [combos, setCombos] = useState<ComboDiscount[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editVals, setEditVals] = useState<Record<string, { name: string; discount_amount: string }>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/combo-discounts')
      .then(r => r.json())
      .then((data: ComboDiscount[]) => {
        setCombos(data)
        const vals: Record<string, { name: string; discount_amount: string }> = {}
        data.forEach(d => { vals[d.id] = { name: d.name, discount_amount: String(d.discount_amount) } })
        setEditVals(vals)
      })
      .finally(() => setLoading(false))
  }, [])

  async function handleSave(id: string) {
    setError(null)
    setSaving(true)
    const vals = editVals[id]
    const amount = parseFloat(vals.discount_amount)
    if (isNaN(amount) || amount < 0) {
      setError('Discount amount must be a non-negative number')
      setSaving(false)
      return
    }
    const res = await fetch(`/api/admin/combo-discounts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: vals.name.trim(), discount_amount: amount }),
    })
    const updated = await res.json()
    if (!res.ok) {
      setError(updated.error ?? 'Save failed')
    } else {
      setCombos(prev => prev.map(c => c.id === id ? updated : c))
      setEditingId(null)
    }
    setSaving(false)
  }

  async function handleToggle(id: string, is_active: boolean) {
    const res = await fetch(`/api/admin/combo-discounts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active }),
    })
    if (res.ok) {
      setCombos(prev => prev.map(c => c.id === id ? { ...c, is_active } : c))
    }
  }

  return (
    <div className="flex h-screen bg-zinc-950 text-white overflow-hidden">
      <AdminSidebar />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl">
          <h1 className="text-2xl font-bold text-white mb-1">Combo Discounts</h1>
          <p className="text-zinc-400 text-sm mb-6">
            Discount applied when a customer builds a combo meal. Tag menu items with a Combo Role
            and Size Tier in the{' '}
            <a href="/admin" className="text-brand-red hover:underline">Menu Manager</a>.
          </p>

          {error && (
            <div className="bg-red-900/30 border border-red-700 text-red-300 rounded-lg px-4 py-3 mb-4 text-sm">
              {error}
            </div>
          )}

          {loading ? (
            <div className="text-zinc-500 text-sm">Loading...</div>
          ) : (
            <div className="space-y-3">
              {combos.map(combo => (
                <div
                  key={combo.id}
                  className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-brand-red px-2 py-0.5 bg-brand-red/10 rounded">
                        {combo.meal_size}
                      </span>
                      {!combo.is_active && (
                        <span className="text-xs text-zinc-600">inactive</span>
                      )}
                    </div>

                    {editingId === combo.id ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="text"
                          value={editVals[combo.id]?.name ?? ''}
                          onChange={e =>
                            setEditVals(prev => ({ ...prev, [combo.id]: { ...prev[combo.id], name: e.target.value } }))
                          }
                          className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-white w-48 focus:outline-none focus:ring-1 focus:ring-brand-red"
                          placeholder="Discount name"
                        />
                        <div className="flex items-center gap-1">
                          <span className="text-zinc-400 text-sm">£</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={editVals[combo.id]?.discount_amount ?? ''}
                            onChange={e =>
                              setEditVals(prev => ({
                                ...prev,
                                [combo.id]: { ...prev[combo.id], discount_amount: e.target.value },
                              }))
                            }
                            className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-white w-24 focus:outline-none focus:ring-1 focus:ring-brand-red"
                          />
                        </div>
                        <button
                          onClick={() => handleSave(combo.id)}
                          disabled={saving}
                          className="flex items-center gap-1 bg-brand-red hover:bg-brand-red/80 disabled:opacity-50 text-white text-sm px-3 py-1.5 rounded-lg"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Save
                        </button>
                        <button
                          onClick={() => { setEditingId(null); setError(null) }}
                          className="flex items-center gap-1 text-zinc-400 hover:text-white text-sm px-2 py-1.5"
                        >
                          <X className="w-3.5 h-3.5" />
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <span className="text-white font-medium text-sm">{combo.name}</span>
                        <span className="text-emerald-400 font-semibold text-sm">
                          −£{Number(combo.discount_amount).toFixed(2)}
                        </span>
                        <button
                          onClick={() => setEditingId(combo.id)}
                          className="flex items-center gap-1 text-zinc-500 hover:text-white text-xs"
                        >
                          <Pencil className="w-3 h-3" />
                          Edit
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Active toggle */}
                  <button
                    onClick={() => handleToggle(combo.id, !combo.is_active)}
                    title={combo.is_active ? 'Disable' : 'Enable'}
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                      combo.is_active ? 'bg-brand-red' : 'bg-zinc-700'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                        combo.is_active ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
```

- [ ] **Step 3: Add Combos to admin sidebar**

Open `components/admin/admin-sidebar.tsx`. Find `const ALL_NAV = [`. Add a new entry after the `categories` entry:

```typescript
  { id: 'combos', label: 'Combos', icon: Layers, href: '/admin/combos', permission: 'MenuManager' },
```

Note: `Layers` is already imported. No new import needed.

- [ ] **Step 4: Verify**

Navigate to `http://localhost:3000/admin`. Confirm "Combos" appears in sidebar. Click it → `/admin/combos` loads. Verify two rows (Medium/Large). Click Edit on Medium, change discount to £1.75, save. Reload page — verify value persisted. Toggle "Large" active state — verify toggle flips.

- [ ] **Step 5: Commit**

```bash
git add app/admin/combos/layout.tsx app/admin/combos/page.tsx components/admin/admin-sidebar.tsx
git commit -m "feat(admin): Combos page at /admin/combos — manage combo discount amounts"
```

---

### Task 6: Customer combo wizard at /menu/combo

**Files:**
- Create: `app/menu/combo/page.tsx`

> Design note: wizard redirects to `/checkout` directly (not `/order`). The `/order` page's checkout handler overwrites `pendingCart` with its own cart state, which would discard combo items added by the wizard.

- [ ] **Step 1: Create directory**

```powershell
New-Item -ItemType Directory -Force -Path "E:\ChickenTime\chicken-time-reigate\app\menu\combo"
```

- [ ] **Step 2: Create wizard page**

Create `app/menu/combo/page.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { ChevronLeft, ChevronRight, ShoppingCart, Check } from 'lucide-react'

interface ComboItem {
  id: string
  name: string
  description: string | null
  price: number
  image_url: string | null
  size_tier: 'regular' | 'large' | null
}

interface ComboDiscount {
  id: string
  meal_size: string
  name: string
  discount_amount: number
}

interface ComboComponent {
  id: string
  name: string
  category: 'main' | 'side' | 'drink'
  size_tier: 'regular' | 'large'
}

interface StoredCartItem {
  name: string
  price: number
  quantity: number
  totalPrice: number
  extras: { name: string; price: number }[]
  removals: string[]
  notes: string | null
  combo_components?: ComboComponent[]
}

type MealSize = 'medium' | 'large'
type Step = 1 | 2 | 3 | 4

interface Selection {
  size: MealSize | null
  main: ComboItem | null
  side: ComboItem | null
  drink: ComboItem | null
}

const STEP_LABELS: Record<Step, string> = {
  1: 'Size',
  2: 'Main',
  3: 'Side',
  4: 'Drink',
}

export default function ComboBuilderPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)
  const [sel, setSel] = useState<Selection>({ size: null, main: null, side: null, drink: null })
  const [allItems, setAllItems] = useState<{ main: ComboItem[]; side: ComboItem[]; drink: ComboItem[] }>({
    main: [], side: [], drink: [],
  })
  const [discount, setDiscount] = useState<ComboDiscount | null>(null)
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/menu/combo-items?category=main').then(r => r.json()),
      fetch('/api/menu/combo-items?category=side').then(r => r.json()),
      fetch('/api/menu/combo-items?category=drink').then(r => r.json()),
    ]).then(([main, side, drink]) => {
      setAllItems({ main, side, drink })
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (!sel.size) return
    fetch(`/api/menu/combo-discounts?size=${sel.size}`)
      .then(r => r.json())
      .then(setDiscount)
  }, [sel.size])

  // Size-based filtering
  const filteredSides = (): ComboItem[] => {
    if (!sel.size) return allItems.side
    if (sel.size === 'medium') return allItems.side.filter(i => i.size_tier !== 'large')
    if (sel.drink?.size_tier === 'large') return allItems.side.filter(i => i.size_tier !== 'large')
    return allItems.side
  }

  const filteredDrinks = (): ComboItem[] => {
    if (!sel.size) return allItems.drink
    if (sel.size === 'medium') return allItems.drink.filter(i => i.size_tier !== 'large')
    if (sel.side?.size_tier === 'large') return allItems.drink.filter(i => i.size_tier !== 'large')
    return allItems.drink
  }

  const liveTotal = (): number | null => {
    if (!sel.main || !sel.side || !sel.drink) return null
    return Math.max(0, sel.main.price + sel.side.price + sel.drink.price - (discount?.discount_amount ?? 0))
  }

  const pickSize = (size: MealSize) => {
    setSel({ size, main: null, side: null, drink: null })
    setStep(2)
  }

  const pickMain = (item: ComboItem) => {
    setSel(s => ({ ...s, main: item }))
    setStep(3)
  }

  const pickSide = (item: ComboItem) => {
    const mustClearDrink = sel.size === 'large' && item.size_tier === 'large' && sel.drink?.size_tier === 'large'
    setSel(s => ({ ...s, side: item, drink: mustClearDrink ? null : s.drink }))
    setStep(4)
  }

  const pickDrink = (item: ComboItem) => {
    const mustClearSide = sel.size === 'large' && item.size_tier === 'large' && sel.side?.size_tier === 'large'
    setSel(s => ({ ...s, drink: item, side: mustClearSide ? null : s.side }))
    if (mustClearSide) setStep(3)
  }

  const handleAddToCart = () => {
    if (!sel.main || !sel.side || !sel.drink || !sel.size) return
    const total = liveTotal()
    if (total === null) return
    setAdding(true)

    const comboItem: StoredCartItem = {
      name:      `${sel.size === 'large' ? 'Large' : 'Medium'} Combo Meal`,
      price:     total,
      quantity:  1,
      totalPrice: total,
      extras:    [],
      removals:  [],
      notes:     null,
      combo_components: [
        { id: sel.main.id,  name: sel.main.name,  category: 'main',  size_tier: sel.main.size_tier  ?? 'regular' },
        { id: sel.side.id,  name: sel.side.name,  category: 'side',  size_tier: sel.side.size_tier  ?? 'regular' },
        { id: sel.drink.id, name: sel.drink.name, category: 'drink', size_tier: sel.drink.size_tier ?? 'regular' },
      ],
    }

    try {
      const existing: StoredCartItem[] = JSON.parse(sessionStorage.getItem('pendingCart') ?? '[]')
      existing.push(comboItem)
      sessionStorage.setItem('pendingCart', JSON.stringify(existing))
    } catch {
      // sessionStorage blocked (SSR or private browsing guard)
    }

    router.push('/checkout')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-zinc-500 text-sm">Loading menu...</div>
      </div>
    )
  }

  const total = liveTotal()

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
      {/* Header */}
      <div className="border-b border-zinc-800 px-4 py-4 sticky top-0 bg-zinc-950 z-10">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button onClick={() => router.back()} className="text-zinc-400 hover:text-white transition-colors">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-bold">Build Your Meal</h1>
        </div>
      </div>

      {/* Step indicator */}
      <div className="border-b border-zinc-800 px-4 py-3 bg-zinc-950">
        <div className="max-w-2xl mx-auto flex items-center gap-1">
          {([1, 2, 3, 4] as Step[]).map(s => (
            <div key={s} className="flex items-center gap-1">
              <button
                onClick={() => s < step ? setStep(s) : undefined}
                className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-colors ${
                  s < step
                    ? 'bg-brand-red text-white cursor-pointer hover:bg-brand-red/80'
                    : s === step
                    ? 'bg-brand-red text-white'
                    : 'bg-zinc-800 text-zinc-500'
                }`}
              >
                {s < step ? <Check className="h-3.5 w-3.5" /> : s}
              </button>
              <span className={`text-xs hidden sm:inline-block mr-1 ${s === step ? 'text-white font-medium' : 'text-zinc-600'}`}>
                {STEP_LABELS[s]}
              </span>
              {s < 4 && <ChevronRight className="h-3 w-3 text-zinc-700 mr-1" />}
            </div>
          ))}
        </div>
      </div>

      {/* Live price banner */}
      {sel.size && (
        <div className="bg-zinc-900 border-b border-zinc-800 px-4 py-3">
          <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
            <div className="text-xs text-zinc-500 truncate">
              {[sel.main?.name, sel.side?.name, sel.drink?.name].filter(Boolean).join(' · ')}
            </div>
            <div className="text-right shrink-0">
              {total !== null ? (
                <div className="flex items-center gap-2">
                  {discount && discount.discount_amount > 0 && (
                    <span className="text-emerald-400 text-xs">−£{Number(discount.discount_amount).toFixed(2)}</span>
                  )}
                  <span className="text-brand-red font-bold">£{total.toFixed(2)}</span>
                </div>
              ) : (
                <span className="text-zinc-600 text-xs">Select all 3 items</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Step content */}
      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-6">
        {/* Step 1 — Size */}
        {step === 1 && (
          <div>
            <h2 className="text-base font-semibold mb-4">Choose your meal size</h2>
            <div className="grid grid-cols-2 gap-4">
              {(['medium', 'large'] as MealSize[]).map(size => (
                <button
                  key={size}
                  onClick={() => pickSize(size)}
                  className="bg-zinc-900 border-2 border-zinc-700 hover:border-brand-red rounded-xl p-6 text-center transition-all group"
                >
                  <div className="text-3xl mb-3">{size === 'large' ? '🍗' : '🐣'}</div>
                  <div className="text-base font-bold capitalize group-hover:text-brand-red transition-colors">{size}</div>
                  <div className="text-xs text-zinc-500 mt-1">
                    {size === 'medium' ? 'Regular items only' : 'Regular or large items'}
                  </div>
                  {discount && (
                    <div className="text-xs text-emerald-400 mt-2 font-medium">
                      −£{Number(discount.discount_amount).toFixed(2)} deal
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2 — Main */}
        {step === 2 && (
          <div>
            <h2 className="text-base font-semibold mb-4">Choose your main</h2>
            <ItemGrid items={allItems.main} selected={sel.main} onSelect={pickMain} />
          </div>
        )}

        {/* Step 3 — Side */}
        {step === 3 && (
          <div>
            <h2 className="text-base font-semibold mb-1">Choose your side</h2>
            {sel.size === 'medium' && (
              <p className="text-xs text-zinc-500 mb-4">Medium meal — regular only</p>
            )}
            {sel.size === 'large' && sel.drink?.size_tier === 'large' && (
              <p className="text-xs text-amber-400 mb-4">Large drink selected — side must be regular</p>
            )}
            <ItemGrid items={filteredSides()} selected={sel.side} onSelect={pickSide} />
          </div>
        )}

        {/* Step 4 — Drink */}
        {step === 4 && (
          <div>
            <h2 className="text-base font-semibold mb-1">Choose your drink</h2>
            {sel.size === 'medium' && (
              <p className="text-xs text-zinc-500 mb-4">Medium meal — regular only</p>
            )}
            {sel.size === 'large' && sel.side?.size_tier === 'large' && (
              <p className="text-xs text-amber-400 mb-4">Large side selected — drink must be regular</p>
            )}
            <ItemGrid items={filteredDrinks()} selected={sel.drink} onSelect={pickDrink} />

            {sel.drink && (
              <div className="mt-6 pt-6 border-t border-zinc-800">
                <button
                  onClick={handleAddToCart}
                  disabled={adding || total === null}
                  className="w-full bg-brand-red hover:bg-brand-red/80 disabled:opacity-50 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-colors"
                >
                  <ShoppingCart className="h-5 w-5" />
                  {adding
                    ? 'Adding...'
                    : `Add to Cart${total !== null ? ` · £${total.toFixed(2)}` : ''}`}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function ItemGrid({
  items,
  selected,
  onSelect,
}: {
  items: ComboItem[]
  selected: ComboItem | null
  onSelect: (item: ComboItem) => void
}) {
  if (items.length === 0) {
    return (
      <div className="text-center py-12 text-zinc-600 text-sm">
        No items available.
        <br />
        Tag items in the{' '}
        <a href="/admin" className="text-brand-red hover:underline">Menu Manager</a>{' '}
        with a Combo Role.
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {items.map(item => {
        const active = selected?.id === item.id
        return (
          <button
            key={item.id}
            onClick={() => onSelect(item)}
            className={`relative rounded-xl border-2 overflow-hidden text-left transition-all ${
              active ? 'border-brand-red bg-brand-red/5' : 'border-zinc-800 bg-zinc-900 hover:border-zinc-600'
            }`}
          >
            {item.image_url ? (
              <div className="relative w-full h-28">
                <Image src={item.image_url} alt={item.name} fill className="object-cover" />
              </div>
            ) : (
              <div className="w-full h-28 bg-zinc-800 flex items-center justify-center text-3xl">🍗</div>
            )}
            <div className="p-3">
              <div className="text-sm font-medium leading-tight text-white">{item.name}</div>
              {item.size_tier && (
                <div className="text-xs text-zinc-500 mt-0.5 capitalize">{item.size_tier}</div>
              )}
              <div className="text-brand-red font-semibold text-sm mt-1.5">
                £{Number(item.price).toFixed(2)}
              </div>
            </div>
            {active && (
              <div className="absolute top-2 right-2 bg-brand-red rounded-full p-0.5 shadow">
                <Check className="h-3.5 w-3.5 text-white" />
              </div>
            )}
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 3: Check `brand-red` CSS var exists**

Run: `grep -r "brand-red" tailwind.config` in the project root. If it doesn't exist, check `tailwind.config.ts` or `tailwind.config.js`. If `brand-red` is not defined, replace all `brand-red` occurrences in the new file with `orange-500`.

- [ ] **Step 4: Test wizard manually**

Start dev server. Navigate to `http://localhost:3000/menu/combo`.
1. Step 1: Verify Medium/Large tiles render. Pick Large.
2. Step 2: Tag 2 items as `main` in admin, return here. Verify they appear. Pick one.
3. Step 3: Tag 2 items as `side` (one `regular`, one `large`). Verify regular + large shown for Large meal. Pick the `large` side.
4. Step 4: Tag 2 items as `drink` (one `regular`, one `large`). Verify only `regular` drink shows (because large side was chosen).
5. Pick drink. Verify "Add to Cart" button shows with correct total (sum − £2.00).
6. Click Add to Cart → redirects to `/checkout`. Check browser devtools → `sessionStorage.pendingCart` contains combo item with `combo_components` array.

- [ ] **Step 5: Test Medium meal filtering**

Start fresh. Pick Medium. Go to side step. Verify no `large` items appear. Go to drink step. Verify no `large` items appear.

- [ ] **Step 6: Commit**

```bash
git add app/menu/combo/page.tsx
git commit -m "feat(customer): Build Your Meal wizard at /menu/combo"
```

---

### Task 7: Checkout — combo_components pipeline

**Files:**
- Modify: `app/api/checkout/route.ts`

- [ ] **Step 1: Add ComboComponent type and extend CartItem**

Open `app/api/checkout/route.ts`. Find the existing `CartItem` interface (around line 14):

```typescript
interface CartItem {
  name: string
  price: number
  quantity: number
  totalPrice: number
  extras:   Extra[]
  removals: string[]
  notes?: string
}
```

Replace it with:

```typescript
interface ComboComponent {
  id:        string
  name:      string
  category:  'main' | 'side' | 'drink'
  size_tier: 'regular' | 'large'
}

interface CartItem {
  name:              string
  price:             number
  quantity:          number
  totalPrice:        number
  extras:            Extra[]
  removals:          string[]
  notes?:            string
  combo_components?: ComboComponent[]
}
```

- [ ] **Step 2: Add combo_components to order_items insert**

Find the `order_items` insert block (the one with `items.map((item) => ({`). It currently produces:

```typescript
{
  order_id:   order.id,
  item_name:  item.name,
  quantity:   item.quantity,
  unit_price: item.price,
  extras:     item.extras   ?? [],
  removals:   item.removals ?? [],
  notes:      item.notes    ?? null,
}
```

Add `combo_components` to the mapped object:

```typescript
{
  order_id:          order.id,
  item_name:         item.name,
  quantity:          item.quantity,
  unit_price:        item.price,
  extras:            item.extras            ?? [],
  removals:          item.removals          ?? [],
  notes:             item.notes             ?? null,
  combo_components:  item.combo_components  ?? null,
}
```

- [ ] **Step 3: End-to-end test**

Complete the full combo wizard flow in the browser. Use Stripe test card `4242 4242 4242 4242` (any future expiry, any CVC). After redirect to success URL, query via Supabase MCP:

```sql
SELECT item_name, combo_components
FROM order_items
WHERE combo_components IS NOT NULL
ORDER BY created_at DESC
LIMIT 1;
```

Expected result:
```json
{
  "item_name": "Large Combo Meal",
  "combo_components": [
    {"id": "...", "name": "...", "category": "main",  "size_tier": "regular"},
    {"id": "...", "name": "...", "category": "side",  "size_tier": "large"},
    {"id": "...", "name": "...", "category": "drink", "size_tier": "regular"}
  ]
}
```

- [ ] **Step 4: Commit**

```bash
git add app/api/checkout/route.ts
git commit -m "feat(checkout): pass combo_components into order_items JSONB column"
```

---

### Task 8: Order page — combo entry point banner

**Files:**
- Modify: `app/order/page.tsx`

- [ ] **Step 1: Add Link import**

Open `app/order/page.tsx`. Check the imports at the top. If `Link` from `next/link` is not imported, add it:

```typescript
import Link from 'next/link'
```

- [ ] **Step 2: Find the page header / hero section**

Search for the JSX `return (` in `app/order/page.tsx`. Find the first visible heading (likely an `<h1>` or `<section>` that is the menu title). The banner should appear just before the menu item listing.

- [ ] **Step 3: Insert combo banner**

Add this banner just before the category/item listing:

```tsx
{/* Build Your Meal combo entry point */}
<div className="mb-6 bg-gradient-to-r from-zinc-800 to-zinc-900 border border-zinc-700 rounded-xl p-4 flex items-center justify-between gap-4">
  <div>
    <div className="font-bold text-white text-sm">🍗 Build Your Meal</div>
    <div className="text-xs text-zinc-400 mt-0.5">
      Pick your main, side &amp; drink — combo discount applied
    </div>
  </div>
  <Link
    href="/menu/combo"
    className="shrink-0 bg-brand-red hover:bg-brand-red/80 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
  >
    Build Now
  </Link>
</div>
```

- [ ] **Step 4: Test**

Navigate to `http://localhost:3000/order`. Verify the combo banner appears. Click "Build Now" — verify `/menu/combo` loads. Complete wizard → redirects to `/checkout` with combo in cart.

- [ ] **Step 5: Commit**

```bash
git add app/order/page.tsx
git commit -m "feat(order): add Build Your Meal combo entry point banner"
```

---

## Self-Review

**Spec coverage:**
1. DB migration — enums, `menu_items` columns, `combo_discounts`, `order_items.combo_components` → Task 1 ✓
2. Admin ItemModal combo_category + size_tier dropdowns → Task 4 ✓
3. Admin Combos page (discount management) → Task 5 ✓
4. Admin sidebar entry → Task 5 ✓
5. Admin combo-discounts API (GET/POST/PATCH) → Task 3 ✓
6. Public combo-items API → Task 2 ✓
7. Public combo-discounts API → Task 2 ✓
8. Customer 4-step wizard at `/menu/combo` → Task 6 ✓
9. Size filter enforcement (Medium=regular only, Large=mutual large constraint) → Task 6 ✓
10. Live price banner (sum − discount) → Task 6 ✓
11. Cart submission as single bundled CartItem → Task 6 ✓
12. Checkout maps `combo_components` into `order_items` → Task 7 ✓

**Placeholder scan:** None. All code blocks are complete.

**Type consistency:**
- `ComboComponent` defined in Task 7 (`app/api/checkout/route.ts`) and inline-mirrored in Task 6 (`app/menu/combo/page.tsx` → `StoredCartItem.combo_components`). Shape is identical: `{id, name, category, size_tier}` ✓
- `ComboItem` API response (Task 2: `id, name, description, price, image_url, size_tier`) matches what `ComboItem` interface in Task 6 reads ✓
- `ComboDiscount` API response (Task 2: `id, meal_size, name, discount_amount`) matches `ComboDiscount` interface in Tasks 5 and 6 ✓
- `params.id` in Task 3 route handler uses `await params` (Next.js 15 async params pattern) ✓
