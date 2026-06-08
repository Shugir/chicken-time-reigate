import { formatDateMedium } from '@/lib/utils/format-date'
import type { AdminReceiptOrder } from './types'

export interface DayGroup {
  dateStr: string   // YYYY-MM-DD
  label: string
  orders: AdminReceiptOrder[]
}

export function groupByDay(orders: AdminReceiptOrder[]): DayGroup[] {
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

export const STATUS_BADGE: Record<string, string> = {
  pending:    'bg-zinc-800 text-zinc-400',
  preparing:  'bg-amber-950 text-amber-400',
  ready:      'bg-blue-950 text-blue-400',
  dispatched: 'bg-indigo-950 text-indigo-400',
  delivered:  'bg-green-950 text-green-400',
  failed:     'bg-red-950 text-red-400',
}
