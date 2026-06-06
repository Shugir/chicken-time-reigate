'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Truck, Loader2, Plus, Pencil, X, Check, BookOpen,
  Banknote, TrendingUp, AlertTriangle, Users,
} from 'lucide-react'
import AdminSidebar from '@/components/admin/admin-sidebar'

interface Driver {
  id: string
  name: string
  phone: string | null
  status: 'available' | 'on_delivery' | 'offline'
  per_delivery_wage: number
  is_active: boolean
  created_at: string
  completed_deliveries: number
  total_wages: number
  successful_drops: number
  failed_returns: number
  pending_wages: number
}

interface Aggregates {
  total_pending_payroll: number
  fleet_success_rate: number
  total_shrinkage: number
  active_roster: number
}

interface DriverForm {
  name: string
  phone: string
  per_delivery_wage: string
}

const EMPTY_FORM: DriverForm = { name: '', phone: '', per_delivery_wage: '0' }

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

function fmtGbp(n: number) {
  return `£${Number(n).toFixed(2)}`
}

export default function DriversPage() {
  const [drivers, setDrivers]         = useState<Driver[]>([])
  const [aggregates, setAggregates]   = useState<Aggregates | null>(null)
  const [loading, setLoading]         = useState(true)
  const [showForm, setShowForm]       = useState(false)
  const [editing, setEditing]         = useState<Driver | null>(null)
  const [form, setForm]               = useState<DriverForm>(EMPTY_FORM)
  const [saving, setSaving]           = useState(false)
  const [saveError, setSaveError]     = useState('')
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set())

  async function fetchDrivers() {
    const res = await fetch('/api/admin/drivers')
    if (res.ok) {
      const json = await res.json()
      setDrivers(json.drivers ?? [])
      setAggregates(json.aggregates ?? null)
    }
    setLoading(false)
  }

  useEffect(() => { fetchDrivers() }, [])

  function openAdd() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setSaveError('')
    setShowForm(true)
  }

  function openEdit(driver: Driver) {
    setEditing(driver)
    setForm({
      name:              driver.name,
      phone:             driver.phone ?? '',
      per_delivery_wage: String(driver.per_delivery_wage),
    })
    setSaveError('')
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditing(null)
    setSaveError('')
  }

  async function handleSave() {
    if (!form.name.trim()) { setSaveError('Name is required'); return }
    const wage = parseFloat(form.per_delivery_wage)
    if (isNaN(wage) || wage < 0) { setSaveError('Wage must be a valid number'); return }

    setSaving(true)
    setSaveError('')
    try {
      const body = {
        name:              form.name.trim(),
        phone:             form.phone.trim() || null,
        per_delivery_wage: wage,
      }
      const res = editing
        ? await fetch(`/api/admin/drivers/${editing.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
        : await fetch('/api/admin/drivers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
      if (!res.ok) {
        const e = await res.json()
        setSaveError(e.error ?? 'Save failed')
        return
      }
      await fetchDrivers()
      closeForm()
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleActive(driver: Driver) {
    setTogglingIds((prev) => new Set(prev).add(driver.id))
    await fetch(`/api/admin/drivers/${driver.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !driver.is_active }),
    })
    await fetchDrivers()
    setTogglingIds((prev) => { const s = new Set(prev); s.delete(driver.id); return s })
  }

  const active   = drivers.filter((d) => d.is_active)
  const inactive = drivers.filter((d) => !d.is_active)

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex">
      <AdminSidebar />

      <main className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center justify-between px-8 py-5 border-b border-zinc-800 bg-zinc-900/50">
          <div>
            <h1 className="text-xl font-bold text-white">Fleet Control Tower</h1>
            <p className="text-sm text-zinc-500 mt-0.5">Fleet overview, payroll, and driver management</p>
          </div>
          <button
            onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2 bg-brand-red hover:bg-red-600 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Driver
          </button>
        </header>

        <div className="flex-1 px-8 py-8 space-y-8 overflow-auto">

          {/* ── Stat Cards ─────────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Pending Payroll */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl px-6 py-5">
              <div className="flex items-center gap-2.5 mb-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <Banknote className="w-4 h-4 text-amber-400" />
                </div>
                <p className="text-sm text-zinc-500 font-medium">Pending Payroll</p>
              </div>
              {loading || !aggregates ? (
                <div className="h-9 w-24 bg-zinc-800 rounded animate-pulse" />
              ) : (
                <>
                  <p className="text-3xl font-bold text-amber-400">{fmtGbp(aggregates.total_pending_payroll)}</p>
                  <p className="text-xs text-zinc-600 mt-1">Across all drivers</p>
                </>
              )}
            </div>

            {/* Fleet Success Rate */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl px-6 py-5">
              <div className="flex items-center gap-2.5 mb-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                </div>
                <p className="text-sm text-zinc-500 font-medium">Fleet Success Rate</p>
              </div>
              {loading || !aggregates ? (
                <div className="h-9 w-20 bg-zinc-800 rounded animate-pulse" />
              ) : (
                <>
                  <p className="text-3xl font-bold text-emerald-400">{aggregates.fleet_success_rate}%</p>
                  <p className="text-xs text-zinc-600 mt-1">Delivered vs dispatched</p>
                </>
              )}
            </div>

            {/* Total Shrinkage */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl px-6 py-5">
              <div className="flex items-center gap-2.5 mb-2">
                <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                </div>
                <p className="text-sm text-zinc-500 font-medium">Total Shrinkage</p>
              </div>
              {loading || !aggregates ? (
                <div className="h-9 w-16 bg-zinc-800 rounded animate-pulse" />
              ) : (
                <>
                  <p className="text-3xl font-bold text-red-400">{aggregates.total_shrinkage}</p>
                  <p className="text-xs text-zinc-600 mt-1">Failed / returned orders</p>
                </>
              )}
            </div>

            {/* Active Roster */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl px-6 py-5">
              <div className="flex items-center gap-2.5 mb-2">
                <div className="w-8 h-8 rounded-lg bg-sky-500/10 flex items-center justify-center">
                  <Users className="w-4 h-4 text-sky-400" />
                </div>
                <p className="text-sm text-zinc-500 font-medium">Active Roster</p>
              </div>
              {loading || !aggregates ? (
                <div className="h-9 w-12 bg-zinc-800 rounded animate-pulse" />
              ) : (
                <>
                  <p className="text-3xl font-bold text-sky-400">{aggregates.active_roster}</p>
                  <p className="text-xs text-zinc-600 mt-1">Available + on delivery</p>
                </>
              )}
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 text-zinc-600 animate-spin" />
            </div>
          ) : (
            <>
              {/* ── Active Drivers ────────────────────────────────────────────── */}
              <section>
                <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-4">
                  Active Drivers ({active.length})
                </h2>
                {active.length === 0 ? (
                  <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center">
                    <Truck className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
                    <p className="text-zinc-500 text-sm">No active drivers. Add one above.</p>
                  </div>
                ) : (
                  <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm min-w-[900px]">
                        <thead>
                          <tr className="border-b border-zinc-800/60">
                            <th className="px-5 py-3 text-left text-xs font-semibold text-zinc-600 uppercase tracking-wide">Name</th>
                            <th className="px-5 py-3 text-left text-xs font-semibold text-zinc-600 uppercase tracking-wide">Phone</th>
                            <th className="px-5 py-3 text-left text-xs font-semibold text-zinc-600 uppercase tracking-wide">Status</th>
                            <th className="px-5 py-3 text-right text-xs font-semibold text-zinc-600 uppercase tracking-wide">Drops ✓</th>
                            <th className="px-5 py-3 text-right text-xs font-semibold text-zinc-600 uppercase tracking-wide">Failed ✗</th>
                            <th className="px-5 py-3 text-right text-xs font-semibold text-zinc-600 uppercase tracking-wide">Total Wages</th>
                            <th className="px-5 py-3 text-right text-xs font-semibold text-zinc-600 uppercase tracking-wide">Pending</th>
                            <th className="px-5 py-3 text-right text-xs font-semibold text-zinc-600 uppercase tracking-wide">Per Drop</th>
                            <th className="px-5 py-3 text-right text-xs font-semibold text-zinc-600 uppercase tracking-wide">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800/40">
                          {active.map((driver) => (
                            <tr key={driver.id} className="hover:bg-zinc-800/20 transition-colors">
                              <td className="px-5 py-3.5">
                                <Link
                                  href={`/admin/drivers/${driver.id}`}
                                  className="font-semibold text-white hover:text-amber-400 transition-colors"
                                >
                                  {driver.name}
                                </Link>
                              </td>
                              <td className="px-5 py-3.5 text-zinc-400">{driver.phone ?? '—'}</td>
                              <td className="px-5 py-3.5">
                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_STYLES[driver.status] ?? STATUS_STYLES.offline}`}>
                                  {STATUS_LABELS[driver.status] ?? driver.status}
                                </span>
                              </td>
                              <td className="px-5 py-3.5 text-right">
                                <span className="font-semibold text-white">{driver.successful_drops}</span>
                              </td>
                              <td className="px-5 py-3.5 text-right">
                                <span className={driver.failed_returns > 0 ? 'font-semibold text-red-400' : 'text-zinc-600'}>
                                  {driver.failed_returns}
                                </span>
                              </td>
                              <td className="px-5 py-3.5 text-right">
                                <span className="font-semibold text-emerald-400">{fmtGbp(driver.total_wages)}</span>
                              </td>
                              <td className="px-5 py-3.5 text-right">
                                <span className={driver.pending_wages > 0 ? 'font-bold text-amber-400' : 'text-zinc-600'}>
                                  {fmtGbp(driver.pending_wages)}
                                </span>
                              </td>
                              <td className="px-5 py-3.5 text-right text-zinc-400">
                                {fmtGbp(Number(driver.per_delivery_wage))}
                              </td>
                              <td className="px-5 py-3.5 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <Link
                                    href={`/admin/drivers/${driver.id}`}
                                    className="p-1.5 rounded-lg text-zinc-500 hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
                                    title="View Ledger"
                                  >
                                    <BookOpen className="w-3.5 h-3.5" />
                                  </Link>
                                  <button
                                    onClick={() => openEdit(driver)}
                                    className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-700 transition-colors"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleToggleActive(driver)}
                                    disabled={togglingIds.has(driver.id)}
                                    className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                    title="Deactivate driver"
                                  >
                                    {togglingIds.has(driver.id) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </section>

              {/* ── Inactive Drivers ──────────────────────────────────────────── */}
              {inactive.length > 0 && (
                <section>
                  <h2 className="text-sm font-semibold text-zinc-600 uppercase tracking-wide mb-4">
                    Inactive Drivers ({inactive.length})
                  </h2>
                  <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden opacity-60">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-zinc-800/60">
                          <th className="px-5 py-3 text-left text-xs font-semibold text-zinc-600 uppercase tracking-wide">Name</th>
                          <th className="px-5 py-3 text-left text-xs font-semibold text-zinc-600 uppercase tracking-wide">Phone</th>
                          <th className="px-5 py-3 text-right text-xs font-semibold text-zinc-600 uppercase tracking-wide">Drops</th>
                          <th className="px-5 py-3 text-right text-xs font-semibold text-zinc-600 uppercase tracking-wide">Total Wages</th>
                          <th className="px-5 py-3 text-right text-xs font-semibold text-zinc-600 uppercase tracking-wide">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/40">
                        {inactive.map((driver) => (
                          <tr key={driver.id} className="hover:bg-zinc-800/20 transition-colors">
                            <td className="px-5 py-3.5">
                              <Link
                                href={`/admin/drivers/${driver.id}`}
                                className="font-semibold text-zinc-500 hover:text-zinc-300 transition-colors"
                              >
                                {driver.name}
                              </Link>
                            </td>
                            <td className="px-5 py-3.5 text-zinc-600">{driver.phone ?? '—'}</td>
                            <td className="px-5 py-3.5 text-right text-zinc-500">{driver.successful_drops}</td>
                            <td className="px-5 py-3.5 text-right text-zinc-500">{fmtGbp(driver.total_wages)}</td>
                            <td className="px-5 py-3.5 text-right">
                              <button
                                onClick={() => handleToggleActive(driver)}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-zinc-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                              >
                                <Check className="w-3.5 h-3.5" />
                                Reactivate
                              </button>
                            </td>
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

      {/* ── Add / Edit Modal ──────────────────────────────────────────────────── */}
      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) closeForm() }}
        >
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-white">
                {editing ? 'Edit Driver' : 'Add Driver'}
              </h2>
              <button onClick={closeForm} className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1.5">Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. John Smith"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-brand-red"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1.5">Phone</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="e.g. 07700 900000"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-brand-red"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1.5">Wage per Delivery (£)</label>
                <input
                  type="number"
                  min={0}
                  step={0.50}
                  value={form.per_delivery_wage}
                  onChange={(e) => setForm((f) => ({ ...f, per_delivery_wage: e.target.value }))}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-brand-red [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>

              {saveError && (
                <p className="text-sm text-red-400">{saveError}</p>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={closeForm}
                  className="flex-1 px-4 py-2.5 rounded-lg border border-zinc-700 text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-brand-red hover:bg-red-600 text-white text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {editing ? 'Save Changes' : 'Add Driver'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
