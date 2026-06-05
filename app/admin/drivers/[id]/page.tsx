'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ChevronLeft, Loader2, CheckCircle2, Clock, Banknote,
  TrendingUp, Calendar, AlertCircle, Receipt,
} from 'lucide-react'
import AdminSidebar from '@/components/admin/admin-sidebar'
import { formatDate } from '@/lib/utils/format-date'

interface Driver {
  id: string
  name: string
  phone: string | null
  status: string
  per_delivery_wage: number
  is_active: boolean
}

interface Delivery {
  id: string
  customer_name: string | null
  delivery_address: string | null
  total_amount: number
  created_at: string
  is_driver_paid: boolean
}

interface Payout {
  id: string
  amount: number
  pay_period_start: string
  pay_period_end: string
  created_at: string
}

interface LedgerData {
  driver: Driver
  deliveries: Delivery[]
  pending_count: number
  pending_balance: number
  lifetime_paid: number
  payouts: Payout[]
}

function toDateStr(date: Date) {
  return date.toISOString().slice(0, 10)
}

function fmtGbp(n: number) {
  return `£${n.toFixed(2)}`
}

export default function DriverLedgerPage() {
  const { id } = useParams<{ id: string }>()

  const today    = new Date()
  const ago30    = new Date(today); ago30.setDate(today.getDate() - 30)
  const [from, setFrom] = useState(toDateStr(ago30))
  const [to,   setTo]   = useState(toDateStr(today))

  const [data,     setData]     = useState<LedgerData | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [settling, setSettling] = useState(false)
  const [error,    setError]    = useState('')
  const [settled,  setSettled]  = useState(false)

  const fetchLedger = useCallback(async () => {
    setLoading(true)
    setError('')
    const res = await fetch(`/api/admin/drivers/${id}/ledger?from=${from}&to=${to}`)
    if (res.ok) {
      setData(await res.json())
    } else {
      setError('Failed to load ledger data.')
    }
    setLoading(false)
  }, [id, from, to])

  useEffect(() => { fetchLedger() }, [fetchLedger])

  async function handleSettle() {
    if (!data || data.pending_count === 0) return
    setSettling(true)
    setError('')
    const res = await fetch(`/api/admin/drivers/${id}/ledger`, { method: 'POST' })
    if (res.ok) {
      setSettled(true)
      await fetchLedger()
      setTimeout(() => setSettled(false), 3000)
    } else {
      const e = await res.json()
      setError(e.error ?? 'Settlement failed')
    }
    setSettling(false)
  }

  const STATUS_STYLES: Record<string, string> = {
    available:   'bg-emerald-500/20 text-emerald-400',
    on_delivery: 'bg-sky-500/20 text-sky-400',
    offline:     'bg-zinc-700/60 text-zinc-400',
  }
  const STATUS_LABELS: Record<string, string> = {
    available:   'Available',
    on_delivery: 'On Delivery',
    offline:     'Offline',
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex">
      <AdminSidebar />

      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="flex items-center gap-4 px-8 py-5 border-b border-zinc-800 bg-zinc-900/50">
          <Link
            href="/admin/drivers"
            className="flex items-center gap-1.5 text-zinc-500 hover:text-white transition-colors text-sm font-medium"
          >
            <ChevronLeft className="w-4 h-4" />
            Fleet &amp; Drivers
          </Link>
          <span className="text-zinc-700">/</span>
          {data ? (
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-white">{data.driver.name}</h1>
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_STYLES[data.driver.status] ?? STATUS_STYLES.offline}`}>
                {STATUS_LABELS[data.driver.status] ?? data.driver.status}
              </span>
              <span className="text-zinc-500 text-sm">{fmtGbp(Number(data.driver.per_delivery_wage))}/delivery</span>
            </div>
          ) : (
            <span className="text-zinc-500 text-sm">Loading…</span>
          )}
        </header>

        <div className="flex-1 px-8 py-8 space-y-8 overflow-auto">

          {/* Date range + settle row */}
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-1.5">From</label>
              <input
                type="date"
                value={from}
                max={to}
                onChange={(e) => setFrom(e.target.value)}
                className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-red [color-scheme:dark]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-1.5">To</label>
              <input
                type="date"
                value={to}
                min={from}
                max={toDateStr(new Date())}
                onChange={(e) => setTo(e.target.value)}
                className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-red [color-scheme:dark]"
              />
            </div>

            <div className="ml-auto flex items-center gap-3">
              {settled && (
                <span className="flex items-center gap-1.5 text-sm text-emerald-400 font-semibold">
                  <CheckCircle2 className="w-4 h-4" />
                  Balance settled!
                </span>
              )}
              <button
                onClick={handleSettle}
                disabled={settling || !data || data.pending_count === 0}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:bg-zinc-800 disabled:text-zinc-600 text-black text-sm font-bold transition-colors"
              >
                {settling
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Settling…</>
                  : <><Banknote className="w-4 h-4" /> Settle Pending Balance</>}
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 text-zinc-600 animate-spin" />
            </div>
          ) : !data ? null : (
            <>
              {/* Stat cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl px-6 py-5">
                  <div className="flex items-center gap-2.5 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                      <Clock className="w-4 h-4 text-amber-400" />
                    </div>
                    <p className="text-sm text-zinc-500 font-medium">Pending Balance</p>
                  </div>
                  <p className="text-3xl font-bold text-amber-400">{fmtGbp(data.pending_balance)}</p>
                  <p className="text-xs text-zinc-600 mt-1">{data.pending_count} unpaid deliveries</p>
                </div>

                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl px-6 py-5">
                  <div className="flex items-center gap-2.5 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                      <TrendingUp className="w-4 h-4 text-emerald-400" />
                    </div>
                    <p className="text-sm text-zinc-500 font-medium">Total Lifetime Paid</p>
                  </div>
                  <p className="text-3xl font-bold text-emerald-400">{fmtGbp(data.lifetime_paid)}</p>
                  <p className="text-xs text-zinc-600 mt-1">{data.payouts.length} payout{data.payouts.length !== 1 ? 's' : ''}</p>
                </div>

                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl px-6 py-5">
                  <div className="flex items-center gap-2.5 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-sky-500/10 flex items-center justify-center">
                      <Calendar className="w-4 h-4 text-sky-400" />
                    </div>
                    <p className="text-sm text-zinc-500 font-medium">Deliveries in Range</p>
                  </div>
                  <p className="text-3xl font-bold text-sky-400">{data.deliveries.length}</p>
                  <p className="text-xs text-zinc-600 mt-1">{from} → {to}</p>
                </div>
              </div>

              {/* Deliveries table */}
              <section>
                <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-4">
                  Deliveries in Selected Range
                </h2>

                {data.deliveries.length === 0 ? (
                  <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center">
                    <Receipt className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
                    <p className="text-zinc-500 text-sm">No deliveries found in this date range.</p>
                  </div>
                ) : (
                  <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-zinc-800/60">
                          <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-600 uppercase tracking-wide">Order Ref</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-600 uppercase tracking-wide">Customer</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-600 uppercase tracking-wide">Address</th>
                          <th className="px-6 py-3 text-right text-xs font-semibold text-zinc-600 uppercase tracking-wide">Order Value</th>
                          <th className="px-6 py-3 text-right text-xs font-semibold text-zinc-600 uppercase tracking-wide">Driver Wage</th>
                          <th className="px-6 py-3 text-right text-xs font-semibold text-zinc-600 uppercase tracking-wide">Date</th>
                          <th className="px-6 py-3 text-center text-xs font-semibold text-zinc-600 uppercase tracking-wide">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/40">
                        {data.deliveries.map((d) => (
                          <tr key={d.id} className="hover:bg-zinc-800/20 transition-colors">
                            <td className="px-6 py-3.5">
                              <span className="font-mono text-xs text-zinc-500">{d.id.slice(0, 8).toUpperCase()}</span>
                            </td>
                            <td className="px-6 py-3.5 text-zinc-300">{d.customer_name ?? '—'}</td>
                            <td className="px-6 py-3.5 text-zinc-400 max-w-[200px] truncate">{d.delivery_address ?? '—'}</td>
                            <td className="px-6 py-3.5 text-right font-semibold text-white">{fmtGbp(Number(d.total_amount))}</td>
                            <td className="px-6 py-3.5 text-right text-zinc-400">{fmtGbp(Number(data.driver.per_delivery_wage))}</td>
                            <td className="px-6 py-3.5 text-right text-zinc-500 whitespace-nowrap">{formatDate(d.created_at)}</td>
                            <td className="px-6 py-3.5">
                              <div className="flex justify-center">
                                {d.is_driver_paid ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400">
                                    <CheckCircle2 className="w-3 h-3" />
                                    Paid
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400">
                                    <Clock className="w-3 h-3" />
                                    Unpaid
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              {/* Payout history */}
              {data.payouts.length > 0 && (
                <section>
                  <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-4">
                    Payout History
                  </h2>
                  <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-zinc-800/60">
                          <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-600 uppercase tracking-wide">Pay Period</th>
                          <th className="px-6 py-3 text-right text-xs font-semibold text-zinc-600 uppercase tracking-wide">Amount Paid</th>
                          <th className="px-6 py-3 text-right text-xs font-semibold text-zinc-600 uppercase tracking-wide">Settled On</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/40">
                        {data.payouts.map((p) => (
                          <tr key={p.id} className="hover:bg-zinc-800/20 transition-colors">
                            <td className="px-6 py-3.5 text-zinc-300">
                              {formatDate(p.pay_period_start)} – {formatDate(p.pay_period_end)}
                            </td>
                            <td className="px-6 py-3.5 text-right font-bold text-emerald-400">{fmtGbp(Number(p.amount))}</td>
                            <td className="px-6 py-3.5 text-right text-zinc-500">{formatDate(p.created_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  )
}
