export type OrderUrgency = 'normal' | 'warning' | 'critical'

export function orderUrgency(iso: string): OrderUrgency {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins >= 30) return 'critical'
  if (mins >= 15) return 'warning'
  return 'normal'
}
