// Shared by the checkout RewardPicker and POST /api/checkout so the client and
// the server never disagree about which rewards a cart can use, what a reward is
// worth, or which errors mean the current selection is dead.

export interface CheckoutReward {
  id:                string
  title:             string
  benefit:           string
  discount_type:     string
  discount_value:    number
  min_order_amount:  number
  points_cost:       number
  eligible:          boolean
  days_until_expiry: number | null
  expiring_soon:     boolean
}

// SQLSTATE codes raised by the redeem_reward RPC. Anything outside this map is
// an unexpected DB fault, not a rejected redemption, and is surfaced as a 500.
export const REWARD_ERRORS: Record<string, string> = {
  LY001: 'Reward not found',
  LY002: 'Reward is no longer available',
  LY003: 'Reward is not available yet',
  LY004: 'Reward has expired',
  LY005: 'Your tier does not unlock this reward',
  LY006: 'Not enough points for this reward',
  LY007: 'Reward already redeemed',
  LY008: 'Reward is misconfigured — please contact us',
}

// The reward-specific rejections POST /api/checkout raises outside the RPC.
// Prefixes, because two of them interpolate an amount.
const REWARD_REJECTION_PREFIXES = [
  'Sign in to redeem a reward',
  'A reward and a promo code cannot be used on the same order',
  'A bundle deal already applies to this cart',
  'This reward needs a minimum order of',
  'The free item for this reward is currently unavailable',
  'Failed to redeem reward',
  'Failed to add the free reward item',
]

/**
 * True when a failed checkout blames the reward rather than the rest of the
 * order, so the picker can drop a selection that went stale between page load
 * and submit instead of letting the customer resubmit it forever.
 */
export function isRewardRejection(message: string): boolean {
  return Object.values(REWARD_ERRORS).includes(message)
    || REWARD_REJECTION_PREFIXES.some((prefix) => message.startsWith(prefix))
}

/**
 * GET /api/rewards cannot filter on min_order_amount — it does not know the
 * cart — so the cart-dependent half of eligibility is applied here. The checkout
 * API re-checks it authoritatively; this only keeps unusable rewards off screen.
 */
export function selectableRewards<T extends { eligible: boolean; min_order_amount: number }>(
  rewards:  T[],
  subtotal: number,
): T[] {
  return rewards.filter((r) => r.eligible && r.min_order_amount <= subtotal)
}

/** Mirrors the pricing in POST /api/checkout. free_delivery and free_item carry no discount. */
export function rewardDiscountAmount(
  reward:   { discount_type: string; discount_value: number } | null,
  subtotal: number,
): number {
  if (!reward) return 0
  if (reward.discount_type === 'percentage') {
    return Math.round(subtotal * (reward.discount_value / 100) * 100) / 100
  }
  if (reward.discount_type === 'flat') {
    return Math.min(reward.discount_value, subtotal)
  }
  return 0
}
