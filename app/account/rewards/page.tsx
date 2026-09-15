'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase-browser'
import {
  ArrowLeft, Loader2, Star, Lock, CheckCircle2,
  ChevronDown, ChevronUp, Gift, Zap, TrendingUp,
} from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { ThemeToggle } from '@/components/ThemeToggle'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Reward {
  id:               string
  code:             string
  discount_type:    'percentage' | 'flat'
  discount_value:   number
  min_order_amount: number
  points_cost:      number
  is_unlocked:      boolean
  used_at:          string | null
}

interface Transaction {
  id:         string
  points:     number
  type:       string
  note:       string | null
  created_at: string
  order_id:   string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function prettifyCode(code: string): string {
  return code.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function discountLabel(reward: Reward): string {
  if (reward.discount_type === 'percentage') {
    return `${reward.discount_value}% off`
  }
  return `£${Number(reward.discount_value).toFixed(2)} off`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function txIcon(type: string): string {
  if (type === 'earn')   return '+'
  if (type === 'redeem') return '-'
  if (type === 'adjust') return '~'
  return '•'
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`bg-zinc-200 dark:bg-zinc-800 animate-pulse rounded-lg ${className ?? ''}`} />
  )
}

// ─── RewardCard ───────────────────────────────────────────────────────────────

function RewardCard({
  reward,
  balance,
  onUnlock,
  unlocking,
}: {
  reward:    Reward
  balance:   number
  onUnlock:  (id: string) => void
  unlocking: string | null
}) {
  const canAfford    = balance >= reward.points_cost
  const isUnlocking  = unlocking === reward.id
  const alreadyUsed  = reward.is_unlocked && reward.used_at
  const readyToUse   = reward.is_unlocked && !reward.used_at

  return (
    <div className={`bg-white dark:bg-zinc-900 border rounded-3xl shadow-sm dark:shadow-none p-5 flex flex-col gap-3 transition-all ${
      readyToUse
        ? 'border-green-700/60 shadow-green-900/20 shadow-md'
        : alreadyUsed
          ? 'border-zinc-200 dark:border-zinc-800 opacity-60'
          : canAfford
            ? 'border-amber-700/50'
            : 'border-zinc-200 dark:border-zinc-800'
    }`}>
      {/* Top row */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-brand-dark dark:text-white leading-tight">
            {prettifyCode(reward.code)}
          </h3>
          <p className="text-xs text-zinc-400 mt-0.5">
            {discountLabel(reward)}
            {Number(reward.min_order_amount) > 0 && (
              <span className="text-zinc-600 ml-1">
                · min £{Number(reward.min_order_amount).toFixed(2)}
              </span>
            )}
          </p>
        </div>

        {/* Status badge */}
        {readyToUse ? (
          <span className="shrink-0 flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-500/15 text-green-400">
            <CheckCircle2 size={10} />
            Unlocked
          </span>
        ) : alreadyUsed ? (
          <span className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-500">
            Used
          </span>
        ) : (
          <span className="shrink-0 flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400">
            <Star size={10} />
            {reward.points_cost.toLocaleString()} pts
          </span>
        )}
      </div>

      {/* Bottom row — action */}
      {readyToUse && (
        <p className="text-xs text-green-400/80 font-medium">
          Enter code <span className="font-mono tracking-wider text-green-600 dark:text-green-300">{reward.code}</span> at checkout
        </p>
      )}

      {alreadyUsed && (
        <p className="text-xs text-zinc-600">
          Used {formatDate(reward.used_at!)}
        </p>
      )}

      {!reward.is_unlocked && canAfford && (
        <button
          onClick={() => onUnlock(reward.id)}
          disabled={isUnlocking}
          className="w-full mt-auto bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-zinc-950 font-semibold
                     rounded-lg py-2 text-xs transition-colors flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform"
        >
          {isUnlocking ? (
            <><Loader2 size={12} className="animate-spin" /> Unlocking…</>
          ) : (
            <><Gift size={12} /> Unlock for {reward.points_cost.toLocaleString()} pts</>
          )}
        </button>
      )}

      {!reward.is_unlocked && !canAfford && (
        <div className="space-y-1.5">
          <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
            <div
              className="h-full bg-amber-500/50 rounded-full transition-all"
              style={{ width: `${Math.min(100, (balance / reward.points_cost) * 100)}%` }}
            />
          </div>
          <p className="text-[10px] text-zinc-500 text-right">
            {balance.toLocaleString()} / {reward.points_cost.toLocaleString()} pts
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function RewardsPage() {
  const router = useRouter()

  const [authed,    setAuthed]    = useState<boolean | null>(null)   // null = checking
  const [balance,   setBalance]   = useState(0)
  const [txns,      setTxns]      = useState<Transaction[]>([])
  const [rewards,   setRewards]   = useState<Reward[]>([])
  const [loading,   setLoading]   = useState(true)
  const [unlocking, setUnlocking] = useState<string | null>(null)
  const [histOpen,  setHistOpen]  = useState(false)

  // ── Fetch helpers ──────────────────────────────────────────────────────────

  const fetchBalance = useCallback(async () => {
    const res = await fetch('/api/loyalty/balance')
    if (res.ok) {
      const data = await res.json()
      setBalance(data.balance ?? 0)
      setTxns(data.transactions ?? [])
    }
  }, [])

  const fetchRewards = useCallback(async () => {
    const res = await fetch('/api/rewards')
    if (res.ok) {
      const data = await res.json()
      setRewards(Array.isArray(data) ? data : [])
    }
  }, [])

  // ── Auth + initial load ────────────────────────────────────────────────────

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        setAuthed(false)
        setLoading(false)
        return
      }
      setAuthed(true)
      await Promise.all([fetchBalance(), fetchRewards()])
      setLoading(false)
    })
  }, [fetchBalance, fetchRewards])

  // ── Unlock handler ─────────────────────────────────────────────────────────

  async function handleUnlock(promotionId: string) {
    setUnlocking(promotionId)
    try {
      const res = await fetch('/api/rewards/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ promotion_id: promotionId }),
      })
      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error ?? 'Failed to unlock reward')
        return
      }

      toast.success('Reward unlocked! Use the code at checkout.')
      setBalance(data.new_balance)
      await fetchRewards()
      await fetchBalance()
    } catch {
      toast.error('Something went wrong — please try again')
    } finally {
      setUnlocking(null)
    }
  }

  // ── Progress bar helpers ───────────────────────────────────────────────────

  // Find the next affordable reward threshold (lowest points_cost > balance, or highest overall)
  const nextThreshold = rewards
    .filter((r) => !r.is_unlocked)
    .map((r) => r.points_cost)
    .sort((a, b) => a - b)
    .find((pts) => pts > balance)
    ?? rewards.reduce((max, r) => Math.max(max, r.points_cost), 100)

  const progressPct = Math.min(100, (balance / nextThreshold) * 100)
  const poundValue  = (balance / 100).toFixed(2)

  // ── Not signed in ──────────────────────────────────────────────────────────

  if (authed === false) {
    return (
      <div className="min-h-screen bg-white dark:bg-zinc-950 text-brand-dark dark:text-white flex flex-col">
        <div className="sticky top-0 z-10 bg-white/90 dark:bg-zinc-950/90 backdrop-blur border-b border-zinc-200 dark:border-zinc-900">
          <div className="max-w-lg mx-auto px-4 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/account" className="text-zinc-500 hover:text-brand-dark dark:hover:text-white transition-colors">
                <ArrowLeft size={18} />
              </Link>
              <p className="text-sm font-semibold">My Rewards</p>
            </div>
            <ThemeToggle />
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="text-center max-w-xs">
            <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
              <Star className="w-8 h-8 text-amber-400" />
            </div>
            <h2 className="text-lg font-semibold text-brand-dark dark:text-white mb-2">Sign in to view your rewards</h2>
            <p className="text-sm text-zinc-500 mb-6">
              Earn points with every order and unlock exclusive discounts.
            </p>
            <Link
              href="/sign-in"
              className="inline-flex items-center gap-2 bg-brand-red hover:bg-brand-red/90 text-white font-semibold
                         rounded-xl px-6 py-3 text-sm transition-colors active:scale-[0.98]"
            >
              Sign In
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // ── Loading skeleton ───────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-zinc-950 text-brand-dark dark:text-white">
        <div className="sticky top-0 z-10 bg-white/90 dark:bg-zinc-950/90 backdrop-blur border-b border-zinc-200 dark:border-zinc-900">
          <div className="max-w-lg mx-auto px-4 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/account" className="text-zinc-500 hover:text-brand-dark dark:hover:text-white transition-colors">
                <ArrowLeft size={18} />
              </Link>
              <p className="text-sm font-semibold">My Rewards</p>
            </div>
            <ThemeToggle />
          </div>
        </div>
        <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
          {/* Balance card skeleton */}
          <Skeleton className="h-40 w-full rounded-2xl" />
          {/* Grid skeleton */}
          <div>
            <Skeleton className="h-4 w-32 mb-4" />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-36 w-full rounded-2xl" />
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Segment rewards ────────────────────────────────────────────────────────

  const available = rewards.filter((r) => !r.used_at)
  const used      = rewards.filter((r) => r.used_at)

  // ── Full render ────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 text-brand-dark dark:text-white">

      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-white/90 dark:bg-zinc-950/90 backdrop-blur border-b border-zinc-200 dark:border-zinc-900">
        <div className="max-w-lg mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/account" className="text-zinc-500 hover:text-brand-dark dark:hover:text-white transition-colors">
              <ArrowLeft size={18} />
            </Link>
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold">My Rewards</p>
              {balance > 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400">
                  {balance.toLocaleString()} pts
                </span>
              )}
            </div>
          </div>
          <ThemeToggle />
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-8">

        {/* ── Points balance card ────────────────────────────────────────────── */}
        <div className="bg-gradient-to-br from-white via-white to-zinc-50 dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-sm dark:shadow-none p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-widest mb-2">
                Your Points Balance
              </p>
              <p className="text-5xl font-bold text-amber-400 leading-none">
                {balance.toLocaleString()}
              </p>
              <p className="text-sm text-zinc-400 mt-1.5">
                = <span className="text-amber-300 font-semibold">£{poundValue}</span> value
              </p>
            </div>
            <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
              <TrendingUp className="w-6 h-6 text-amber-400" />
            </div>
          </div>

          {/* Progress bar toward next reward */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <p className="text-[10px] text-zinc-500">Progress to next reward</p>
              <p className="text-[10px] text-zinc-500">
                {balance.toLocaleString()} / {nextThreshold.toLocaleString()} pts
              </p>
            </div>
            <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          {/* How points work */}
          <p className="text-[10px] text-zinc-600 mt-3">
            Earn 10 pts per £1 spent · 100 pts = £1 reward
          </p>
        </div>

        {/* ── Available Rewards ──────────────────────────────────────────────── */}
        <section>
          <h2 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-4">
            Available Rewards
          </h2>

          {available.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm dark:shadow-none">
              <Zap size={32} className="text-zinc-700 mx-auto mb-3" />
              <p className="text-sm text-zinc-500">No rewards available right now</p>
              <p className="text-xs text-zinc-600 mt-1">Check back soon for new offers</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {available.map((reward) => (
                <RewardCard
                  key={reward.id}
                  reward={reward}
                  balance={balance}
                  onUnlock={handleUnlock}
                  unlocking={unlocking}
                />
              ))}
            </div>
          )}
        </section>

        {/* Used rewards (collapsed by default) */}
        {used.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-4">
              Used Rewards
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {used.map((reward) => (
                <RewardCard
                  key={reward.id}
                  reward={reward}
                  balance={balance}
                  onUnlock={handleUnlock}
                  unlocking={unlocking}
                />
              ))}
            </div>
          </section>
        )}

        {/* ── Transaction history ────────────────────────────────────────────── */}
        <section>
          <button
            onClick={() => setHistOpen((v) => !v)}
            className="w-full flex items-center justify-between py-3 group active:scale-[0.98] transition-transform"
          >
            <h2 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest group-hover:text-zinc-300 transition-colors">
              Points History
            </h2>
            {histOpen
              ? <ChevronUp size={14} className="text-zinc-500 group-hover:text-zinc-300 transition-colors" />
              : <ChevronDown size={14} className="text-zinc-500 group-hover:text-zinc-300 transition-colors" />}
          </button>

          {histOpen && (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm dark:shadow-none">
              {txns.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-sm text-zinc-500">No transactions yet</p>
                </div>
              ) : (
                <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {txns.map((tx) => {
                    const isEarn = tx.points > 0
                    return (
                      <li key={tx.id} className="flex items-center gap-3 px-4 py-3">
                        {/* Icon */}
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                          isEarn
                            ? 'bg-amber-500/15 text-amber-400'
                            : 'bg-red-500/15 text-red-400'
                        }`}>
                          {txIcon(tx.type)}
                        </div>

                        {/* Description */}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300 truncate">
                            {tx.note ?? (isEarn ? 'Points earned' : 'Points redeemed')}
                          </p>
                          <p className="text-[10px] text-zinc-600 mt-0.5">
                            {formatDate(tx.created_at)}
                          </p>
                        </div>

                        {/* Points */}
                        <span className={`shrink-0 text-sm font-semibold tabular-nums ${
                          isEarn ? 'text-amber-400' : 'text-red-400'
                        }`}>
                          {isEarn ? '+' : ''}{tx.points.toLocaleString()}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )}
        </section>

      </div>
    </div>
  )
}
