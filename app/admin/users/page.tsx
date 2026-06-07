'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Loader2, Users, Truck, Star, X, Check } from 'lucide-react'
import toast from 'react-hot-toast'
import AdminSidebar from '@/components/admin/admin-sidebar'

interface AuthUser {
  id: string
  email: string
}

interface Driver {
  id: string
  name: string
  user_id: string | null
}

interface LoyaltyEntry {
  user_id: string
  email: string
  balance: number
}

interface AdjustForm {
  userId: string
  email: string
  currentBalance: number
  delta: string
  note: string
}

export default function UsersPage() {
  const [users, setUsers]       = useState<AuthUser[]>([])
  const [drivers, setDrivers]   = useState<Driver[]>([])
  const [loyalty, setLoyalty]   = useState<LoyaltyEntry[]>([])
  const [loading, setLoading]   = useState(true)
  const [adjustTarget, setAdjustTarget] = useState<AdjustForm | null>(null)
  const [adjustSaving, setAdjustSaving] = useState(false)

  useEffect(() => {
    async function load() {
      const [usersRes, driversRes, loyaltyRes] = await Promise.all([
        fetch('/api/admin/auth-users'),
        fetch('/api/admin/drivers'),
        fetch('/api/admin/loyalty'),
      ])
      if (usersRes.ok)   setUsers(await usersRes.json())
      if (driversRes.ok) {
        const json = await driversRes.json()
        setDrivers(json.drivers ?? [])
      }
      if (loyaltyRes.ok) setLoyalty(await loyaltyRes.json())
      setLoading(false)
    }
    load()
  }, [])

  const driverByUserId = new Map<string, Driver>()
  for (const d of drivers) {
    if (d.user_id) driverByUserId.set(d.user_id, d)
  }

  const balanceByUserId = new Map<string, number>()
  for (const l of loyalty) balanceByUserId.set(l.user_id, l.balance)

  function openAdjust(user: AuthUser) {
    setAdjustTarget({
      userId: user.id,
      email: user.email,
      currentBalance: balanceByUserId.get(user.id) ?? 0,
      delta: '',
      note: '',
    })
  }

  async function handleAdjust() {
    if (!adjustTarget) return
    const delta = parseInt(adjustTarget.delta, 10)
    if (isNaN(delta) || delta === 0) { toast.error('Enter a non-zero point amount'); return }
    setAdjustSaving(true)
    try {
      const res = await fetch(`/api/admin/users/${adjustTarget.userId}/points`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delta, note: adjustTarget.note.trim() || null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to adjust')
      toast.success(`Points updated → ${data.balance.toLocaleString()} pts`)
      setLoyalty((prev) => {
        const existing = prev.find((l) => l.user_id === adjustTarget.userId)
        if (existing) {
          return prev.map((l) => l.user_id === adjustTarget.userId ? { ...l, balance: data.balance } : l)
        }
        return [...prev, { user_id: adjustTarget.userId, email: adjustTarget.email, balance: data.balance }]
      })
      setAdjustTarget(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error')
    } finally {
      setAdjustSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex">
      <AdminSidebar />

      <main className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center justify-between px-8 py-5 border-b border-zinc-800 bg-zinc-900/50">
          <div>
            <h1 className="text-xl font-bold text-white">Auth Users</h1>
            <p className="text-sm text-zinc-500 mt-0.5">All registered accounts, linked drivers, and loyalty balances</p>
          </div>
        </header>

        <div className="flex-1 px-8 py-8 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 text-zinc-600 animate-spin" />
            </div>
          ) : users.length === 0 ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-12 text-center">
              <Users className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
              <p className="text-zinc-500 text-sm font-medium">No users found</p>
            </div>
          ) : (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800/60">
                      <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-600 uppercase tracking-wide">Email</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-600 uppercase tracking-wide">User ID</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-600 uppercase tracking-wide">Linked Driver</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-600 uppercase tracking-wide">Loyalty</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/40">
                    {users.map((user) => {
                      const driver = driverByUserId.get(user.id)
                      const balance = balanceByUserId.get(user.id) ?? 0
                      return (
                        <tr key={user.id} className="hover:bg-zinc-800/20 transition-colors">
                          <td className="px-6 py-3.5">
                            <span className="text-white font-medium">{user.email}</span>
                          </td>
                          <td className="px-6 py-3.5">
                            <span className="font-mono text-xs text-zinc-600">{user.id}</span>
                          </td>
                          <td className="px-6 py-3.5">
                            {driver ? (
                              <Link
                                href={`/admin/drivers/${driver.id}`}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-500/15 text-sky-400 hover:bg-sky-500/25 transition-colors"
                              >
                                <Truck className="w-3 h-3" />
                                {driver.name}
                              </Link>
                            ) : (
                              <span className="text-xs text-zinc-700 italic">Unassigned</span>
                            )}
                          </td>
                          <td className="px-6 py-3.5">
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-semibold ${balance > 0 ? 'text-amber-400' : 'text-zinc-600'}`}>
                                {balance.toLocaleString()} pts
                              </span>
                              <button
                                onClick={() => openAdjust(user)}
                                className="p-1 rounded text-zinc-500 hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
                                title="Adjust points"
                              >
                                <Star className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Adjust Points Modal */}
      {adjustTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setAdjustTarget(null) }}
        >
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-white">Adjust Loyalty Points</h2>
              <button onClick={() => setAdjustTarget(null)} className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-zinc-500 mb-1 truncate">{adjustTarget.email}</p>
            <p className="text-sm text-zinc-400 mb-4">
              Current balance: <span className="font-semibold text-amber-400">{adjustTarget.currentBalance.toLocaleString()} pts</span>
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                  Points adjustment <span className="text-zinc-600">(use − for debit)</span>
                </label>
                <input
                  type="number"
                  value={adjustTarget.delta}
                  onChange={(e) => setAdjustTarget((t) => t ? { ...t, delta: e.target.value } : t)}
                  placeholder="e.g. 500 or -200"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">Note (optional)</label>
                <input
                  type="text"
                  value={adjustTarget.note}
                  onChange={(e) => setAdjustTarget((t) => t ? { ...t, note: e.target.value } : t)}
                  placeholder="e.g. Compensation for late order"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setAdjustTarget(null)}
                className="flex-1 px-4 py-2.5 rounded-lg border border-zinc-700 text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAdjust}
                disabled={adjustSaving || !adjustTarget.delta}
                className="flex-1 px-4 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {adjustSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
