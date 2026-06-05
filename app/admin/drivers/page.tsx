'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  LayoutDashboard, UtensilsCrossed, Settings, MapPin, Tag, Truck,
  Loader2, Plus, Pencil, X, Check, ExternalLink,
} from 'lucide-react'
import SignOutButton from '@/components/admin/sign-out-button'

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

const NAV = [
  { id: 'dashboard',  label: 'Dashboard',      icon: <LayoutDashboard className="w-4 h-4" />, href: '/admin/dashboard' },
  { id: 'menu',       label: 'Menu Manager',   icon: <UtensilsCrossed className="w-4 h-4" />, href: '/admin' },
  { id: 'settings',   label: 'Store Settings', icon: <Settings className="w-4 h-4" />,        href: '/admin/settings' },
  { id: 'delivery',   label: 'Delivery Zones', icon: <MapPin className="w-4 h-4" />,           href: '/admin/delivery' },
  { id: 'promotions', label: 'Promotions',     icon: <Tag className="w-4 h-4" />,              href: '/admin/promotions' },
  { id: 'drivers',    label: 'Fleet & Drivers', icon: <Truck className="w-4 h-4" />,           href: '/admin/drivers' },
]

export default function DriversPage() {
  const [drivers, setDrivers]       = useState<Driver[]>([])
  const [loading, setLoading]       = useState(true)
  const [showForm, setShowForm]     = useState(false)
  const [editing, setEditing]       = useState<Driver | null>(null)
  const [form, setForm]             = useState<DriverForm>(EMPTY_FORM)
  const [saving, setSaving]         = useState(false)
  const [saveError, setSaveError]   = useState('')

  async function fetchDrivers() {
    const res = await fetch('/api/admin/drivers')
    if (res.ok) setDrivers(await res.json())
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
    await fetch(`/api/admin/drivers/${driver.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !driver.is_active }),
    })
    await fetchDrivers()
  }

  const active   = drivers.filter((d) => d.is_active)
  const inactive = drivers.filter((d) => !d.is_active)

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 bg-zinc-900 border-r border-zinc-800 flex flex-col">
        <div className="px-5 py-5 border-b border-zinc-800">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">🍗</span>
            <div>
              <p className="text-xs font-bold text-white leading-tight">Chicken Time</p>
              <p className="text-[10px] text-zinc-500 leading-tight">Admin Panel</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left
                ${item.href === '/admin/drivers'
                  ? 'bg-brand-red/15 text-white ring-1 ring-brand-red/30'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                }`}
            >
              {item.icon}
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="px-3 pt-2 pb-1 border-t border-zinc-800">
          <a
            href="/kitchen"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <UtensilsCrossed className="w-4 h-4" />
            Kitchen Display
            <ExternalLink className="w-3 h-3 ml-auto opacity-40" />
          </a>
        </div>
        <div className="px-4 py-4 border-t border-zinc-800 space-y-2">
          <SignOutButton />
          <p className="text-[11px] text-zinc-600 px-3">v1.0 · Reigate</p>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center justify-between px-8 py-5 border-b border-zinc-800 bg-zinc-900/50">
          <div>
            <h1 className="text-xl font-bold text-white">Fleet & Drivers</h1>
            <p className="text-sm text-zinc-500 mt-0.5">Manage drivers and view delivery analytics</p>
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
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 text-zinc-600 animate-spin" />
            </div>
          ) : (
            <>
              {/* Active drivers */}
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
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-zinc-800/60">
                          <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-600 uppercase tracking-wide">Name</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-600 uppercase tracking-wide">Phone</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-600 uppercase tracking-wide">Status</th>
                          <th className="px-6 py-3 text-right text-xs font-semibold text-zinc-600 uppercase tracking-wide">Deliveries</th>
                          <th className="px-6 py-3 text-right text-xs font-semibold text-zinc-600 uppercase tracking-wide">Total Wages</th>
                          <th className="px-6 py-3 text-right text-xs font-semibold text-zinc-600 uppercase tracking-wide">Per Delivery</th>
                          <th className="px-6 py-3 text-right text-xs font-semibold text-zinc-600 uppercase tracking-wide">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/40">
                        {active.map((driver) => (
                          <tr key={driver.id} className="hover:bg-zinc-800/20 transition-colors">
                            <td className="px-6 py-3.5">
                              <span className="font-semibold text-white">{driver.name}</span>
                            </td>
                            <td className="px-6 py-3.5">
                              <span className="text-zinc-400">{driver.phone ?? '—'}</span>
                            </td>
                            <td className="px-6 py-3.5">
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_STYLES[driver.status] ?? STATUS_STYLES.offline}`}>
                                {STATUS_LABELS[driver.status] ?? driver.status}
                              </span>
                            </td>
                            <td className="px-6 py-3.5 text-right">
                              <span className="font-semibold text-white">{driver.completed_deliveries}</span>
                            </td>
                            <td className="px-6 py-3.5 text-right">
                              <span className="font-semibold text-emerald-400">£{driver.total_wages.toFixed(2)}</span>
                            </td>
                            <td className="px-6 py-3.5 text-right">
                              <span className="text-zinc-400">£{Number(driver.per_delivery_wage).toFixed(2)}</span>
                            </td>
                            <td className="px-6 py-3.5 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => openEdit(driver)}
                                  className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-700 transition-colors"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleToggleActive(driver)}
                                  className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                  title="Deactivate driver"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              {/* Inactive drivers */}
              {inactive.length > 0 && (
                <section>
                  <h2 className="text-sm font-semibold text-zinc-600 uppercase tracking-wide mb-4">
                    Inactive Drivers ({inactive.length})
                  </h2>
                  <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden opacity-60">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-zinc-800/60">
                          <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-600 uppercase tracking-wide">Name</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-600 uppercase tracking-wide">Phone</th>
                          <th className="px-6 py-3 text-right text-xs font-semibold text-zinc-600 uppercase tracking-wide">Deliveries</th>
                          <th className="px-6 py-3 text-right text-xs font-semibold text-zinc-600 uppercase tracking-wide">Total Wages</th>
                          <th className="px-6 py-3 text-right text-xs font-semibold text-zinc-600 uppercase tracking-wide">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/40">
                        {inactive.map((driver) => (
                          <tr key={driver.id} className="hover:bg-zinc-800/20 transition-colors">
                            <td className="px-6 py-3.5">
                              <span className="font-semibold text-zinc-500">{driver.name}</span>
                            </td>
                            <td className="px-6 py-3.5">
                              <span className="text-zinc-600">{driver.phone ?? '—'}</span>
                            </td>
                            <td className="px-6 py-3.5 text-right">
                              <span className="text-zinc-500">{driver.completed_deliveries}</span>
                            </td>
                            <td className="px-6 py-3.5 text-right">
                              <span className="text-zinc-500">£{driver.total_wages.toFixed(2)}</span>
                            </td>
                            <td className="px-6 py-3.5 text-right">
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

      {/* Add/Edit Modal */}
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
