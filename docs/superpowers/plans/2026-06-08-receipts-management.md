# Receipts Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `/admin/receipts` — full order history with server-side search/filter, table+card views grouped by day, slide-out drawer with print/copy-link, and CSV export.

**Architecture:** New API route queries orders + drivers + order_items server-side with URL params for all filters. Five new files (route, types, 3 components, page). `AdminSidebar` and `AdminDataTable` unchanged — only sidebar entry added and `Receipts` permission added to staff UI.

**Tech Stack:** Next.js 15 App Router, Supabase JS client (`supabaseAdmin`), Tailwind CSS, `lucide-react`, `react-hot-toast`, TypeScript.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `app/api/admin/receipts/route.ts` | Create | Server-side filtered query, JSON + CSV response |
| `components/admin/receipts/types.ts` | Create | Shared `AdminReceiptOrder`, `OrderItem`, `FilterParams` types |
| `components/admin/receipts/ReceiptDrawer.tsx` | Create | Slide-out detail panel, print, copy link |
| `components/admin/receipts/ReceiptsTable.tsx` | Create | Day-grouped table view |
| `components/admin/receipts/ReceiptsCards.tsx` | Create | Day-grouped 2-col card grid |
| `app/admin/receipts/page.tsx` | Create | Page shell, URL state, fetch, view toggle, pagination |
| `components/admin/admin-sidebar.tsx` | Modify | Add Receipts entry under Operations |
| `app/admin/staff/page.tsx` | Modify | Add `Receipts` to `ALL_PERMISSIONS` |

---

## Task 1: Add Receipts permission + sidebar entry

**Files:**
- Modify: `app/admin/staff/page.tsx`
- Modify: `components/admin/admin-sidebar.tsx`

- [ ] **Step 1: Add Receipts to ALL_PERMISSIONS in staff page**

In `app/admin/staff/page.tsx`, find the `ALL_PERMISSIONS` array (line ~19) and add after the `'Loyalty'` entry:

```typescript
{ key: 'Receipts', label: 'Receipts', desc: 'View full order history, receipts and CSV export' },
```

- [ ] **Step 2: Add Receipts nav entry to sidebar**

In `components/admin/admin-sidebar.tsx`, add `ReceiptText` to the lucide import:
```typescript
import {
  LayoutDashboard, UtensilsCrossed, Settings, MapPin, Tag,
  Truck, Shield, ExternalLink, Layers, TrendingUp, Users, Star, Radio, ReceiptText,
} from 'lucide-react'
```

In the `Operations` group items array, add after the `drivers` entry and before `delivery`:
```typescript
{ id: 'receipts', label: 'Receipts', icon: ReceiptText, href: '/admin/receipts', permission: 'Receipts' },
```

- [ ] **Step 3: Verify sidebar renders — run dev server and open `/admin`**

```bash
cd E:/ChickenTime/chicken-time-reigate && npm run dev
```
Open `http://localhost:3000/admin`. Confirm "Receipts" appears under Operations in the sidebar.

- [ ] **Step 4: Commit**

```bash
git add components/admin/admin-sidebar.tsx app/admin/staff/page.tsx
git commit -m "feat: add Receipts permission and sidebar nav entry"
```

---

## Task 2: Shared types

**Files:**
- Create: `components/admin/receipts/types.ts`

- [ ] **Step 1: Create the types file**

```typescript
// components/admin/receipts/types.ts

export interface OrderItem {
  id: string
  item_name: string | null
  quantity: number
  unit_price: number
  extras: { name: string; price: number }[]
  removals: string[]
  notes: string | null
}

export interface AdminReceiptOrder {
  id: string
  created_at: string
  customer_name: string | null
  customer_email: string | null
  customer_phone: string | null
  customer_notes: string | null
  delivery_address: string | null
  delivery_postcode: string | null
  total_amount: number
  status: string
  delivery_status: string | null
  promo_code_used: string | null
  discount_applied: number
  driver_id: string | null
  driver_name: string | null
  stripe_session_id: string | null
  order_items: OrderItem[]
}

export interface ReceiptsApiResponse {
  orders: AdminReceiptOrder[]
  total: number
  page: number
  pages: number
  summary: { revenue: number }
}

export interface FilterParams {
  q: string
  driver_id: string
  status: string          // comma-separated e.g. "delivered,failed"
  date_from: string       // YYYY-MM-DD
  date_to: string         // YYYY-MM-DD
  amount_min: string
  amount_max: string
  page: string
  view: 'table' | 'cards'
}
```

- [ ] **Step 2: Commit**

```bash
git add components/admin/receipts/types.ts
git commit -m "feat: add shared types for receipts module"
```

---

## Task 3: API route — JSON + CSV

**Files:**
- Create: `app/api/admin/receipts/route.ts`

- [ ] **Step 1: Create the route**

```typescript
// app/api/admin/receipts/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase-admin'
import type { AdminReceiptOrder } from '@/components/admin/receipts/types'

export const dynamic = 'force-dynamic'

async function getAuthedUser() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: perms } = await supabaseAdmin
    .from('staff_permissions')
    .select('role, permissions')
    .eq('email', user.email!)
    .maybeSingle()
  const ok = perms?.role === 'owner' || (perms?.permissions ?? []).includes('Receipts')
  return ok ? user : null
}

function buildQuery(sp: URLSearchParams) {
  const q          = sp.get('q')?.trim() ?? ''
  const driverId   = sp.get('driver_id')?.trim() ?? ''
  const statuses   = sp.get('status')?.trim() ?? ''
  const dateFrom   = sp.get('date_from')?.trim() ?? ''
  const dateTo     = sp.get('date_to')?.trim() ?? ''
  const amountMin  = sp.get('amount_min')?.trim() ?? ''
  const amountMax  = sp.get('amount_max')?.trim() ?? ''

  let query = supabaseAdmin
    .from('orders')
    .select(`
      id, created_at, customer_name, customer_email, customer_phone, customer_notes,
      delivery_address, delivery_postcode, total_amount, status, delivery_status,
      promo_code_used, discount_applied, driver_id, stripe_session_id,
      drivers ( name ),
      order_items ( id, item_name, quantity, unit_price, extras, removals, notes )
    `)
    .order('created_at', { ascending: false })

  if (q) {
    query = query.or(
      `customer_name.ilike.%${q}%,customer_phone.ilike.%${q}%,` +
      `customer_email.ilike.%${q}%,delivery_postcode.ilike.%${q}%,` +
      `id.ilike.%${q}%`
    )
  }
  if (driverId) query = query.eq('driver_id', driverId)
  if (statuses) query = query.in('status', statuses.split(','))
  if (dateFrom) query = query.gte('created_at', `${dateFrom}T00:00:00`)
  if (dateTo)   query = query.lte('created_at', `${dateTo}T23:59:59`)
  if (amountMin) query = query.gte('total_amount', Number(amountMin))
  if (amountMax) query = query.lte('total_amount', Number(amountMax))

  return query
}

function normalise(raw: Record<string, unknown>[]): AdminReceiptOrder[] {
  return raw.map((o) => ({
    id:                o.id as string,
    created_at:        o.created_at as string,
    customer_name:     (o.customer_name as string | null) ?? null,
    customer_email:    (o.customer_email as string | null) ?? null,
    customer_phone:    (o.customer_phone as string | null) ?? null,
    customer_notes:    (o.customer_notes as string | null) ?? null,
    delivery_address:  (o.delivery_address as string | null) ?? null,
    delivery_postcode: (o.delivery_postcode as string | null) ?? null,
    total_amount:      Number(o.total_amount),
    status:            o.status as string,
    delivery_status:   (o.delivery_status as string | null) ?? null,
    promo_code_used:   (o.promo_code_used as string | null) ?? null,
    discount_applied:  Number(o.discount_applied ?? 0),
    driver_id:         (o.driver_id as string | null) ?? null,
    driver_name:       (o.drivers as { name: string } | null)?.name ?? null,
    stripe_session_id: (o.stripe_session_id as string | null) ?? null,
    order_items:       ((o.order_items as unknown[]) ?? []) as AdminReceiptOrder['order_items'],
  }))
}

function toCsv(orders: AdminReceiptOrder[]): string {
  const headers = [
    'Order ID', 'Date', 'Time', 'Customer Name', 'Customer Phone', 'Customer Email',
    'Delivery Address', 'Postcode', 'Driver', 'Status',
    'Items', 'Subtotal', 'Discount', 'Total', 'Promo Code', 'Stripe Session',
  ]
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`
  const rows = orders.map((o) => {
    const date   = new Date(o.created_at)
    const items  = o.order_items.map((i) => `${i.item_name ?? 'Item'} ×${i.quantity}`).join(', ')
    const subtotal = o.order_items.reduce((s, i) => s + i.unit_price * i.quantity, 0)
    return [
      esc(`#${o.id.slice(-6).toUpperCase()}`),
      esc(date.toLocaleDateString('en-GB')),
      esc(date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })),
      esc(o.customer_name ?? ''),
      esc(o.customer_phone ?? ''),
      esc(o.customer_email ?? ''),
      esc(o.delivery_address ?? ''),
      esc(o.delivery_postcode ?? ''),
      esc(o.driver_name ?? ''),
      esc(o.status),
      esc(items),
      esc(subtotal.toFixed(2)),
      esc(o.discount_applied.toFixed(2)),
      esc(o.total_amount.toFixed(2)),
      esc(o.promo_code_used ?? ''),
      esc(o.stripe_session_id ?? ''),
    ].join(',')
  })
  return [headers.map(esc).join(','), ...rows].join('\n')
}

export async function GET(req: NextRequest) {
  const user = await getAuthedUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const sp     = req.nextUrl.searchParams
  const format = sp.get('format') ?? 'json'
  const page   = Math.max(1, parseInt(sp.get('page') ?? '1', 10))
  const perPage = 50

  // For CSV: fetch all matching rows (no pagination)
  if (format === 'csv') {
    const { data, error } = await buildQuery(sp)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const csv      = toCsv(normalise((data ?? []) as Record<string, unknown>[]))
    const today    = new Date().toISOString().slice(0, 10)
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="receipts-${today}.csv"`,
      },
    })
  }

  // JSON: paginated + summary
  const [{ data, error, count }, { data: summaryData }] = await Promise.all([
    buildQuery(sp).range((page - 1) * perPage, page * perPage - 1),
    buildQuery(sp).select('total_amount'),
  ])

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const total   = count ?? summaryData?.length ?? 0
  const revenue = (summaryData ?? []).reduce((s: number, o: { total_amount: number }) => s + Number(o.total_amount), 0)
  const orders  = normalise((data ?? []) as Record<string, unknown>[])

  return NextResponse.json({
    orders,
    total,
    page,
    pages: Math.ceil(total / perPage),
    summary: { revenue },
  })
}
```

> **Note on summary query:** `buildQuery(sp).select('total_amount')` fetches only `total_amount` for all matching rows to compute revenue. Fine for a restaurant with hundreds of orders. The paginated query uses Supabase's `.range()` for server-side pagination.

- [ ] **Step 2: Test JSON endpoint**

With dev server running:
```bash
curl "http://localhost:3000/api/admin/receipts" -H "Cookie: <your-session-cookie>"
```
Expected: `{"orders":[...],"total":N,"page":1,"pages":N,"summary":{"revenue":N}}`

If no cookie available, test by navigating to the page in step after login.

- [ ] **Step 3: Commit**

```bash
git add app/api/admin/receipts/route.ts
git commit -m "feat: add /api/admin/receipts route with JSON and CSV"
```

---

## Task 4: ReceiptDrawer component

**Files:**
- Create: `components/admin/receipts/ReceiptDrawer.tsx`

- [ ] **Step 1: Create the component**

```typescript
// components/admin/receipts/ReceiptDrawer.tsx
'use client'

import { useEffect } from 'react'
import { X, Printer, Link2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { CustomerReceipt } from '@/components/CustomerReceipt'
import { formatDateMedium, formatTime } from '@/lib/utils/format-date'
import type { AdminReceiptOrder } from './types'

const STATUS_STYLES: Record<string, string> = {
  pending:    'bg-zinc-800 text-zinc-400',
  preparing:  'bg-amber-950 text-amber-400',
  ready:      'bg-blue-950 text-blue-400',
  dispatched: 'bg-indigo-950 text-indigo-400',
  delivered:  'bg-green-950 text-green-400',
  failed:     'bg-red-950 text-red-400',
}

interface Props {
  order: AdminReceiptOrder | null
  onClose: () => void
}

export function ReceiptDrawer({ order, onClose }: Props) {
  useEffect(() => {
    if (!order) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [order, onClose])

  if (!order) return null

  const subtotal = order.order_items.reduce((s, i) => s + i.unit_price * i.quantity, 0)

  function handleCopyLink() {
    const url = `${window.location.origin}/track?id=${order!.id}`
    navigator.clipboard.writeText(url)
      .then(() => toast.success('Receipt link copied'))
      .catch(() => toast.error('Could not copy link'))
  }

  function handlePrint() {
    window.print()
  }

  return (
    <>
      {/* Hidden receipt for print — CustomerReceipt is hidden print:block */}
      <CustomerReceipt order={order} />

      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 z-50 w-[420px] bg-zinc-900 border-l border-zinc-800 flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-zinc-800">
          <div>
            <h2 className="text-base font-bold text-white">
              Order #{order.id.slice(-6).toUpperCase()}
            </h2>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-xs text-zinc-500">
                {formatDateMedium(order.created_at)} · {formatTime(order.created_at)}
              </span>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md capitalize ${STATUS_STYLES[order.status] ?? 'bg-zinc-800 text-zinc-400'}`}>
                {order.status}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">

          {/* Customer */}
          <Section label="Customer">
            <Row k="Name"  v={order.customer_name}  bold />
            <Row k="Phone" v={order.customer_phone} />
            <Row k="Email" v={order.customer_email} />
          </Section>

          {/* Delivery */}
          <Section label="Delivery">
            <Row k="Address"  v={order.delivery_address} />
            <Row k="Postcode" v={order.delivery_postcode} bold />
            <Row k="Driver"   v={order.driver_name} bold />
            {order.customer_notes && (
              <Row k="Notes" v={order.customer_notes} muted />
            )}
          </Section>

          {/* Items */}
          <Section label="Items">
            {order.order_items.length === 0 ? (
              <p className="text-xs text-zinc-600 italic">No items recorded</p>
            ) : order.order_items.map((item) => (
              <div key={item.id} className="flex justify-between items-start py-2 border-b border-zinc-800 last:border-0">
                <div className="flex-1">
                  <span className="text-sm font-medium text-white">{item.item_name ?? 'Item'}</span>
                  <span className="text-zinc-600 text-sm"> × {item.quantity}</span>
                  {(item.extras ?? []).map((e) => (
                    <div key={e.name} className="text-xs text-green-600 mt-0.5">+ {e.name}</div>
                  ))}
                  {(item.removals ?? []).map((r) => (
                    <div key={r} className="text-xs text-rose-800 mt-0.5">− {r}</div>
                  ))}
                  {item.notes && (
                    <div className="text-xs text-zinc-600 italic mt-0.5">{item.notes}</div>
                  )}
                </div>
                <span className="text-sm text-zinc-400 ml-3 shrink-0">
                  £{(item.unit_price * item.quantity).toFixed(2)}
                </span>
              </div>
            ))}
          </Section>

          {/* Summary */}
          <Section label="Summary">
            <TotalRow k="Subtotal" v={`£${subtotal.toFixed(2)}`} />
            {order.discount_applied > 0 && (
              <TotalRow
                k={order.promo_code_used ? `Promo (${order.promo_code_used})` : 'Discount'}
                v={`−£${order.discount_applied.toFixed(2)}`}
                green
              />
            )}
            <TotalRow k="Delivery fee" v={`£${(order.total_amount - subtotal + order.discount_applied).toFixed(2)}`} />
            <TotalRow k="Total" v={`£${order.total_amount.toFixed(2)}`} grand />
          </Section>

          {/* Transaction */}
          <Section label="Transaction">
            {order.stripe_session_id && (
              <Row k="Stripe session" v={order.stripe_session_id.slice(0, 28) + '…'} mono />
            )}
            <Row k="Placed" v={`${formatDateMedium(order.created_at)}, ${formatTime(order.created_at)}`} />
          </Section>

        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-zinc-800 flex gap-2">
          <button
            onClick={handlePrint}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-red hover:bg-red-600 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            <Printer className="w-4 h-4" />
            Print Receipt
          </button>
          <button
            onClick={handleCopyLink}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-sm font-semibold rounded-lg transition-colors"
          >
            <Link2 className="w-4 h-4" />
            Copy Link
          </button>
        </div>

      </div>
    </>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="px-5 py-4 border-b border-zinc-800/60">
      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-3">{label}</p>
      {children}
    </div>
  )
}

function Row({ k, v, bold, muted, mono }: { k: string; v: string | null | undefined; bold?: boolean; muted?: boolean; mono?: boolean }) {
  if (!v) return null
  return (
    <div className="flex justify-between items-baseline mb-1.5 last:mb-0 gap-2">
      <span className="text-xs text-zinc-500 shrink-0">{k}</span>
      <span className={`text-xs text-right break-all ${bold ? 'font-semibold text-white' : muted ? 'text-zinc-600 italic' : mono ? 'font-mono text-zinc-700 text-[10px]' : 'text-zinc-300'}`}>
        {v}
      </span>
    </div>
  )
}

function TotalRow({ k, v, green, grand }: { k: string; v: string; green?: boolean; grand?: boolean }) {
  return (
    <div className={`flex justify-between items-baseline py-1 ${grand ? 'border-t border-zinc-700 mt-1 pt-3' : ''}`}>
      <span className={`text-sm ${grand ? 'font-bold text-white' : 'text-zinc-500'}`}>{k}</span>
      <span className={`text-sm ${grand ? 'font-bold text-green-400 text-base' : green ? 'text-green-500' : 'text-zinc-300'}`}>{v}</span>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/admin/receipts/ReceiptDrawer.tsx
git commit -m "feat: add ReceiptDrawer component"
```

---

## Task 5: ReceiptsTable component

**Files:**
- Create: `components/admin/receipts/ReceiptsTable.tsx`

- [ ] **Step 1: Create the component**

```typescript
// components/admin/receipts/ReceiptsTable.tsx
'use client'

import { Printer, Link2 } from 'lucide-react'
import { formatTime, formatDateMedium } from '@/lib/utils/format-date'
import type { AdminReceiptOrder } from './types'

const STATUS_BADGE: Record<string, string> = {
  pending:    'bg-zinc-800 text-zinc-400',
  preparing:  'bg-amber-950 text-amber-400',
  ready:      'bg-blue-950 text-blue-400',
  dispatched: 'bg-indigo-950 text-indigo-400',
  delivered:  'bg-green-950 text-green-400',
  failed:     'bg-red-950 text-red-400',
}

interface DayGroup {
  dateStr: string   // YYYY-MM-DD
  label: string
  orders: AdminReceiptOrder[]
}

function groupByDay(orders: AdminReceiptOrder[]): DayGroup[] {
  const map = new Map<string, AdminReceiptOrder[]>()
  for (const o of orders) {
    const day = o.created_at.slice(0, 10)
    if (!map.has(day)) map.set(day, [])
    map.get(day)!.push(o)
  }
  const today     = new Date().toISOString().slice(0, 10)
  const yesterday = new Date(Date.now() - 864e5).toISOString().slice(0, 10)
  return Array.from(map.entries()).map(([dateStr, orders]) => ({
    dateStr,
    label: dateStr === today
      ? `Today — ${formatDateMedium(dateStr)}`
      : dateStr === yesterday
      ? `Yesterday — ${formatDateMedium(dateStr)}`
      : formatDateMedium(dateStr),
    orders,
  }))
}

interface Props {
  orders: AdminReceiptOrder[]
  onRowClick: (order: AdminReceiptOrder) => void
  onPrint: (order: AdminReceiptOrder) => void
  onCopyLink: (order: AdminReceiptOrder) => void
}

export function ReceiptsTable({ orders, onRowClick, onPrint, onCopyLink }: Props) {
  const groups = groupByDay(orders)

  if (groups.length === 0) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-12 text-center">
        <p className="text-zinc-500 text-sm">No receipts found</p>
        <p className="text-zinc-600 text-xs mt-1">Try adjusting your filters</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {groups.map((group) => {
        const dayRevenue = group.orders.reduce((s, o) => s + o.total_amount, 0)
        return (
          <div key={group.dateStr} className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
            {/* Day header */}
            <div className="flex items-center justify-between px-6 py-2.5 bg-zinc-950/60 border-b border-zinc-800">
              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                {group.label}
              </span>
              <span className="text-[10px] text-zinc-600">
                {group.orders.length} order{group.orders.length !== 1 ? 's' : ''} · £{dayRevenue.toFixed(2)}
              </span>
            </div>

            {/* Table */}
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-800">
                  {['#', 'Time', 'Customer', 'Collected by', 'Address', 'Post', 'Amount', 'Status', ''].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-zinc-600 first:pl-6 last:pr-6">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {group.orders.map((order) => (
                  <tr
                    key={order.id}
                    onClick={() => onRowClick(order)}
                    className="border-b border-zinc-800/50 last:border-0 hover:bg-zinc-800/30 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 pl-6 text-xs font-bold text-brand-red">
                      #{order.id.slice(-6).toUpperCase()}
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-500">
                      {formatTime(order.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs font-medium text-zinc-200">{order.customer_name ?? '—'}</p>
                      {order.customer_phone && (
                        <p className="text-[10px] text-zinc-600 mt-0.5">{order.customer_phone}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs text-zinc-300">{order.driver_name ?? '—'}</p>
                      {order.driver_name && (
                        <p className="text-[10px] text-zinc-600 mt-0.5">Driver</p>
                      )}
                    </td>
                    <td className="px-4 py-3 max-w-[130px]">
                      <p className="text-xs text-zinc-500 truncate">{order.delivery_address ?? '—'}</p>
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold text-zinc-400">
                      {order.delivery_postcode ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-sm font-bold text-green-400">
                      £{order.total_amount.toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md capitalize ${STATUS_BADGE[order.status] ?? 'bg-zinc-800 text-zinc-400'}`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 pr-6">
                      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => onPrint(order)}
                          title="Print receipt"
                          className="p-1.5 rounded text-zinc-600 hover:text-zinc-300 hover:bg-zinc-700 transition-colors"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onCopyLink(order)}
                          title="Copy receipt link"
                          className="p-1.5 rounded text-zinc-600 hover:text-zinc-300 hover:bg-zinc-700 transition-colors"
                        >
                          <Link2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/admin/receipts/ReceiptsTable.tsx
git commit -m "feat: add ReceiptsTable component with day grouping"
```

---

## Task 6: ReceiptsCards component

**Files:**
- Create: `components/admin/receipts/ReceiptsCards.tsx`

- [ ] **Step 1: Create the component**

```typescript
// components/admin/receipts/ReceiptsCards.tsx
'use client'

import { formatTime, formatDateMedium } from '@/lib/utils/format-date'
import type { AdminReceiptOrder } from './types'

const STATUS_BADGE: Record<string, string> = {
  pending:    'bg-zinc-800 text-zinc-400',
  preparing:  'bg-amber-950 text-amber-400',
  ready:      'bg-blue-950 text-blue-400',
  dispatched: 'bg-indigo-950 text-indigo-400',
  delivered:  'bg-green-950 text-green-400',
  failed:     'bg-red-950 text-red-400',
}

function groupByDay(orders: AdminReceiptOrder[]) {
  const map = new Map<string, AdminReceiptOrder[]>()
  for (const o of orders) {
    const day = o.created_at.slice(0, 10)
    if (!map.has(day)) map.set(day, [])
    map.get(day)!.push(o)
  }
  const today     = new Date().toISOString().slice(0, 10)
  const yesterday = new Date(Date.now() - 864e5).toISOString().slice(0, 10)
  return Array.from(map.entries()).map(([dateStr, orders]) => ({
    dateStr,
    label: dateStr === today
      ? `Today — ${formatDateMedium(dateStr)}`
      : dateStr === yesterday
      ? `Yesterday — ${formatDateMedium(dateStr)}`
      : formatDateMedium(dateStr),
    orders,
  }))
}

interface Props {
  orders: AdminReceiptOrder[]
  onCardClick: (order: AdminReceiptOrder) => void
}

export function ReceiptsCards({ orders, onCardClick }: Props) {
  const groups = groupByDay(orders)

  if (groups.length === 0) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-12 text-center">
        <p className="text-zinc-500 text-sm">No receipts found</p>
        <p className="text-zinc-600 text-xs mt-1">Try adjusting your filters</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => {
        const dayRevenue = group.orders.reduce((s, o) => s + o.total_amount, 0)
        return (
          <div key={group.dateStr}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                {group.label}
              </span>
              <span className="text-[10px] text-zinc-600">
                {group.orders.length} order{group.orders.length !== 1 ? 's' : ''} · £{dayRevenue.toFixed(2)}
              </span>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {group.orders.map((order) => (
                <div
                  key={order.id}
                  onClick={() => onCardClick(order)}
                  className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 cursor-pointer hover:border-zinc-700 hover:bg-zinc-800/50 transition-all"
                >
                  <div className="flex items-start justify-between mb-3">
                    <span className="text-xs font-bold text-brand-red">
                      #{order.id.slice(-6).toUpperCase()}
                    </span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md capitalize ${STATUS_BADGE[order.status] ?? 'bg-zinc-800 text-zinc-400'}`}>
                      {order.status}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-zinc-200 mb-0.5">
                    {order.customer_name ?? 'Guest'}
                  </p>
                  {order.customer_phone && (
                    <p className="text-xs text-zinc-500 mb-1">{order.customer_phone}</p>
                  )}
                  {order.driver_name && (
                    <p className="text-xs text-zinc-400 mb-1">🚗 {order.driver_name}</p>
                  )}
                  {order.delivery_postcode && (
                    <p className="text-xs text-zinc-600 mb-2">
                      {order.delivery_address ? `${order.delivery_address}, ` : ''}{order.delivery_postcode}
                    </p>
                  )}
                  {order.order_items.length > 0 && (
                    <p className="text-[10px] text-zinc-600 mb-2 truncate">
                      {order.order_items.map((i) => `${i.item_name ?? 'Item'} ×${i.quantity}`).join(', ')}
                    </p>
                  )}
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-zinc-800">
                    <span className="text-[10px] text-zinc-600">{formatTime(order.created_at)}</span>
                    <span className="text-sm font-bold text-green-400">£{order.total_amount.toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/admin/receipts/ReceiptsCards.tsx
git commit -m "feat: add ReceiptsCards component with day grouping"
```

---

## Task 7: Main page

**Files:**
- Create: `app/admin/receipts/page.tsx`

- [ ] **Step 1: Create the page**

```typescript
// app/admin/receipts/page.tsx
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { ReceiptText, LayoutList, LayoutGrid, ChevronLeft, ChevronRight, Loader2, Download } from 'lucide-react'
import toast from 'react-hot-toast'
import AdminSidebar from '@/components/admin/admin-sidebar'
import { ReceiptsTable } from '@/components/admin/receipts/ReceiptsTable'
import { ReceiptsCards } from '@/components/admin/receipts/ReceiptsCards'
import { ReceiptDrawer } from '@/components/admin/receipts/ReceiptDrawer'
import type { AdminReceiptOrder, ReceiptsApiResponse } from '@/components/admin/receipts/types'

// ── Date chip helpers ──────────────────────────────────────────────────────────
function todayRange() {
  const d = new Date().toISOString().slice(0, 10)
  return { date_from: d, date_to: d }
}
function yesterdayRange() {
  const d = new Date(Date.now() - 864e5).toISOString().slice(0, 10)
  return { date_from: d, date_to: d }
}
function thisWeekRange() {
  const now  = new Date()
  const mon  = new Date(now); mon.setDate(now.getDate() - now.getDay() + 1)
  return { date_from: mon.toISOString().slice(0, 10), date_to: now.toISOString().slice(0, 10) }
}
function thisMonthRange() {
  const now   = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  return { date_from: start.toISOString().slice(0, 10), date_to: now.toISOString().slice(0, 10) }
}

const DATE_PRESETS = [
  { label: 'Today',      fn: todayRange },
  { label: 'Yesterday',  fn: yesterdayRange },
  { label: 'This week',  fn: thisWeekRange },
  { label: 'This month', fn: thisMonthRange },
]

const AMOUNT_PRESETS = [
  { label: 'Any amount',  min: '',   max: ''   },
  { label: 'Under £10',   min: '',   max: '10' },
  { label: '£10 – £25',  min: '10', max: '25' },
  { label: '£25 – £50',  min: '25', max: '50' },
  { label: 'Over £50',    min: '50', max: ''   },
]

const ALL_STATUSES = ['pending', 'preparing', 'ready', 'dispatched', 'delivered', 'failed']

interface Driver { id: string; name: string }

export default function ReceiptsPage() {
  const router     = useRouter()
  const pathname   = usePathname()
  const sp         = useSearchParams()

  const q          = sp.get('q') ?? ''
  const driver_id  = sp.get('driver_id') ?? ''
  const statusStr  = sp.get('status') ?? ''
  const date_from  = sp.get('date_from') ?? todayRange().date_from
  const date_to    = sp.get('date_to')   ?? todayRange().date_to
  const amount_min = sp.get('amount_min') ?? ''
  const amount_max = sp.get('amount_max') ?? ''
  const page       = Math.max(1, parseInt(sp.get('page') ?? '1', 10))
  const view       = (sp.get('view') ?? 'table') as 'table' | 'cards'

  const [data, setData]           = useState<ReceiptsApiResponse | null>(null)
  const [loading, setLoading]     = useState(true)
  const [drivers, setDrivers]     = useState<Driver[]>([])
  const [drawer, setDrawer]       = useState<AdminReceiptOrder | null>(null)
  const [openChip, setOpenChip]   = useState<string | null>(null)
  const [searchInput, setSearchInput] = useState(q)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Build API URL from current SP
  const apiUrl = useCallback(() => {
    const params = new URLSearchParams()
    if (q)          params.set('q', q)
    if (driver_id)  params.set('driver_id', driver_id)
    if (statusStr)  params.set('status', statusStr)
    if (date_from)  params.set('date_from', date_from)
    if (date_to)    params.set('date_to', date_to)
    if (amount_min) params.set('amount_min', amount_min)
    if (amount_max) params.set('amount_max', amount_max)
    params.set('page', String(page))
    return `/api/admin/receipts?${params}`
  }, [q, driver_id, statusStr, date_from, date_to, amount_min, amount_max, page])

  useEffect(() => {
    setLoading(true)
    fetch(apiUrl())
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false) })
      .catch(() => { toast.error('Failed to load receipts'); setLoading(false) })
  }, [apiUrl])

  // Load drivers for filter chip
  useEffect(() => {
    fetch('/api/admin/drivers')
      .then((r) => r.json())
      .then((d) => setDrivers((d.drivers ?? []).map((dr: { id: string; name: string }) => ({ id: dr.id, name: dr.name }))))
      .catch(() => {})
  }, [])

  function setParam(updates: Record<string, string>) {
    const next = new URLSearchParams(sp.toString())
    Object.entries(updates).forEach(([k, v]) => {
      if (v) next.set(k, v); else next.delete(k)
    })
    next.delete('page')
    router.push(`${pathname}?${next}`)
  }

  function handleSearch(value: string) {
    setSearchInput(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setParam({ q: value }), 350)
  }

  function handleExportCsv() {
    const params = new URLSearchParams(sp.toString())
    params.set('format', 'csv')
    params.delete('page')
    window.location.href = `/api/admin/receipts?${params}`
  }

  function handlePrintQuick(order: AdminReceiptOrder) {
    setDrawer(order)
    setTimeout(() => window.print(), 100)
  }

  function handleCopyLink(order: AdminReceiptOrder) {
    const url = `${window.location.origin}/track?id=${order.id}`
    navigator.clipboard.writeText(url)
      .then(() => toast.success('Receipt link copied'))
      .catch(() => toast.error('Could not copy link'))
  }

  const activeStatuses = statusStr ? statusStr.split(',') : []

  function toggleStatus(s: string) {
    const next = activeStatuses.includes(s)
      ? activeStatuses.filter((x) => x !== s)
      : [...activeStatuses, s]
    setParam({ status: next.join(',') })
  }

  // Current date chip label
  const dateLabel = DATE_PRESETS.find((p) => {
    const r = p.fn()
    return r.date_from === date_from && r.date_to === date_to
  })?.label ?? 'Custom range'

  // Current amount chip label
  const amountLabel = AMOUNT_PRESETS.find((p) => p.min === amount_min && p.max === amount_max)?.label ?? 'Any amount'

  const orders = data?.orders ?? []
  const total  = data?.total ?? 0
  const pages  = data?.pages ?? 1
  const revenue = data?.summary.revenue ?? 0

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex">
      <AdminSidebar />

      <main className="flex-1 flex flex-col min-w-0">

        {/* Page header */}
        <header className="flex items-center justify-between px-8 py-5 border-b border-zinc-800 bg-zinc-900/50">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <ReceiptText className="w-5 h-5 text-brand-red" />
              Receipts
            </h1>
            <p className="text-sm text-zinc-500 mt-0.5">
              {loading ? 'Loading…' : `${total.toLocaleString()} orders · £${revenue.toFixed(2)} total`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* View toggle */}
            <div className="flex bg-zinc-800 border border-zinc-700 rounded-lg overflow-hidden">
              <button
                onClick={() => setParam({ view: 'table' })}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold transition-colors ${view === 'table' ? 'bg-brand-red text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                <LayoutList className="w-3.5 h-3.5" /> Table
              </button>
              <button
                onClick={() => setParam({ view: 'cards' })}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold transition-colors ${view === 'cards' ? 'bg-brand-red text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                <LayoutGrid className="w-3.5 h-3.5" /> Cards
              </button>
            </div>
            <button
              onClick={handleExportCsv}
              className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 text-sm font-semibold rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>
        </header>

        {/* Search + filter chips */}
        <div className="px-8 py-4 bg-zinc-950/50 border-b border-zinc-800/60">
          <input
            value={searchInput}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search by name, postcode, order ID, phone…"
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-brand-red/30 mb-3"
          />
          <div className="flex items-center gap-2 flex-wrap relative">

            {/* Date chip */}
            <div className="relative">
              <button
                onClick={() => setOpenChip(openChip === 'date' ? null : 'date')}
                className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${date_from ? 'border-brand-red text-brand-red bg-red-950/30' : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'}`}
              >
                📅 {dateLabel} ▾
              </button>
              {openChip === 'date' && (
                <div className="absolute top-full left-0 mt-1 z-20 bg-zinc-900 border border-zinc-700 rounded-xl shadow-xl p-2 min-w-[180px]">
                  {DATE_PRESETS.map((p) => (
                    <button
                      key={p.label}
                      onClick={() => { setParam(p.fn()); setOpenChip(null) }}
                      className="block w-full text-left text-xs text-zinc-300 hover:text-white hover:bg-zinc-800 px-3 py-2 rounded-lg transition-colors"
                    >
                      {p.label}
                    </button>
                  ))}
                  <div className="border-t border-zinc-800 mt-1 pt-2 px-1">
                    <p className="text-[10px] text-zinc-600 mb-1.5 uppercase tracking-wider">Custom range</p>
                    <div className="flex gap-1.5">
                      <input type="date" value={date_from} onChange={(e) => setParam({ date_from: e.target.value })}
                        className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-white" />
                      <input type="date" value={date_to} onChange={(e) => setParam({ date_to: e.target.value })}
                        className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-white" />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Driver chip */}
            <div className="relative">
              <button
                onClick={() => setOpenChip(openChip === 'driver' ? null : 'driver')}
                className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${driver_id ? 'border-brand-red text-brand-red bg-red-950/30' : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'}`}
              >
                🚗 {driver_id ? (drivers.find((d) => d.id === driver_id)?.name ?? 'Driver') : 'All drivers'} ▾
              </button>
              {openChip === 'driver' && (
                <div className="absolute top-full left-0 mt-1 z-20 bg-zinc-900 border border-zinc-700 rounded-xl shadow-xl p-2 min-w-[160px]">
                  <button onClick={() => { setParam({ driver_id: '' }); setOpenChip(null) }}
                    className="block w-full text-left text-xs text-zinc-300 hover:text-white hover:bg-zinc-800 px-3 py-2 rounded-lg transition-colors">
                    All drivers
                  </button>
                  {drivers.map((d) => (
                    <button key={d.id} onClick={() => { setParam({ driver_id: d.id }); setOpenChip(null) }}
                      className="block w-full text-left text-xs text-zinc-300 hover:text-white hover:bg-zinc-800 px-3 py-2 rounded-lg transition-colors">
                      {d.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Status chip */}
            <div className="relative">
              <button
                onClick={() => setOpenChip(openChip === 'status' ? null : 'status')}
                className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${statusStr ? 'border-brand-red text-brand-red bg-red-950/30' : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'}`}
              >
                📋 {statusStr ? `${activeStatuses.length} selected` : 'All statuses'} ▾
              </button>
              {openChip === 'status' && (
                <div className="absolute top-full left-0 mt-1 z-20 bg-zinc-900 border border-zinc-700 rounded-xl shadow-xl p-2 min-w-[160px]">
                  {ALL_STATUSES.map((s) => (
                    <label key={s} className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-zinc-800 cursor-pointer">
                      <input type="checkbox" checked={activeStatuses.includes(s)} onChange={() => toggleStatus(s)}
                        className="rounded border-zinc-600 accent-red-600" />
                      <span className="text-xs text-zinc-300 capitalize">{s}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Amount chip */}
            <div className="relative">
              <button
                onClick={() => setOpenChip(openChip === 'amount' ? null : 'amount')}
                className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${(amount_min || amount_max) ? 'border-brand-red text-brand-red bg-red-950/30' : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'}`}
              >
                💷 {amountLabel} ▾
              </button>
              {openChip === 'amount' && (
                <div className="absolute top-full left-0 mt-1 z-20 bg-zinc-900 border border-zinc-700 rounded-xl shadow-xl p-2 min-w-[160px]">
                  {AMOUNT_PRESETS.map((p) => (
                    <button key={p.label} onClick={() => { setParam({ amount_min: p.min, amount_max: p.max }); setOpenChip(null) }}
                      className="block w-full text-left text-xs text-zinc-300 hover:text-white hover:bg-zinc-800 px-3 py-2 rounded-lg transition-colors">
                      {p.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Click-away to close chips */}
            {openChip && (
              <div className="fixed inset-0 z-10" onClick={() => setOpenChip(null)} />
            )}
          </div>
        </div>

        {/* Results summary */}
        <div className="flex items-center justify-between px-8 py-2.5 border-b border-zinc-800/40 bg-zinc-950/30">
          <span className="text-xs text-zinc-500">
            {loading ? '…' : `${total.toLocaleString()} order${total !== 1 ? 's' : ''}`}
            {(page > 1 || total > 50) ? ` · page ${page} of ${pages}` : ''}
          </span>
          <span className="text-xs text-zinc-500">
            Total: <span className="text-zinc-300 font-medium">£{revenue.toFixed(2)}</span>
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 px-8 py-6 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-zinc-600" />
            </div>
          ) : view === 'table' ? (
            <ReceiptsTable
              orders={orders}
              onRowClick={setDrawer}
              onPrint={handlePrintQuick}
              onCopyLink={handleCopyLink}
            />
          ) : (
            <ReceiptsCards
              orders={orders}
              onCardClick={setDrawer}
            />
          )}

          {/* Pagination */}
          {!loading && pages > 1 && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-zinc-800">
              <span className="text-xs text-zinc-500">
                Showing {((page - 1) * 50) + 1}–{Math.min(page * 50, total)} of {total.toLocaleString()}
              </span>
              <div className="flex gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setParam({ page: String(page - 1) })}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> Prev
                </button>
                <button
                  disabled={page >= pages}
                  onClick={() => setParam({ page: String(page + 1) })}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  Next <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>

      </main>

      {/* Drawer */}
      <ReceiptDrawer order={drawer} onClose={() => setDrawer(null)} />
    </div>
  )
}
```

- [ ] **Step 2: Verify page loads**

Navigate to `http://localhost:3000/admin/receipts`. Confirm:
- Sidebar visible with Receipts highlighted
- Default filter = today's orders
- Table view shows day-grouped rows
- Toggle to Cards works
- Click a row → drawer slides in
- Print button triggers print dialog
- Copy Link button triggers toast

- [ ] **Step 3: Commit**

```bash
git add app/admin/receipts/page.tsx
git commit -m "feat: add /admin/receipts page with search, filters, table/card views"
```

---

## Task 8: End-to-end smoke test + CSV verify

- [ ] **Step 1: Test search**

Type a customer name in the search box. Confirm table updates after ~350ms debounce with matching rows only.

- [ ] **Step 2: Test date filter**

Click "Today" chip → verify only today's orders show. Click "This week" → more orders appear.

- [ ] **Step 3: Test driver filter**

Select a driver from the driver chip. Confirm only their orders show. Confirm "Collected by" column shows their name.

- [ ] **Step 4: Test status multi-select**

Select "Delivered" + "Failed" in status chip. Confirm both statuses appear in results and others are excluded.

- [ ] **Step 5: Test CSV export**

Click Export CSV. Confirm a `.csv` file downloads. Open it — verify columns: Order ID, Date, Time, Customer Name, Phone, Email, Address, Postcode, Driver, Status, Items, Subtotal, Discount, Total, Promo Code, Stripe Session.

- [ ] **Step 6: Test drawer**

Click any row. Verify:
- Customer section shows name/phone/email
- Delivery section shows address/postcode/driver
- Items section shows line items with extras/removals
- Summary shows subtotal + discount + total
- Print button opens print dialog
- Copy Link button copies `/track?id=...` URL to clipboard and shows toast

- [ ] **Step 7: Test view toggle**

Toggle to Cards. Confirm day-grouped cards render. Click a card → drawer opens. Toggle back to Table.

- [ ] **Step 8: Commit**

```bash
git add .
git commit -m "feat: receipts management module complete"
```
