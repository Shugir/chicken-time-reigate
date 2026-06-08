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
