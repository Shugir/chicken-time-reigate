// app/api/admin/receipts/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getUserPermissions, hasPermission } from '@/lib/get-user-permissions'
import type { AdminReceiptOrder } from '@/components/admin/receipts/types'

export const dynamic = 'force-dynamic'

function buildQuery(sp: URLSearchParams) {
  const q          = sp.get('q')?.trim() ?? ''
  const safeQ      = q.replace(/[%_(),]/g, '')
  const driverId   = sp.get('driver_id')?.trim() ?? ''
  const statuses   = sp.get('status')?.trim() ?? ''
  const dateFrom   = sp.get('date_from')?.trim() ?? ''
  const dateTo     = sp.get('date_to')?.trim() ?? ''
  const amountMin  = sp.get('amount_min')?.trim() ?? ''
  const amountMax  = sp.get('amount_max')?.trim() ?? ''

  let query = supabaseAdmin
    .from('orders')
    .select(`
      id, created_at, order_type, customer_name, customer_email, customer_phone, customer_notes,
      delivery_address, delivery_postcode, total_amount, status, delivery_status,
      promo_code_used, discount_applied, applied_deals, driver_id, stripe_session_id,
      drivers ( name ),
      order_items ( id, item_name, quantity, unit_price, extras, removals, notes )
    `)
    .order('created_at', { ascending: false })

  if (q) {
    query = query.or(
      `customer_name.ilike.%${safeQ}%,customer_phone.ilike.%${safeQ}%,` +
      `customer_email.ilike.%${safeQ}%,delivery_postcode.ilike.%${safeQ}%,` +
      `id.ilike.%${safeQ}%`
    )
  }
  if (driverId) query = query.eq('driver_id', driverId)
  if (statuses) query = query.in('status', statuses.split(','))
  if (dateFrom) query = query.gte('created_at', `${dateFrom}T00:00:00`)
  if (dateTo)   query = query.lte('created_at', `${dateTo}T23:59:59`)
  const minVal = Number(amountMin)
  const maxVal = Number(amountMax)
  if (amountMin && !isNaN(minVal)) query = query.gte('total_amount', minVal)
  if (amountMax && !isNaN(maxVal)) query = query.lte('total_amount', maxVal)

  return query
}

function normalise(raw: Record<string, unknown>[]): AdminReceiptOrder[] {
  return raw.map((o) => ({
    id:                o.id as string,
    created_at:        o.created_at as string,
    order_type:        (o.order_type as string | null) ?? 'delivery',
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
    applied_deals:     ((o.applied_deals as { deal_id: string; name: string; type: string; savings: number }[] | null) ?? null),
    driver_id:         (o.driver_id as string | null) ?? null,
    driver_name:       (o.drivers as { name: string } | null)?.name ?? null,
    stripe_session_id: (o.stripe_session_id as string | null) ?? null,
    order_items:       ((o.order_items as unknown[]) ?? []) as AdminReceiptOrder['order_items'],
  }))
}

function toCsv(orders: AdminReceiptOrder[]): string {
  const headers = [
    'Order ID', 'Type', 'Date', 'Time', 'Customer Name', 'Customer Phone', 'Customer Email',
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
      esc(o.order_type === 'pickup' ? 'Collection' : 'Delivery'),
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
  const userPerms = await getUserPermissions()
  if (!userPerms || !hasPermission(userPerms, 'Receipts')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const sp     = req.nextUrl.searchParams
  const format = sp.get('format') ?? 'json'
  const page   = Math.max(1, parseInt(sp.get('page') ?? '1', 10))
  const perPage = 50

  // For CSV: fetch all matching rows (no pagination)
  if (format === 'csv') {
    const { data, error } = await buildQuery(sp).limit(5000)
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
  const [{ data, error }, { data: summaryData }] = await Promise.all([
    buildQuery(sp).range((page - 1) * perPage, page * perPage - 1),
    buildQuery(sp).select('total_amount'),
  ])

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const total   = summaryData?.length ?? 0
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
