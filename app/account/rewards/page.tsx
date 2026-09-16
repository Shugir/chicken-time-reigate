'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase-browser'
import {
  ArrowLeft, Star, ChevronDown, ChevronUp, Clock,
  Crown, Gift, Lock, TrendingUp,
} from 'lucide-react'
import Link from 'next/link'
import { ThemeToggle } from '@/components/ThemeToggle'

// ─── Types (mirror GET /api/rewards) ──────────────────────────────────────────

type RewardStatus = 'eligible' | 'redeemed' | 'tier_locked' | 'unaffordable'

interface Tier {
  id:         string
  name:       string
  threshold:  number
  multiplier: number
  sort_order: number
}

interface Reward {
  id:                string
  title:             string
  benefit:           string
  min_order_amount:  number
  points_cost:       number
  min_tier:          { id: string; name: string; sort_order: number } | null
  end_date:          string | null
  status:            RewardStatus
  points_needed:     number
  days_until_expiry: number | null
  expiring_soon:     boolean
}

interface Transaction {
  id:         string
  points:     number
  type:       string
  note:       string | null
  created_at: string
}

interface Wallet {
  balance:                number
  lifetime_points_earned: number
  tier:                   Tier | null
  next_tier:              Tier | null
  points_to_next_tier:    number | null
  tier_progress_pct:      number
  rewards:                Reward[]
  transactions:           Transaction[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function expiryLabel(days: number): string {
  if (days <= 0) return 'Expires today'
  if (days === 1) return 'Expires tomorrow'
  return `Expires in ${days} days`
}

const TXN_LABELS: Record<string, string> = {
  earn:          'Points earned',
  redeem:        'Points redeemed',
  reward_redeem: 'Reward redeemed',
  admin_credit:  'Adjustment (credit)',
  admin_debit:   'Adjustment (debit)',
}

function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`bg-zinc-200 dark:bg-zinc-800 animate-pulse rounded-3xl ${className ?? ''}`} />
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 text-brand-dark dark:text-white">
      <div className="sticky top-0 z-10 bg-white/90 dark:bg-zinc-950/90 backdrop-blur border-b border-zinc-200 dark:border-zinc-900">
        <div className="max-w-lg mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/account" className="text-zinc-500 hover:text-brand-dark dark:hover:text-white transition-colors">
              <ArrowLeft size={18} />
            </Link>
            <p className="text-sm font-semibold">My Wallet</p>
          </div>
          <ThemeToggle />
        </div>
      </div>
      {children}
    </div>
  )
}

// ─── RewardCard ───────────────────────────────────────────────────────────────

function RewardCard({ reward, balance }: { reward: Reward; balance: number }) {
  const locked = reward.status === 'tier_locked'

  // A codeless promotion titles itself with its benefit — don't print it twice.
  const subtitle = [
    reward.benefit === reward.title ? null : reward.benefit,
    reward.min_order_amount > 0 ? `min £${reward.min_order_amount.toFixed(2)}` : null,
  ].filter(Boolean).join(' · ')

  return (
    <div className={`bg-white dark:bg-zinc-900 border rounded-3xl shadow-sm dark:shadow-none p-5 flex flex-col gap-3 ${
      reward.status === 'eligible'
        ? 'border-amber-500/60'
        : reward.status === 'redeemed'
          ? 'border-zinc-200 dark:border-zinc-800 opacity-60'
          : 'border-zinc-200 dark:border-zinc-800'
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-brand-dark dark:text-white leading-tight">
            {reward.title}
          </h3>
          {subtitle && (
            <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">{subtitle}</p>
          )}
        </div>

        <span className={`shrink-0 flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
          reward.status === 'eligible'
            ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
            : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
        }`}>
          {locked ? <Lock size={10} /> : <Star size={10} />}
          {reward.points_cost.toLocaleString()} pts
        </span>
      </div>

      {reward.status === 'eligible' && (
        <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
          Ready to use — apply it at checkout.
        </p>
      )}

      {reward.status === 'redeemed' && (
        <p className="text-xs text-zinc-500">Already redeemed</p>
      )}

      {locked && (
        <p className="text-xs text-zinc-500">
          Requires <span className="font-medium text-zinc-700 dark:text-zinc-300">{reward.min_tier?.name}</span> tier
          {reward.points_needed > 0 && ` · ${reward.points_needed.toLocaleString()} more points`}
        </p>
      )}

      {reward.status === 'unaffordable' && (
        <div className="space-y-1.5">
          <div className="w-full bg-zinc-200 dark:bg-zinc-800 rounded-full h-1.5 overflow-hidden">
            <div
              className="h-full bg-amber-500/50 rounded-full transition-all"
              style={{ width: `${Math.min(100, (balance / reward.points_cost) * 100)}%` }}
            />
          </div>
          <p className="text-[10px] text-zinc-500 text-right">
            Need {reward.points_needed.toLocaleString()} more points
          </p>
        </div>
      )}

      {reward.expiring_soon && reward.days_until_expiry !== null && (
        <p className="flex items-center gap-1 text-[10px] font-medium text-red-600 dark:text-red-400">
          <Clock size={10} />
          {expiryLabel(reward.days_until_expiry)}
        </p>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WalletPage() {
  const [authed, setAuthed] = useState<boolean | null>(null)
  const [wallet, setWallet] = useState<Wallet | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        setAuthed(false)
        return
      }
      setAuthed(true)
      const res = await fetch('/api/rewards')
      if (res.ok) setWallet(await res.json())
      else setWallet({
        balance: 0, lifetime_points_earned: 0, tier: null, next_tier: null,
        points_to_next_tier: null, tier_progress_pct: 0, rewards: [], transactions: [],
      })
    })
  }, [])

  const [histOpen, setHistOpen] = useState(false)

  if (authed === false) {
    return (
      <Shell>
        <div className="max-w-lg mx-auto px-4 py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
            <Star className="w-8 h-8 text-amber-400" />
          </div>
          <h2 className="text-lg font-semibold mb-2">Sign in to view your wallet</h2>
          <p className="text-sm text-zinc-500 mb-6">
            Earn points with every order and unlock exclusive rewards.
          </p>
          <Link
            href="/sign-in"
            className="inline-flex items-center gap-2 bg-brand-red hover:bg-brand-red/90 text-white font-semibold
                       rounded-xl px-6 py-3 text-sm transition-colors active:scale-[0.98]"
          >
            Sign In
          </Link>
        </div>
      </Shell>
    )
  }

  if (!wallet) {
    return (
      <Shell>
        <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      </Shell>
    )
  }

  const expiring  = wallet.rewards.filter((r) => r.expiring_soon)
  const available = wallet.rewards.filter((r) => r.status !== 'redeemed')
  const redeemed  = wallet.rewards.filter((r) => r.status === 'redeemed')

  return (
    <Shell>
      <div className="max-w-lg mx-auto px-4 py-6 space-y-8">

        {/* Balance + tier progress */}
        <div className="bg-gradient-to-br from-white via-white to-zinc-50 dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-sm dark:shadow-none p-6">
          <div className="flex items-start justify-between mb-5">
            <div>
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-widest mb-2">
                Points Balance
              </p>
              <p className="text-5xl font-bold text-amber-600 dark:text-amber-400 leading-none">
                {wallet.balance.toLocaleString()}
              </p>
              <p className="text-xs text-zinc-500 mt-2">
                {wallet.lifetime_points_earned.toLocaleString()} earned all time
              </p>
            </div>

            {wallet.tier ? (
              <span className="shrink-0 flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
                <Crown size={12} />
                {wallet.tier.name}
              </span>
            ) : (
              <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                <TrendingUp className="w-6 h-6 text-amber-400" />
              </div>
            )}
          </div>

          {wallet.next_tier ? (
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <p className="text-[10px] text-zinc-500">
                  {wallet.points_to_next_tier?.toLocaleString()} points to {wallet.next_tier.name}
                </p>
                <p className="text-[10px] text-zinc-500">
                  {wallet.lifetime_points_earned.toLocaleString()} / {wallet.next_tier.threshold.toLocaleString()}
                </p>
              </div>
              <div className="w-full bg-zinc-200 dark:bg-zinc-800 rounded-full h-2 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full transition-all duration-500"
                  style={{ width: `${wallet.tier_progress_pct}%` }}
                />
              </div>
              <p className="text-[10px] text-zinc-500 pt-1">
                {wallet.next_tier.name} earns {Number(wallet.next_tier.multiplier)}× points per £1
              </p>
            </div>
          ) : (
            <p className="text-[10px] text-zinc-500">
              {wallet.tier
                ? `You're at ${wallet.tier.name} — our highest tier. Nice work.`
                : 'Start ordering to earn points and climb the tiers.'}
            </p>
          )}
        </div>

        {/* Expiring soon */}
        {expiring.length > 0 && (
          <div className="flex items-start gap-3 bg-red-500/5 border border-red-500/30 rounded-2xl px-4 py-3">
            <Clock size={16} className="text-red-500 shrink-0 mt-0.5" />
            <p className="text-xs text-red-600 dark:text-red-400">
              <span className="font-semibold">
                {expiring.length === 1
                  ? `${expiring[0].title} expires soon.`
                  : `${expiring.length} of your rewards expire soon.`}
              </span>{' '}
              Use {expiring.length === 1 ? 'it' : 'them'} at checkout before {
                expiring.length === 1 && expiring[0].end_date
                  ? formatDate(expiring[0].end_date)
                  : 'they run out'
              }.
            </p>
          </div>
        )}

        {/* Rewards catalog */}
        <section>
          <h2 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-4">
            Rewards Catalog
          </h2>

          {available.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-sm dark:shadow-none">
              <Gift size={32} className="text-zinc-400 dark:text-zinc-700 mx-auto mb-3" />
              <p className="text-sm text-zinc-500">No rewards available right now</p>
              <p className="text-xs text-zinc-400 dark:text-zinc-600 mt-1">Check back soon for new offers</p>
            </div>
          ) : (
            <div className="space-y-3">
              {available.map((r) => (
                <RewardCard key={r.id} reward={r} balance={wallet.balance} />
              ))}
            </div>
          )}
        </section>

        {redeemed.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-4">
              Redeemed
            </h2>
            <div className="space-y-3">
              {redeemed.map((r) => (
                <RewardCard key={r.id} reward={r} balance={wallet.balance} />
              ))}
            </div>
          </section>
        )}

        {/* Points history */}
        <section>
          <button
            onClick={() => setHistOpen((v) => !v)}
            className="w-full flex items-center justify-between py-3 group active:scale-[0.98] transition-transform"
          >
            <h2 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest group-hover:text-brand-dark dark:group-hover:text-zinc-300 transition-colors">
              Points History
            </h2>
            {histOpen
              ? <ChevronUp size={14} className="text-zinc-500" />
              : <ChevronDown size={14} className="text-zinc-500" />}
          </button>

          {histOpen && (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl overflow-hidden shadow-sm dark:shadow-none">
              {wallet.transactions.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-sm text-zinc-500">No transactions yet</p>
                </div>
              ) : (
                <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {wallet.transactions.map((tx) => {
                    const isEarn = tx.points > 0
                    return (
                      <li key={tx.id} className="flex items-center gap-3 px-4 py-3">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                          isEarn
                            ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                            : 'bg-red-500/15 text-red-600 dark:text-red-400'
                        }`}>
                          {isEarn ? '+' : '−'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300 truncate">
                            {tx.note ?? TXN_LABELS[tx.type] ?? 'Points adjustment'}
                          </p>
                          <p className="text-[10px] text-zinc-500 mt-0.5">
                            {TXN_LABELS[tx.type] ?? tx.type} · {formatDate(tx.created_at)}
                          </p>
                        </div>
                        <span className={`shrink-0 text-sm font-semibold tabular-nums ${
                          isEarn ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'
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
    </Shell>
  )
}
