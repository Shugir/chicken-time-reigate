import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Unlike admin-auth.test.ts, nothing here stubs getUserPermissions: these tests
// run the real session -> staff_permissions -> hasPermission chain, so they
// cover the case a signed-in customer hits an admin route.
const { mockGetUser, tableResults } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  tableResults: new Map<string, { data: unknown; error: unknown }>(),
}))

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({ getAll: () => [], set: () => {} })),
}))

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({ auth: { getUser: mockGetUser } })),
}))

vi.mock('@/lib/supabase-admin', () => {
  const makeChain = (result: { data: unknown; error: unknown }) => {
    const chain: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'order', 'insert', 'update', 'upsert', 'delete']) {
      chain[m] = vi.fn(() => chain)
    }
    chain.maybeSingle = vi.fn(async () => result)
    chain.single = vi.fn(async () => result)
    chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve)
    return chain
  }
  return {
    supabaseAdmin: {
      from: vi.fn((table: string) => makeChain(tableResults.get(table) ?? { data: [], error: null })),
    },
  }
})

import { POST as pointsPOST } from './users/[id]/points/route'

const signedInAs = (email: string) => mockGetUser.mockResolvedValue({ data: { user: { email } } })
const staffRowIs = (row: unknown) => tableResults.set('staff_permissions', { data: row, error: null })

const mintReq = () =>
  new NextRequest('http://localhost/api/admin/users/u1/points', {
    method: 'POST',
    body: JSON.stringify({ delta: 5000 }),
  })
const params = { params: Promise.resolve({ id: 'victim' }) }

beforeEach(() => {
  mockGetUser.mockReset()
  tableResults.clear()
  tableResults.set('profiles', { data: { loyalty_points: 0 }, error: null })
})

describe('POST /api/admin/users/[id]/points, full auth chain', () => {
  it('rejects an anonymous caller', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    expect((await pointsPOST(mintReq(), params)).status).toBe(403)
  })

  it('rejects a signed-in customer who has no staff_permissions row', async () => {
    signedInAs('customer@example.com')
    staffRowIs(null)

    expect((await pointsPOST(mintReq(), params)).status).toBe(403)
  })

  it('rejects staff whose permissions do not cover loyalty', async () => {
    signedInAs('kitchen@chickentime.com')
    staffRowIs({ role: 'staff', permissions: ['Kitchen', 'DispatchController'] })

    expect((await pointsPOST(mintReq(), params)).status).toBe(403)
  })

  it('allows staff holding Loyalty', async () => {
    signedInAs('loyalty@chickentime.com')
    staffRowIs({ role: 'staff', permissions: ['Loyalty'] })

    const res = await pointsPOST(mintReq(), params)

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, balance: 5000 })
  })

  it('allows an explicit owner record', async () => {
    signedInAs('owner@chickentime.com')
    staffRowIs({ role: 'owner', permissions: [] })

    expect((await pointsPOST(mintReq(), params)).status).toBe(200)
  })
})
