import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockGetUserPermissions, mockUpdate, mockEq, result } = vi.hoisted(() => ({
  mockGetUserPermissions: vi.fn(),
  mockUpdate: vi.fn(),
  mockEq: vi.fn(),
  result: { current: { data: null as unknown, error: null as unknown } },
}))

vi.mock('@/lib/get-user-permissions', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/get-user-permissions')>()),
  getUserPermissions: mockGetUserPermissions,
}))

vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: {
    from: vi.fn(() => {
      const chain: Record<string, unknown> = {}
      chain.update = mockUpdate.mockImplementation(() => chain)
      chain.eq = mockEq.mockImplementation(() => chain)
      chain.select = vi.fn(() => chain)
      chain.single = vi.fn(async () => result.current)
      chain.maybeSingle = vi.fn(async () => result.current)
      return chain
    }),
  },
}))

import { GET, PATCH } from './route'

const ctx = { params: Promise.resolve({ id: 'item-1' }) }
const url = 'http://localhost/api/admin/menu-items/item-1'
const patchReq = (body: unknown) => new NextRequest(url, { method: 'PATCH', body: JSON.stringify(body) })
const MANAGER = { email: 'm@chickentime.com', role: 'staff', permissions: ['MenuManager'], isOwner: false }

beforeEach(() => {
  mockUpdate.mockReset()
  mockEq.mockReset()
  result.current = { data: { id: 'item-1', name: 'Wings' }, error: null }
  mockGetUserPermissions.mockResolvedValue(MANAGER)
})

describe('GET /api/admin/menu-items/[id]', () => {
  it('returns the item', async () => {
    const res = await GET(new NextRequest(url), ctx)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ id: 'item-1', name: 'Wings' })
    expect(mockEq).toHaveBeenCalledWith('id', 'item-1')
  })

  it('is 404 when the item does not exist', async () => {
    result.current = { data: null, error: null }
    const res = await GET(new NextRequest(url), ctx)
    expect(res.status).toBe(404)
  })

  it('is 403 without MenuManager', async () => {
    mockGetUserPermissions.mockResolvedValue({ ...MANAGER, permissions: ['Promotions'] })
    expect((await GET(new NextRequest(url), ctx)).status).toBe(403)
  })

  it('is 403 with no session', async () => {
    mockGetUserPermissions.mockResolvedValue(null)
    expect((await GET(new NextRequest(url), ctx)).status).toBe(403)
  })
})

describe('PATCH /api/admin/menu-items/[id]', () => {
  it('saves the availability toggle', async () => {
    const res = await PATCH(patchReq({ is_available: false }), ctx)
    expect(res.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalledWith({ is_available: false })
  })

  it('saves the inline price edit', async () => {
    await PATCH(patchReq({ price: 4.25 }), ctx)
    expect(mockUpdate).toHaveBeenCalledWith({ price: 4.25 })
  })

  it('drops unknown keys', async () => {
    await PATCH(patchReq({ price: 4.25, id: 'other' }), ctx)
    expect(mockUpdate).toHaveBeenCalledWith({ price: 4.25 })
  })

  it('rejects an invalid option list without saving', async () => {
    const res = await PATCH(patchReq({ drinks_regular: [{ name: ' ', price: 1 }] }), ctx)
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Drinks (Regular): every option needs a name' })
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('rejects invalid JSON', async () => {
    const res = await PATCH(new NextRequest(url, { method: 'PATCH', body: '{nope' }), ctx)
    expect(res.status).toBe(400)
    expect(mockUpdate).not.toHaveBeenCalled()
  })
})
