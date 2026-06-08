# Receipts Management — Design Spec
**Date:** 2026-06-08  
**Status:** Approved

---

## Goal

Admin page at `/admin/receipts` for searching, filtering, and viewing the full history of all orders. High-end search feel. Two views (table + cards), day-grouped, slide-out drawer per order, print receipt, copy receipt link, CSV export.

---

## Architecture

### New files
```
app/admin/receipts/page.tsx
app/api/admin/receipts/route.ts
components/admin/receipts/ReceiptsTable.tsx
components/admin/receipts/ReceiptsCards.tsx
components/admin/receipts/ReceiptDrawer.tsx
```

### Modified files
```
components/admin/admin-sidebar.tsx   — add Receipts nav entry under Operations
```

### Unchanged
- `AdminDataTable` — not used, not touched
- `CustomerReceipt` — reused in drawer for print
- `AdminSidebar` — entry added only, layout/theme unchanged
- Admin layout (`app/admin/layout.tsx`) — unchanged

---

## API: `GET /api/admin/receipts`

### Auth
`role === 'owner' || permissions.includes('Receipts')`  
Same pattern as all other admin routes (supabaseAdmin + staff_permissions check).

### Query params
| Param | Type | Default | Notes |
|---|---|---|---|
| `q` | string | — | Searches customer_name, customer_phone, customer_email, delivery_postcode, id (all ILIKE %q%) |
| `driver_id` | uuid | — | Filter by specific driver |
| `status` | string | — | Comma-separated: `delivered,failed` etc. |
| `date_from` | ISO date | — | Inclusive lower bound on created_at |
| `date_to` | ISO date | — | Inclusive upper bound on created_at |
| `amount_min` | number | — | Inclusive lower bound on total_amount |
| `amount_max` | number | — | Inclusive upper bound on total_amount |
| `page` | number | 1 | 1-indexed |
| `per_page` | number | 50 | Fixed at 50 |
| `format` | `json` \| `csv` | `json` | CSV returns all matching rows, no pagination |

### JSON response
```typescript
{
  orders: ReceiptOrder[]
  total: number        // total matching rows
  page: number
  pages: number
  summary: {
    revenue: number    // sum of total_amount for all matching rows
  }
}
```

### CSV response
- `Content-Disposition: attachment; filename="receipts-YYYY-MM-DD.csv"`
- `Content-Type: text/csv`
- Columns: `Order ID, Date, Time, Customer Name, Customer Phone, Customer Email, Delivery Address, Postcode, Driver, Status, Items, Subtotal, Discount, Total, Promo Code, Stripe Session`
- Items column: comma-joined `"Name ×qty"` strings
- No pagination — all matching rows

### Data shape
```typescript
interface ReceiptOrder {
  id: string
  created_at: string
  customer_name: string | null
  customer_email: string | null
  customer_phone: string | null
  delivery_address: string | null
  delivery_postcode: string | null
  total_amount: number
  status: string                   // order_status enum
  delivery_status: string | null
  promo_code_used: string | null
  discount_applied: number
  driver_id: string | null
  driver_name: string | null       // LEFT JOIN drivers(name)
  stripe_session_id: string | null
  order_items: OrderItem[]         // always included; JOIN in main query
}

interface OrderItem {
  id: string
  item_name: string | null
  quantity: number
  unit_price: number
  extras: { name: string; price: number }[]
  removals: string[]
  notes: string | null
}
```

### DB query
```sql
SELECT
  o.*,
  d.name AS driver_name,
  json_agg(oi ORDER BY oi.created_at) FILTER (WHERE oi.id IS NOT NULL) AS order_items
FROM orders o
LEFT JOIN drivers d ON d.id = o.driver_id
LEFT JOIN order_items oi ON oi.order_id = o.id
WHERE
  -- q filter (any of):
  (o.customer_name ILIKE '%q%' OR o.customer_phone ILIKE '%q%'
   OR o.customer_email ILIKE '%q%' OR o.delivery_postcode ILIKE '%q%'
   OR o.id::text ILIKE '%q%')
  AND (driver_id = $driver_id)          -- if set
  AND (status = ANY($statuses))         -- if set
  AND (created_at >= $date_from)        -- if set
  AND (created_at <= $date_to + '1 day') -- if set (inclusive day)
  AND (total_amount >= $amount_min)     -- if set
  AND (total_amount <= $amount_max)     -- if set
GROUP BY o.id, d.name
ORDER BY o.created_at DESC
LIMIT 50 OFFSET (page-1)*50
```

---

## Page: `app/admin/receipts/page.tsx`

`'use client'` component. State managed via URL search params (same pattern as existing admin pages — shareable, bookmarkable links).

### URL params used
`q`, `driver_id`, `status`, `date_from`, `date_to`, `amount_min`, `amount_max`, `page`, `view` (`table` | `cards`)

### Layout structure
```
<AdminSidebar />
<div className="p-6">          {/* pl-60 comes from admin layout */}
  <PageHeader />               {/* title, subtitle, view toggle, CSV button */}
  <SearchZone />               {/* search input + 4 filter chips */}
  <ResultsSummaryBar />        {/* "Showing N orders · Total £X" */}
  <DayGroupedResults />        {/* ReceiptsTable or ReceiptsCards */}
  <Pagination />               {/* prev/next, "1–50 of 247" */}
  <ReceiptDrawer />            {/* slide-out, null when closed */}
</div>
```

---

## Component: ReceiptsTable

Day-grouped table view (default).

### Day group header
```
Today — 8 Jun 2026          12 orders · £284.50
```
Sticky within scroll: `position: sticky; top: 0; z-index: 10`

### Table columns
| Column | Value |
|---|---|
| # | `order.id.slice(-6).toUpperCase()` in brand red |
| Time | `HH:MM` from created_at (date shown in group header) |
| Customer | name + phone below in zinc-500 |
| Collected by | driver_name + "Driver" label below |
| Address | delivery_address (truncated) |
| Post | delivery_postcode bold |
| Amount | total_amount in green |
| Status | badge (delivered/failed/pending/preparing/ready/dispatched) |
| Actions | 🖨 print icon, 🔗 copy-link icon — open drawer on row click |

Row click → opens `ReceiptDrawer` with that order.

---

## Component: ReceiptsCards

Day-grouped card grid view (toggle from table).

- 2-column grid on `lg:`, 1-column on mobile
- Each card: order ID (red) + status badge top row; customer name + phone; driver name; address + postcode; items count; amount (green, large); time bottom-right
- Click card → opens `ReceiptDrawer`
- Same day-group headers as table

---

## Component: ReceiptDrawer

Slide-in from right. Overlay backdrop (`bg-black/50 backdrop-blur-sm`).

### Width
`w-[420px]` fixed

### Sections
1. **Header** — order ID, datetime, status badge, close button (✕)
2. **Customer** — name, phone, email
3. **Delivery** — address, postcode, driver name, customer notes
4. **Items** — each item: name × qty, extras (green), removals (red), notes (italic zinc)
5. **Summary** — subtotal, promo discount (green), delivery fee, **Total** (large green)
6. **Transaction** — Stripe session ID (mono small), placed datetime

### Footer actions
- **Print Receipt** (primary red button) — `window.print()`. The hidden `CustomerReceipt` component (already exists) renders the thermal receipt. Print styles in `globals.css` handle suppressing dark backgrounds.
- **Copy Link** (secondary button) — copies `${window.location.origin}/track?id=${order.id}` to clipboard; `toast.success('Link copied')`.

### Close
Click overlay or ✕ button. `Escape` key also closes.

---

## Filter Chips

Four chips below the search bar. Active chip: red border + red text + dark red bg. Inactive: zinc border + zinc text.

### Date chip
Options: `Today` (default) | `Yesterday` | `This week` | `This month` | `Custom range`  
Custom range: shows two date inputs (from / to) inline in dropdown.  
Sets `date_from` + `date_to` URL params.  
**Default on page load (no URL params):** shows Today's orders — `date_from` = start of today (00:00 local), `date_to` = end of today. User can clear to see all-time.

### Driver chip
Dropdown list of active drivers fetched once on page load.  
Single select + "All drivers" option.  
Sets `driver_id` URL param.

### Status chip
Multi-select checkboxes: Pending / Preparing / Ready / Dispatched / Delivered / Failed  
Sets `status` URL param as comma-separated string.

### Amount chip
Preset bands:
- Any (default)
- Under £10 → `amount_max=10`
- £10–£25 → `amount_min=10&amount_max=25`
- £25–£50 → `amount_min=25&amount_max=50`
- Over £50 → `amount_min=50`

---

## Sidebar Update

`components/admin/admin-sidebar.tsx` — add one entry to the Operations group:

```typescript
{ id: 'receipts', label: 'Receipts', icon: ReceiptText, href: '/admin/receipts', permission: 'Receipts' }
```

Position: between `Fleet & Drivers` and `Delivery Zones`.  
`ReceiptText` imported from `lucide-react`.

---

## Permission

Permission string: `'Receipts'`  
No DB migration needed — `staff_permissions.permissions` is already `text[]`.  
Staff with this permission see the sidebar entry and can access the API.  
Add `'Receipts'` to the list of known permissions in `admin/staff/page.tsx` permission-assignment UI (if it has a hardcoded list).

---

## Theme / Styling

Follow existing admin pages exactly:
- Font: `font-sans` (Geist Sans via CSS variable) for body, `font-heading` (Inter) for page title
- Brand red: `#E4002B` (`bg-brand-red` / `text-brand-red`)
- Backgrounds: `bg-zinc-950` page, `bg-zinc-900` drawer, `bg-zinc-800/60` borders
- Status badges: same color tokens used in dispatch page
- No new color tokens introduced

---

## Error States

- **Empty state (no results):** centered icon (`ReceiptText`) + "No receipts found" + "Try adjusting your filters" 
- **API error:** `toast.error('Failed to load receipts')`, retry button
- **CSV export error:** `toast.error('Export failed')`
- **Copy link fail:** `toast.error('Could not copy link')` (clipboard API denied)

---

## Out of Scope

- Email sending (resend to customer) — deferred
- Collection/pickup order type — deferred (future module)
- Editing or cancelling orders from this page — read-only view only
- Real-time updates — receipts are historical, no realtime subscription needed
