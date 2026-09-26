import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockGetUserPermissions, mockUpdate } = vi.hoisted(() => ({
  mockGetUserPermissions: vi.fn(),
  mockUpdate: vi.fn(),
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
      chain.eq = vi.fn(() => chain)
      chain.select = vi.fn(() => chain)
      chain.single = vi.fn(async () => ({ data: { id: 1 }, error: null }))
      return chain
    }),
  },
}))

import { PATCH } from './route'

const patchReq = (body: unknown) =>
  new NextRequest('http://localhost/api/admin/store-settings', { method: 'PATCH', body: JSON.stringify(body) })

beforeEach(() => {
  mockUpdate.mockReset()
  mockGetUserPermissions.mockResolvedValue({
    email: 'owner@chickentime.com', role: 'staff', permissions: ['StoreSettings'], isOwner: false,
  })
})

describe('PATCH /api/admin/store-settings VAT validation', () => {
  it('saves a valid VAT patch', async () => {
    const res = await PATCH(patchReq({ show_vat: true, vat_rate: 12.5 }))
    expect(res.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalledWith({ show_vat: true, vat_rate: 12.5 })
  })

  it('rejects a string vat_rate', async () => {
    const res = await PATCH(patchReq({ vat_rate: '20' }))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Invalid VAT setting' })
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('rejects a rate above 100', async () => {
    const res = await PATCH(patchReq({ vat_rate: 150 }))
    expect(res.status).toBe(400)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('rejects a non-boolean show_vat', async () => {
    const res = await PATCH(patchReq({ show_vat: 'yes' }))
    expect(res.status).toBe(400)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('passes other settings through unchanged', async () => {
    const res = await PATCH(patchReq({ prep_time_minutes: 25 }))
    expect(res.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalledWith({ prep_time_minutes: 25 })
  })
})
