import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import type { UserPermissions } from '@/lib/get-user-permissions'

const { mockGetUserPermissions } = vi.hoisted(() => ({ mockGetUserPermissions: vi.fn() }))

// Real hasPermission, controlled identity: these tests exercise each route's
// own authorization decision, not session parsing.
vi.mock('@/lib/get-user-permissions', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/get-user-permissions')>()),
  getUserPermissions: mockGetUserPermissions,
}))

const tableResults = new Map<string, { data: unknown; error: unknown }>()

function makeChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'neq', 'is', 'not', 'gte', 'lte', 'ilike', 'order', 'limit', 'insert', 'update', 'upsert', 'delete']) {
    chain[m] = vi.fn(() => chain)
  }
  chain.maybeSingle = vi.fn(async () => result)
  chain.single = vi.fn(async () => result)
  chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve)
  return chain
}

vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: {
    from: vi.fn((table: string) => makeChain(tableResults.get(table) ?? { data: [], error: null })),
    auth: { admin: { listUsers: vi.fn(async () => ({ data: { users: [] }, error: null })) } },
  },
}))

import { POST as pointsPOST } from './users/[id]/points/route'
import { GET as loyaltyGET, POST as loyaltyPOST } from './loyalty/route'
import { GET as authUsersGET } from './auth-users/route'
import { GET as driversGET, POST as driversPOST } from './drivers/route'
import { GET as zonesGET, POST as zonesPOST } from './delivery-zones/route'
import { PATCH as settingsPATCH, GET as settingsGET } from './store-settings/route'
import { POST as menuItemsPOST } from './menu-items/route'
import { POST as categoriesPOST } from './categories/route'

const staffWith = (...permissions: string[]): UserPermissions =>
  ({ email: 'staff@chickentime.com', role: 'staff', permissions, isOwner: false })

const CUSTOMER = staffWith()

const req = (body: unknown = {}) =>
  new NextRequest('http://localhost/api/admin/x', { method: 'POST', body: JSON.stringify(body) })

const getReq = () => new NextRequest('http://localhost/api/admin/x')

const params = { params: Promise.resolve({ id: 'user-1' }) }

beforeEach(() => {
  mockGetUserPermissions.mockReset()
  tableResults.clear()
})

describe('point-minting routes reject unauthorized callers', () => {
  it('POST /api/admin/users/[id]/points is 403 with no session', async () => {
    mockGetUserPermissions.mockResolvedValue(null)
    const res = await pointsPOST(req({ delta: 5000 }), params)
    expect(res.status).toBe(403)
  })

  it('POST /api/admin/users/[id]/points is 403 for a signed-in customer', async () => {
    mockGetUserPermissions.mockResolvedValue(CUSTOMER)
    const res = await pointsPOST(req({ delta: 5000 }), params)
    expect(res.status).toBe(403)
  })

  it('POST /api/admin/users/[id]/points is 403 for staff holding an unrelated permission', async () => {
    mockGetUserPermissions.mockResolvedValue(staffWith('Kitchen'))
    const res = await pointsPOST(req({ delta: 5000 }), params)
    expect(res.status).toBe(403)
  })

  it('POST /api/admin/loyalty is 403 with no session', async () => {
    mockGetUserPermissions.mockResolvedValue(null)
    const res = await loyaltyPOST(req({ user_id: 'u1', points: 5000, type: 'admin_credit' }))
    expect(res.status).toBe(403)
  })

  it('POST /api/admin/loyalty is 403 for a signed-in customer', async () => {
    mockGetUserPermissions.mockResolvedValue(CUSTOMER)
    const res = await loyaltyPOST(req({ user_id: 'u1', points: 5000, type: 'admin_credit' }))
    expect(res.status).toBe(403)
  })
})

describe('point-minting routes still work for authorized staff', () => {
  it('POST /api/admin/users/[id]/points credits the balance for Loyalty staff', async () => {
    mockGetUserPermissions.mockResolvedValue(staffWith('Loyalty'))
    tableResults.set('profiles', { data: { loyalty_points: 10 }, error: null })

    const res = await pointsPOST(req({ delta: 5 }), params)

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, balance: 15 })
  })

  it('POST /api/admin/users/[id]/points also works for UserControl staff', async () => {
    mockGetUserPermissions.mockResolvedValue(staffWith('UserControl'))
    tableResults.set('profiles', { data: { loyalty_points: 0 }, error: null })

    const res = await pointsPOST(req({ delta: 3 }), params)

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, balance: 3 })
  })

  it('POST /api/admin/users/[id]/points works for the owner', async () => {
    mockGetUserPermissions.mockResolvedValue({ email: 'o@c.com', role: 'owner', permissions: [], isOwner: true })
    tableResults.set('profiles', { data: { loyalty_points: 2 }, error: null })

    const res = await pointsPOST(req({ delta: 1 }), params)

    expect(res.status).toBe(200)
  })

  it('POST /api/admin/loyalty records a transaction for Loyalty staff', async () => {
    mockGetUserPermissions.mockResolvedValue(staffWith('Loyalty'))
    tableResults.set('loyalty_transactions', { data: null, error: null })

    const res = await loyaltyPOST(req({ user_id: 'u1', points: 20, type: 'admin_credit' }))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true })
  })

  it('GET /api/admin/loyalty is readable by both Loyalty and UserControl staff', async () => {
    for (const permission of ['Loyalty', 'UserControl']) {
      mockGetUserPermissions.mockResolvedValue(staffWith(permission))
      const res = await loyaltyGET(getReq())
      expect(res.status).toBe(200)
    }
  })
})

describe('other previously open routes now require a permission', () => {
  const unauthorized = [
    ['GET  /api/admin/auth-users',     () => authUsersGET(getReq())],
    ['GET  /api/admin/drivers',        () => driversGET(getReq())],
    ['POST /api/admin/drivers',        () => driversPOST(req({ name: 'Mallory' }))],
    ['GET  /api/admin/delivery-zones', () => zonesGET(getReq())],
    ['POST /api/admin/delivery-zones', () => zonesPOST(req({ postcode_prefix: 'RH2' }))],
    ['PATCH /api/admin/store-settings', () => settingsPATCH(req({ is_open: false }))],
    ['POST /api/admin/menu-items',     () => menuItemsPOST(req({ name: 'x', price: 1, category: 'y' }))],
    ['POST /api/admin/categories',     () => categoriesPOST(req({ name: 'x', slug: 'y' }))],
  ] as const

  for (const [label, call] of unauthorized) {
    it(`${label} is 403 with no session`, async () => {
      mockGetUserPermissions.mockResolvedValue(null)
      expect((await call()).status).toBe(403)
    })

    it(`${label} is 403 for a signed-in customer`, async () => {
      mockGetUserPermissions.mockResolvedValue(CUSTOMER)
      expect((await call()).status).toBe(403)
    })
  }

  const authorized = [
    ['GET  /api/admin/auth-users',      'UserControl',   () => authUsersGET(getReq())],
    ['GET  /api/admin/drivers',         'Fleet',         () => driversGET(getReq())],
    ['GET  /api/admin/drivers',         'Receipts',      () => driversGET(getReq())],
    ['POST /api/admin/drivers',         'Fleet',         () => driversPOST(req({ name: 'Sam' }))],
    ['GET  /api/admin/delivery-zones',  'DeliveryZones', () => zonesGET(getReq())],
    ['PATCH /api/admin/store-settings', 'StoreSettings', () => settingsPATCH(req({ is_open: false }))],
    ['POST /api/admin/menu-items',      'MenuManager',   () => menuItemsPOST(req({ name: 'x', price: 1, category: 'y' }))],
    ['POST /api/admin/categories',      'Categories',    () => categoriesPOST(req({ name: 'x', slug: 'y' }))],
  ] as const

  for (const [label, permission, call] of authorized) {
    it(`${label} is allowed for ${permission} staff`, async () => {
      mockGetUserPermissions.mockResolvedValue(staffWith(permission))
      expect((await call()).status).not.toBe(403)
    })
  }
})

describe('store settings stay readable without a session', () => {
  it('GET /api/admin/store-settings is public for the storefront header', async () => {
    mockGetUserPermissions.mockResolvedValue(null)
    tableResults.set('store_settings', { data: { is_open: true }, error: null })

    const res = await settingsGET()

    expect(res.status).toBe(200)
    expect(mockGetUserPermissions).not.toHaveBeenCalled()
  })
})
