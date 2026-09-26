import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockGetUserPermissions, mockInsert } = vi.hoisted(() => ({
  mockGetUserPermissions: vi.fn(),
  mockInsert: vi.fn(),
}))

vi.mock('@/lib/get-user-permissions', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/get-user-permissions')>()),
  getUserPermissions: mockGetUserPermissions,
}))

vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: {
    from: vi.fn(() => {
      const chain: Record<string, unknown> = {}
      chain.insert = mockInsert.mockImplementation(() => chain)
      chain.select = vi.fn(() => chain)
      chain.single = vi.fn(async () => ({ data: { id: 'new' }, error: null }))
      return chain
    }),
  },
}))

import { POST } from './route'

const postReq = (body: unknown) =>
  new NextRequest('http://localhost/api/admin/menu-items', { method: 'POST', body: JSON.stringify(body) })

beforeEach(() => {
  mockInsert.mockReset()
  mockGetUserPermissions.mockResolvedValue({
    email: 'm@chickentime.com', role: 'staff', permissions: ['MenuManager'], isOwner: false,
  })
})

describe('POST /api/admin/menu-items', () => {
  it('keeps compare_at_price on create', async () => {
    const res = await POST(postReq({ name: 'Wings', price: 5, compare_at_price: 6.5, category: 'chicken' }))
    expect(res.status).toBe(201)
    expect(mockInsert.mock.calls[0][0]).toMatchObject({ name: 'Wings', price: 5, compare_at_price: 6.5 })
  })

  it('fills defaults for omitted fields', async () => {
    await POST(postReq({ name: 'Wings', price: 5, category: 'chicken' }))
    expect(mockInsert.mock.calls[0][0]).toMatchObject({
      description: null, image_url: null, is_available: true, additions: [], dips: [], allergens: [],
    })
    expect('modifier_select_modes' in mockInsert.mock.calls[0][0]).toBe(false)
  })

  it('rejects an invalid item without inserting', async () => {
    const res = await POST(postReq({ name: 'Wings', price: 0, category: 'chicken' }))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Price must be more than £0.00' })
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('rejects invalid JSON', async () => {
    const res = await POST(new NextRequest('http://localhost/api/admin/menu-items', { method: 'POST', body: '{nope' }))
    expect(res.status).toBe(400)
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('does not log the payload', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    await POST(postReq({ name: 'Wings', price: 5, category: 'chicken' }))
    expect(log).not.toHaveBeenCalled()
    log.mockRestore()
  })
})
