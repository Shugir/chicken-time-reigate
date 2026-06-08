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
