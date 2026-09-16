import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const USER_ID = 'user-1'
const POINTS_COST = 100

// Mirrors profiles.loyalty_points. The rpc mock below decrements it the way the
// redeem_loyalty_points UPDATE does: the balance condition and the write are one
// indivisible step, with no await between them.
let balance = 0
const unlocked = new Set<string>()

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: { getUser: async () => ({ data: { user: { id: USER_ID } } }) },
  })),
}))

vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: {
    from(table: string) {
      const filters: Record<string, unknown> = {}
      const builder = {
        select: () => builder,
        eq: (column: string, value: unknown) => { filters[column] = value; return builder },
        async maybeSingle() {
          if (table === 'promotions') {
            return { data: { id: filters.id, promo_type: 'REWARD', points_cost: POINTS_COST, is_active: true } }
          }
          if (table === 'unlocked_rewards') {
            return { data: unlocked.has(String(filters.promotion_id)) ? { id: 'row' } : null }
          }
          if (table === 'profiles') return { data: { loyalty_points: balance } }
          return { data: null }
        },
        async insert(row: Record<string, unknown>) {
          // Forces a scheduling boundary so a second in-flight request can run
          // between the redemption and the unlock write.
          await Promise.resolve()
          if (table === 'unlocked_rewards') unlocked.add(String(row.promotion_id))
          return { error: null }
        },
      }
      return builder
    },
    async rpc(fn: string, args: { uid: string; cost?: number; delta?: number }) {
      if (fn === 'redeem_loyalty_points') {
        if (balance < args.cost!) return { data: null, error: null }
        balance -= args.cost!
        return { data: balance, error: null }
      }
      // adjust_loyalty clamps instead of rejecting — the behaviour the redeem
      // path must no longer rely on.
      if (fn === 'adjust_loyalty') {
        balance = Math.max(0, balance + args.delta!)
        return { data: null, error: null }
      }
      throw new Error(`unexpected rpc: ${fn}`)
    },
  },
}))

import { POST } from './route'

const unlockRequest = (promotionId: string) =>
  new NextRequest('http://localhost/api/rewards/unlock', {
    method: 'POST',
    body: JSON.stringify({ promotion_id: promotionId }),
  })

describe('POST /api/rewards/unlock', () => {
  beforeEach(() => {
    balance = POINTS_COST
    unlocked.clear()
  })

  it('deducts the cost and returns the new balance', async () => {
    const res = await POST(unlockRequest('promo-a'))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true, new_balance: 0 })
    expect(balance).toBe(0)
  })

  it('rejects a redemption the balance cannot cover', async () => {
    balance = POINTS_COST - 1

    const res = await POST(unlockRequest('promo-a'))

    expect(res.status).toBe(422)
    expect(balance).toBe(POINTS_COST - 1)
  })

  it('lets only one of two concurrent redemptions spend a single balance', async () => {
    const [first, second] = await Promise.all([
      POST(unlockRequest('promo-a')),
      POST(unlockRequest('promo-b')),
    ])

    const statuses = [first.status, second.status].sort()
    expect(statuses).toEqual([200, 422])
    expect(balance).toBe(0)
    expect(unlocked.size).toBe(1)
  })
})
