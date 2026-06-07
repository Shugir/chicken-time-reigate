'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Star, Plus, Minus, X, Check, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import AdminSidebar from '@/components/admin/admin-sidebar'
import { AdminDataTable, type Column } from '@/components/AdminDataTable'

interface UserBalance {
  user_id: string
  email: string
  balance: number
}

interface AdjustForm {
  user_id: string
  email: string
  points: string
  type: 'admin_credit' | 'admin_debit'
  note: string
}

export default function LoyaltyPage() {
  const searchParams = useSearchParams()
  const q = searchParams.get('q') ?? ''

  const [leaderboard, setLeaderboard] = useState<UserBalance[]>([])
  const [loading, setLoading]         = useState(true)
  const [adjustTarget, setAdjustTarget] = useState<UserBalance | null>(null)
  const [form, setForm]               = useState<AdjustForm | null>(null)
  const [saving, setSaving]           = useState(false)

  async function fetchLeaderboard(query: string) {
    setLoading(true)
    const sp = new URLSearchParams()
    if (query) sp.set('q', query)
    const res = await fetch(`/api/admin/loyalty?${sp}`)
    if (res.ok) setLeaderboard(await res.json())
    setLoading(false)
  }

  useEffect(() => { fetchLeaderboard(q) }, [q])

  function openAdjust(user: UserBalance, type: 'admin_credit' | 'admin_debit') {
    setAdjustTarget(user)
    setForm({ user_id: user.user_id, email: user.email, points: '', type, note: '' })
  }

  async function handleAdjust() {
    if (!form) return
    const pts = parseInt(form.points)
    if (isNaN(pts) || pts <= 0) { toast.error('Enter a valid point amount'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/admin/loyalty', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ user_id: form.user_id, points: pts, type: form.type, note: form.note || null }),
      })
      if (!res.ok) { toast.error((await res.json()).error ?? 'Failed'); return }
      toast.success(`${form.type === 'admin_credit' ? '+' : '-'}${pts} points applied`)
      setAdjustTarget(null); setForm(null)
      await fetchLeaderboard(q)
    } finally {
      setSaving(false)
    }
  }

  const columns: Column<UserBalance>[] = [
    {
      key: 'email',
      label: 'Customer',
      render: (u) => <span className="text-white font-medium">{u.email}</span>,
    },
    {
      key: 'balance',
      label: 'Balance',
      headerClassName: 'text-right',
      cellClassName: 'text-right',
      render: (u) => (
        <span className={`font-bold ${u.balance > 0 ? 'text-amber-400' : 'text-zinc-600'}`}>
          {u.balance.toLocaleString()} pts
        </span>
      ),
    },
    {
      key: 'worth',
      label: 'Worth',
      headerClassName: 'text-right',
      cellClassName: 'text-right text-zinc-400 text-xs',
      render: (u) => `£${Math.floor(u.balance / 100).toFixed(2)} redeemable`,
    },
    {
      key: 'actions',
      label: 'Actions',
      headerClassName: 'text-right',
      cellClassName: 'text-right',
      render: (u) => (
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={() => openAdjust(u, 'admin_credit')}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
            title="Add points"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => openAdjust(u, 'admin_debit')}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            title="Deduct points"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
        </div>
      ),
    },
  ]

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex">
      <AdminSidebar />

      <main className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center justify-between px-8 py-5 border-b border-zinc-800 bg-zinc-900/50">
          <div>
            <h1 className="text-xl font-bold text-white">Loyalty Points</h1>
            <p className="text-sm text-zinc-500 mt-0.5">10 pts per £1 spent · 100 pts = £1 redeemable</p>
          </div>
        </header>

        <div className="flex-1 px-8 py-8 overflow-auto">
          <AdminDataTable
            columns={columns}
            data={leaderboard}
            loading={loading}
            searchPlaceholder="Search by email…"
            emptyIcon={<Star className="w-12 h-12" />}
            emptyText={q ? 'No customers match your search' : 'No loyalty transactions yet'}
            keyExtractor={(u) => u.user_id}
          />
        </div>
      </main>

      {/* Adjust modal */}
      {adjustTarget && form && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) { setAdjustTarget(null); setForm(null) } }}
        >
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-white">
                {form.type === 'admin_credit' ? 'Add Points' : 'Deduct Points'}
              </h2>
              <button
                onClick={() => { setAdjustTarget(null); setForm(null) }}
                className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-zinc-500 mb-4">
              {form.email} · current balance:{' '}
              <span className="text-amber-400 font-semibold">{adjustTarget.balance.toLocaleString()} pts</span>
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1.5">Points</label>
                <input
                  type="number"
                  min={1}
                  value={form.points}
                  onChange={(e) => setForm((f) => f ? { ...f, points: e.target.value } : f)}
                  placeholder="e.g. 100"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-brand-red [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1.5">Note (optional)</label>
                <input
                  type="text"
                  value={form.note}
                  onChange={(e) => setForm((f) => f ? { ...f, note: e.target.value } : f)}
                  placeholder="e.g. Goodwill gesture"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-brand-red"
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => { setAdjustTarget(null); setForm(null) }}
                  className="flex-1 px-4 py-2.5 rounded-lg border border-zinc-700 text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAdjust}
                  disabled={saving}
                  className={`flex-1 px-4 py-2.5 rounded-lg text-white text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2 ${
                    form.type === 'admin_credit' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-red-600 hover:bg-red-500'
                  }`}
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {form.type === 'admin_credit' ? 'Add' : 'Deduct'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
