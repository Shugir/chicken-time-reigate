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

vi.mock('./supabase-admin', () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({ maybeSingle: mockMaybeSingle })),
      })),
    })),
  },
}))

import { hasPermission, getUserPermissions, type UserPermissions } from './get-user-permissions'

describe('hasPermission', () => {
  it('owner bypasses permission checks entirely', () => {
    const owner: UserPermissions = { email: 'a@b.com', role: 'owner', permissions: [], isOwner: true }
    expect(hasPermission(owner, 'anything')).toBe(true)
  })

  it('staff with the permission in their list is allowed', () => {
    const staff: UserPermissions = { email: 'a@b.com', role: 'staff', permissions: ['Manage Menu'], isOwner: false }
    expect(hasPermission(staff, 'Manage Menu')).toBe(true)
  })

  it('staff without the permission is denied', () => {
    const staff: UserPermissions = { email: 'a@b.com', role: 'staff', permissions: ['Manage Menu'], isOwner: false }
    expect(hasPermission(staff, 'Manage Drivers')).toBe(false)
  })
})

describe('getUserPermissions', () => {
  beforeEach(() => {
    mockGetUser.mockReset()
    mockMaybeSingle.mockReset()
  })

  it('returns null when there is no authenticated user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const result = await getUserPermissions()
    expect(result).toBeNull()
  })

  it('returns null when the user has no email', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { email: null } } })
    const result = await getUserPermissions()
    expect(result).toBeNull()
  })

  it('denies a signed-in user absent from staff_permissions', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { email: 'customer@example.com' } } })
    mockMaybeSingle.mockResolvedValue({ data: null })

    const result = await getUserPermissions()
    expect(result).toBeNull()
  })

  it('grants owner only from an explicit owner record', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { email: 'owner@chickentime.com' } } })
    mockMaybeSingle.mockResolvedValue({ data: { role: 'owner', permissions: [] } })

    const result = await getUserPermissions()
    expect(result).toEqual({
      email: 'owner@chickentime.com',
      role: 'owner',
      permissions: [],
      isOwner: true,
    })
  })

  it('maps a staff_permissions record to staff, not owner', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { email: 'staff@chickentime.com' } } })
    mockMaybeSingle.mockResolvedValue({ data: { role: 'staff', permissions: ['Manage Menu'] } })

    const result = await getUserPermissions()
    expect(result).toEqual({
      email: 'staff@chickentime.com',
      role: 'staff',
      permissions: ['Manage Menu'],
      isOwner: false,
    })
  })

  it('defaults permissions to an empty array when the column is null', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { email: 'staff@chickentime.com' } } })
    mockMaybeSingle.mockResolvedValue({ data: { role: 'staff', permissions: null } })

    const result = await getUserPermissions()
    expect(result?.permissions).toEqual([])
  })
})
