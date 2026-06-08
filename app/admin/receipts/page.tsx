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

// ── Date chip helpers — use local date components to avoid UTC/BST shift ──────
function localDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function todayRange() {
  const d = localDate(new Date())
  return { date_from: d, date_to: d }
}
function yesterdayRange() {
  const y = new Date(); y.setDate(y.getDate() - 1)
  const d = localDate(y)
  return { date_from: d, date_to: d }
}
function thisWeekRange() {
  const now = new Date()
  // ISO weekday: Mon=1 … Sat=6, Sun=7 (getDay returns 0 for Sunday)
  const isoDay = now.getDay() || 7
  const mon = new Date(now); mon.setDate(now.getDate() - isoDay + 1)
  return { date_from: localDate(mon), date_to: localDate(now) }
}
function thisMonthRange() {
  const now = new Date()
  const year  = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return { date_from: `${year}-${month}-01`, date_to: localDate(now) }
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
  const [pendingPrint, setPendingPrint] = useState(false)
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

  useEffect(() => { setSearchInput(q) }, [q])

  useEffect(() => {
    if (pendingPrint && drawer) {
      window.print()
      setPendingPrint(false)
    }
  }, [pendingPrint, drawer])

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
    setPendingPrint(true)
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
