import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetUser = vi.fn()
const mockMaybeSingle = vi.fn()

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({ getAll: () => [] })),
}))

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
  })),
}))

vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({ maybeSingle: mockMaybeSingle })),
      })),
    })),
  },
}))

import { GET } from './route'

describe('GET /api/auth/role', () => {
  beforeEach(() => {
    mockGetUser.mockReset()
    mockMaybeSingle.mockReset()
  })

  it('reports not staff when there is no session', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const res = await GET()
    expect(await res.json()).toEqual({ isStaff: false })
  })

  it('reports not staff for a signed-in customer with no staff_permissions row', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { email: 'customer@example.com' } } })
    mockMaybeSingle.mockResolvedValue({ data: null })

    const res = await GET()
    expect(await res.json()).toEqual({ isStaff: false, isDriver: false })
  })

  it('reports staff, not driver, for a plain staff role', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { email: 'staff@chickentime.com' } } })
    mockMaybeSingle.mockResolvedValue({ data: { role: 'staff', permissions: [] } })

    const res = await GET()
    expect(await res.json()).toEqual({ isStaff: true, isDriver: false })
  })

  it('reports staff and driver for a driver role', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { email: 'driver@chickentime.com' } } })
    mockMaybeSingle.mockResolvedValue({ data: { role: 'driver', permissions: [] } })

    const res = await GET()
    expect(await res.json()).toEqual({ isStaff: true, isDriver: true })
  })

  it('reports staff and driver for a staff role carrying the Driver permission', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { email: 'staff@chickentime.com' } } })
    mockMaybeSingle.mockResolvedValue({ data: { role: 'staff', permissions: ['Driver'] } })

    const res = await GET()
    expect(await res.json()).toEqual({ isStaff: true, isDriver: true })
  })

  it('reports owner as staff but never as driver', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { email: 'owner@chickentime.com' } } })
    mockMaybeSingle.mockResolvedValue({ data: { role: 'owner', permissions: [] } })

    const res = await GET()
    expect(await res.json()).toEqual({ isStaff: true, isDriver: false })
  })

  it('reports admin as staff but never as driver', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { email: 'admin@chickentime.com' } } })
    mockMaybeSingle.mockResolvedValue({ data: { role: 'admin', permissions: [] } })

    const res = await GET()
    expect(await res.json()).toEqual({ isStaff: true, isDriver: false })
  })
})
