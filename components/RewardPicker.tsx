'use client'

import { useEffect, useState } from 'react'
import { AlertCircle, Clock, Gift, Star } from 'lucide-react'
import { selectableRewards, type CheckoutReward } from '@/lib/reward-checkout'

interface RewardPickerProps {
  subtotal:         number
  /** A deals-engine discount already applies — the checkout API refuses a reward on top. */
  dealsBlocked:     boolean
  selectedRewardId: string | null
  onSelect:         (reward: CheckoutReward | null) => void
}

function expiryLabel(days: number): string {
  if (days <= 0) return 'Expires today'
  if (days === 1) return 'Expires tomorrow'
  return `Expires in ${days} days`
}

export default function RewardPicker({ subtotal, dealsBlocked, selectedRewardId, onSelect }: RewardPickerProps) {
  const [rewards, setRewards]             = useState<CheckoutReward[] | null>(null)
  const [authenticated, setAuthenticated] = useState(false)

  useEffect(() => {
    fetch('/api/rewards')
      .then((r) => r.json())
      .then((d) => {
        setAuthenticated(Boolean(d.authenticated))
        setRewards(d.rewards ?? [])
      })
      .catch(() => setRewards([]))
  }, [])

  const available = rewards ? selectableRewards(rewards, subtotal) : []

  // Guests and carts with nothing to spend points on get no card at all, matching
  // how the retired points slider stayed out of the way when it had no offer.
  if (!authenticated || available.length === 0) return null

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
      <h2 className="font-heading font-bold text-base text-brand-dark flex items-center gap-2">
        <Gift size={16} className="text-brand-red" />
        Use a Reward
      </h2>

      {dealsBlocked ? (
        <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 rounded-xl px-3 py-2.5">
          <AlertCircle size={14} className="mt-0.5 shrink-0 text-amber-500" />
          A bundle deal already applies to this order. Rewards can&apos;t be combined with deals — change your items to use one.
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {available.map((reward) => {
              const selected = reward.id === selectedRewardId
              return (
                <button
                  key={reward.id}
                  type="button"
                  onClick={() => onSelect(selected ? null : reward)}
                  className={`w-full text-left rounded-xl border-2 px-4 py-3 transition-colors ${
                    selected
                      ? 'border-brand-red bg-red-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 leading-tight">{reward.title}</p>
                      {reward.benefit !== reward.title && (
                        <p className="text-xs text-gray-500 mt-0.5">{reward.benefit}</p>
                      )}
                      {reward.expiring_soon && reward.days_until_expiry !== null && (
                        <p className="flex items-center gap-1 text-[10px] font-medium text-red-600 mt-1">
                          <Clock size={10} />
                          {expiryLabel(reward.days_until_expiry)}
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600">
                      <Star size={10} />
                      {reward.points_cost.toLocaleString()} pts
                    </span>
                  </div>
                  {selected && (
                    <p className="text-xs font-semibold text-brand-red mt-2">✓ Applied — tap again to remove</p>
                  )}
                </button>
              )
            })}
          </div>

          {selectedRewardId && (
            <p className="text-xs text-gray-500">
              Your points are spent when you continue to payment. A reward can&apos;t be combined with a promo code.
            </p>
          )}
        </>
      )}
    </div>
  )
}
