import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const USER_ID = 'user-1'

interface RewardRow {
  id:               string
  discount_type:    string
  discount_value:   number
  min_order_amount: number
  points_cost:      number
  reward_config:    Record<string, unknown>
}

// --- mutable fixture state, reset per test ---
let balance = 0
let rewards: Record<string, RewardRow> = {}
let promoCodes: Record<string, { discount_type: string; discount_value: number; min_order_amount: number }> = {}
let redeemedRewardIds: Set<string>
let rewardFailureCode: string | null = null
let orderRows: Set<string>
let insertedOrder: Record<string, unknown> | null = null
let insertedOrderItems: Record<string, unknown>[]
let menuItems: Record<string, { id: string; name: string; is_available: boolean }> = {}
let orderUpdates: Record<string, unknown>[]
let loyaltyTxns: Record<string, unknown>[]
let stripeSessionCreated = false

let orderSeq = 0

vi.mock('stripe', () => ({
  default: class {
    coupons = { create: async () => ({ id: 'coupon_1' }) }
    checkout = {
      sessions: {
        create: async () => {
          stripeSessionCreated = true
          return { id: 'cs_1', url: 'https://stripe.test/cs_1' }
        },
      },
    }
  },
}))

vi.mock('@/lib/email', () => ({ sendOrderStatusEmail: vi.fn() }))

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: { getUser: async () => ({ data: { user: { id: USER_ID, email: 'a@b.test' } } }) },
  })),
}))

vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: {
    from(table: string) {
      const filters: Record<string, unknown> = {}
      let op: 'select' | 'insert' | 'update' | 'delete' = 'select'
      let payload: unknown

      const rows = (): unknown[] => {
        if (table === 'deals' || table === 'menu_items') return []
        return []
      }

      const one = () => {
        if (table === 'store_settings') {
          return { data: { is_accepting_orders: true, business_hours: null, holidays: null }, error: null }
        }
        if (table === 'profiles') return { data: { loyalty_points: balance }, error: null }
        if (table === 'menu_items') return { data: menuItems[String(filters.id)] ?? null, error: null }
        if (table === 'promotions') {
          if (filters.promo_type === 'REWARD') {
            return { data: rewards[String(filters.id)] ?? null, error: null }
          }
          return { data: promoCodes[String(filters.code)] ?? null, error: null }
        }
        if (table === 'orders' && op === 'insert') {
          const id = `order-${++orderSeq}`
          orderRows.add(id)
          insertedOrder = payload as Record<string, unknown>
          return { data: { id }, error: null }
        }
        return { data: null, error: null }
      }

      const builder = {
        select: () => builder,
        eq: (column: string, value: unknown) => { filters[column] = value; return builder },
        in: () => builder,
        insert: (row: unknown) => { op = 'insert'; payload = row; return builder },
        update: (row: unknown) => { op = 'update'; payload = row; return builder },
        delete: () => { op = 'delete'; return builder },
        single: async () => one(),
        maybeSingle: async () => one(),
        then: (resolve: (r: { data: unknown; error: null }) => unknown) => {
          if (op === 'delete' && table === 'orders') orderRows.delete(String(filters.id))
          if (op === 'update' && table === 'orders') orderUpdates.push(payload as Record<string, unknown>)
          if (op === 'insert' && table === 'loyalty_transactions') loyaltyTxns.push(payload as Record<string, unknown>)
          if (op === 'insert' && table === 'order_items') {
            const rows = (Array.isArray(payload) ? payload : [payload]) as Record<string, unknown>[]
            insertedOrderItems.push(...rows)
          }
          return Promise.resolve(resolve({ data: op === 'select' ? rows() : null, error: null }))
        },
      }
      return builder
    },

    // Lazy like the real PostgrestBuilder: the side effect only runs once the
    // chain is consumed, so an un-awaited .rpc() leaves state untouched and
    // fails the test rather than passing on an eager mock.
    rpc(fn: string, args: Record<string, unknown>) {
      const run = () => {
        if (fn === 'adjust_loyalty') {
          balance = Math.max(0, balance + (args.delta as number))
          return { data: null, error: null }
        }
        if (fn !== 'redeem_reward') throw new Error(`unexpected rpc: ${fn}`)
        if (rewardFailureCode) {
          return { data: null, error: { code: rewardFailureCode, message: 'rejected' } }
        }
        const promoId = String(args.p_promotion_id)
        const reward = rewards[promoId]
        if (!reward) return { data: null, error: { code: 'LY001', message: 'Reward not found' } }
        if (redeemedRewardIds.has(promoId)) {
          return { data: null, error: { code: 'LY007', message: 'Reward already redeemed' } }
        }
        if (balance < reward.points_cost) {
          return { data: null, error: { code: 'LY006', message: 'Not enough points' } }
        }
        balance -= reward.points_cost
        redeemedRewardIds.add(promoId)
        return {
          data: {
            promotion_id:     reward.id,
            code:             'REWARD',
            discount_type:    reward.discount_type,
            discount_value:   reward.discount_value,
            min_order_amount: reward.min_order_amount,
            reward_config:    reward.reward_config,
            points_spent:     reward.points_cost,
            new_balance:      balance,
          },
          error: null,
        }
      }
      return {
        then: (resolve: (r: { data: unknown; error: unknown }) => unknown) =>
          Promise.resolve(resolve(run())),
      }
    },
  },
}))

import { POST } from './route'

const CART = [{
  menu_item_id: undefined,
  name: 'Wings', price: 10, quantity: 2, totalPrice: 20, extras: [], removals: [],
}]

const checkoutRequest = (body: Record<string, unknown>) =>
  new NextRequest('http://localhost/api/checkout', {
    method: 'POST',
    body: JSON.stringify({ items: CART, delivery_fee: 3, ...body }),
  })

const makeReward = (over: Partial<RewardRow> = {}): RewardRow => ({
  id: 'reward-1',
  discount_type: 'free_delivery',
  discount_value: 0,
  min_order_amount: 0,
  points_cost: 500,
  reward_config: {},
  ...over,
})

describe('POST /api/checkout — reward redemption', () => {
  beforeEach(() => {
    balance = 1000
    rewards = { 'reward-1': makeReward() }
    promoCodes = { SAVE5: { discount_type: 'flat', discount_value: 5, min_order_amount: 0 } }
    redeemedRewardIds = new Set()
    rewardFailureCode = null
    orderRows = new Set()
    insertedOrder = null
    insertedOrderItems = []
    menuItems = { 'menu-9': { id: 'menu-9', name: 'Free Wings', is_available: true } }
    orderUpdates = []
    loyaltyTxns = []
    stripeSessionCreated = false
  })

  it('zeroes the delivery fee for a free_delivery reward', async () => {
    const res = await POST(checkoutRequest({ reward_promotion_id: 'reward-1' }))

    expect(res.status).toBe(200)
    expect(insertedOrder!.total_amount).toBe(20)  // subtotal 20, delivery 3 waived
    expect(balance).toBe(700)  // 1000 - 500 reward cost + 200 earned
    expect(stripeSessionCreated).toBe(true)
  })

  it('applies a percentage reward against the subtotal', async () => {
    rewards['reward-1'] = makeReward({ discount_type: 'percentage', discount_value: 25 })

    const res = await POST(checkoutRequest({ reward_promotion_id: 'reward-1' }))

    expect(res.status).toBe(200)
    expect(insertedOrder!.total_amount).toBe(18)  // 20 - 5 + 3 delivery
  })

  it('applies a flat reward capped at the subtotal', async () => {
    rewards['reward-1'] = makeReward({ discount_type: 'flat', discount_value: 100 })

    const res = await POST(checkoutRequest({ reward_promotion_id: 'reward-1' }))

    expect(res.status).toBe(200)
    expect(insertedOrder!.total_amount).toBe(3)  // discount capped at 20, delivery still charged
  })

  it('accepts a free_item reward without discounting the total', async () => {
    rewards['reward-1'] = makeReward({
      discount_type: 'free_item',
      reward_config: { menu_item_id: 'menu-9' },
    })

    const res = await POST(checkoutRequest({ reward_promotion_id: 'reward-1' }))

    expect(res.status).toBe(200)
    expect(insertedOrder!.total_amount).toBe(23)
    expect(redeemedRewardIds.has('reward-1')).toBe(true)
    expect(insertedOrderItems).toContainEqual(
      expect.objectContaining({
        menu_item_id: 'menu-9',
        item_name:    'Free Wings',
        quantity:     1,
        unit_price:   0,
        notes:        'Free reward item',
      }),
    )
  })

  it('rejects a free_item reward whose menu item is unavailable', async () => {
    menuItems['menu-9'].is_available = false
    rewards['reward-1'] = makeReward({
      discount_type: 'free_item',
      reward_config: { menu_item_id: 'menu-9' },
    })

    const res = await POST(checkoutRequest({ reward_promotion_id: 'reward-1' }))

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({
      error: 'The free item for this reward is currently unavailable',
    })
    expect(balance).toBe(1000)
    expect(orderRows.size).toBe(0)
    expect(stripeSessionCreated).toBe(false)
  })

  it('rejects a free_item reward whose menu item no longer exists', async () => {
    rewards['reward-1'] = makeReward({
      discount_type: 'free_item',
      reward_config: { menu_item_id: 'deleted-item' },
    })

    const res = await POST(checkoutRequest({ reward_promotion_id: 'reward-1' }))

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({
      error: 'The free item for this reward is currently unavailable',
    })
    expect(balance).toBe(1000)
    expect(orderRows.size).toBe(0)
  })

  it('rejects a free_item reward with no menu item configured', async () => {
    rewards['reward-1'] = makeReward({ discount_type: 'free_item', reward_config: {} })

    const res = await POST(checkoutRequest({ reward_promotion_id: 'reward-1' }))

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Reward is misconfigured — please contact us' })
    expect(balance).toBe(1000)
    expect(orderRows.size).toBe(0)
  })

  it('rejects a reward combined with a promo code', async () => {
    const res = await POST(checkoutRequest({ reward_promotion_id: 'reward-1', promo_code: 'SAVE5' }))

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({
      error: 'A reward and a promo code cannot be used on the same order',
    })
    expect(balance).toBe(1000)
    expect(orderRows.size).toBe(0)
  })

  it('records the reward point spend on the order row', async () => {
    const res = await POST(checkoutRequest({ reward_promotion_id: 'reward-1' }))

    expect(res.status).toBe(200)
    expect(orderUpdates).toContainEqual({ points_earned: 200, points_redeemed: 500 })
  })

  it('rejects a reward when the cart is below its minimum order amount', async () => {
    rewards['reward-1'] = makeReward({ min_order_amount: 25 })

    const res = await POST(checkoutRequest({ reward_promotion_id: 'reward-1' }))

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'This reward needs a minimum order of £25.00' })
    expect(balance).toBe(1000)
    expect(orderRows.size).toBe(0)
  })

  it('rejects an unknown reward before creating an order', async () => {
    const res = await POST(checkoutRequest({ reward_promotion_id: 'nope' }))

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Reward not found' })
    expect(orderRows.size).toBe(0)
  })

  it.each([
    ['LY002', 'Reward is no longer available'],
    ['LY003', 'Reward is not available yet'],
    ['LY004', 'Reward has expired'],
    ['LY005', 'Your tier does not unlock this reward'],
    ['LY006', 'Not enough points for this reward'],
    ['LY007', 'Reward already redeemed'],
    ['LY008', 'Reward is misconfigured — please contact us'],
  ])('maps %s to its own message and deletes the order', async (code, message) => {
    rewardFailureCode = code

    const res = await POST(checkoutRequest({ reward_promotion_id: 'reward-1' }))

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: message })
    expect(orderRows.size).toBe(0)
    expect(balance).toBe(1000)
    expect(stripeSessionCreated).toBe(false)
  })

  it('surfaces an unrecognised RPC fault as a 500 and still deletes the order', async () => {
    rewardFailureCode = '23505'

    const res = await POST(checkoutRequest({ reward_promotion_id: 'reward-1' }))

    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'Failed to redeem reward' })
    expect(orderRows.size).toBe(0)
  })

  it('leaves the order in place when the reward succeeds', async () => {
    const res = await POST(checkoutRequest({ reward_promotion_id: 'reward-1' }))

    expect(res.status).toBe(200)
    expect(orderRows.size).toBe(1)
  })
})

describe('POST /api/checkout — orders without a reward', () => {
  beforeEach(() => {
    balance = 1000
    rewards = { 'reward-1': makeReward() }
    promoCodes = { SAVE5: { discount_type: 'flat', discount_value: 5, min_order_amount: 0 } }
    redeemedRewardIds = new Set()
    rewardFailureCode = null
    orderRows = new Set()
    insertedOrder = null
    insertedOrderItems = []
    menuItems = { 'menu-9': { id: 'menu-9', name: 'Free Wings', is_available: true } }
    orderUpdates = []
    loyaltyTxns = []
    stripeSessionCreated = false
  })

  it('still applies a promo code and charges the full delivery fee', async () => {
    const res = await POST(checkoutRequest({ promo_code: 'SAVE5' }))

    expect(res.status).toBe(200)
    expect(insertedOrder!.total_amount).toBe(18)  // 20 - 5 + 3
    expect(insertedOrder!.discount_applied).toBe(5)
  })

  it('records zero points redeemed on the order row', async () => {
    const res = await POST(checkoutRequest({}))

    expect(res.status).toBe(200)
    expect(orderUpdates).toContainEqual({ points_earned: 200, points_redeemed: 0 })
  })

  it('credits the balance and writes an earn transaction', async () => {
    const res = await POST(checkoutRequest({}))

    expect(res.status).toBe(200)
    expect(balance).toBe(1200)
    expect(loyaltyTxns).toContainEqual(
      expect.objectContaining({ user_id: USER_ID, points: 200, type: 'earn' }),
    )
  })
})
