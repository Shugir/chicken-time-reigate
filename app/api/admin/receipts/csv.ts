import type { AdminReceiptOrder, OrderItem } from '@/components/admin/receipts/types'
import { formatExtra } from '@/lib/order-modifiers'

/** One items-cell entry: `2× Nashville (Spicy: Hot; NO Pickles; + Coke ×2)`. */
export function formatCsvItem(i: OrderItem): string {
  const mods = [
    ...(i.spicy_level ? [`Spicy: ${i.spicy_level}`] : []),
    ...(i.removals ?? []).map((r) => `NO ${r}`),
    ...(i.additions ?? []).map((a) => `+ ${a}`),
    ...(i.extras ?? []).map((e) => `+ ${formatExtra(e)}`),
  ]
  return `${i.item_name ?? 'Item'} ×${i.quantity}${mods.length ? ` (${mods.join('; ')})` : ''}`
}

export function toCsv(orders: AdminReceiptOrder[]): string {
  const headers = [
    'Order ID', 'Type', 'Date', 'Time', 'Customer Name', 'Customer Phone', 'Customer Email',
    'Delivery Address', 'Postcode', 'Driver', 'Status',
    'Items', 'Subtotal', 'Discount', 'Total', 'Promo Code', 'Stripe Session',
  ]
  // Text starting with = + - @ tab or CR runs as a formula in Excel/Sheets; a leading ' defuses it.
  // Plain numbers (money columns) are left alone.
  const esc = (v: string) => {
    const safe = /^[=+\-@\t\r]/.test(v) && !/^-?\d+(\.\d+)?$/.test(v) ? `'${v}` : v
    return `"${safe.replace(/"/g, '""')}"`
  }
  const rows = orders.map((o) => {
    const date   = new Date(o.created_at)
    const items  = o.order_items.map(formatCsvItem).join(', ')
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
