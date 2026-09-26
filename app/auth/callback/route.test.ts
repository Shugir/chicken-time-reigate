import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockExchangeCodeForSession = vi.fn()
const mockGetUser = vi.fn()
const mockMaybeSingle = vi.fn()

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({ getAll: () => [], set: vi.fn() })),
}))

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      exchangeCodeForSession: mockExchangeCodeForSession,
      getUser: mockGetUser,
    },
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

describe('GET /auth/callback', () => {
  beforeEach(() => {
    mockExchangeCodeForSession.mockReset()
    mockGetUser.mockReset()
    mockMaybeSingle.mockReset()
  })

  it('sends the user to the OAuth error page when no code is present', async () => {
    const req = new NextRequest('http://localhost/auth/callback')
    const res = await GET(req)
    expect(res.headers.get('location')).toBe('http://localhost/login?error=oauth')
  })

  it('sends the user to the OAuth error page when the code exchange fails', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: new Error('bad code') })

    const req = new NextRequest('http://localhost/auth/callback?code=abc123')
    const res = await GET(req)
    expect(res.headers.get('location')).toBe('http://localhost/login?error=oauth')
  })

  it('sends staff members to the admin redirect page', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: null })
    mockGetUser.mockResolvedValue({ data: { user: { email: 'staff@chickentime.com' } } })
    mockMaybeSingle.mockResolvedValue({ data: { role: 'staff' } })

    const req = new NextRequest('http://localhost/auth/callback?code=abc123')
    const res = await GET(req)
    expect(res.headers.get('location')).toBe('http://localhost/admin/redirect')
  })

  it('sends regular customers to their account page', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: null })
    mockGetUser.mockResolvedValue({ data: { user: { email: 'customer@example.com' } } })
    mockMaybeSingle.mockResolvedValue({ data: null })

    const req = new NextRequest('http://localhost/auth/callback?code=abc123')
    const res = await GET(req)
    expect(res.headers.get('location')).toBe('http://localhost/account')
  })

  describe('next parameter', () => {
    const signInCustomer = () => {
      mockExchangeCodeForSession.mockResolvedValue({ error: null })
      mockGetUser.mockResolvedValue({ data: { user: { email: 'customer@example.com' } } })
      mockMaybeSingle.mockResolvedValue({ data: null })
    }
    const callback = (next: string) =>
      GET(new NextRequest(`http://localhost/auth/callback?code=abc123&next=${encodeURIComponent(next)}`))

    it('returns a customer to a safe relative next path', async () => {
      signInCustomer()
      const res = await callback('/order/customize/item-1')
      expect(res.headers.get('location')).toBe('http://localhost/order/customize/item-1')
    })

    it.each(['//evil.com', 'https://evil.com', '/\\evil.com', 'javascript:alert(1)'])(
      'ignores unsafe next %s and falls back to /account',
      async (next) => {
        signInCustomer()
        const res = await callback(next)
        expect(res.headers.get('location')).toBe('http://localhost/account')
      },
    )

    it('keeps staff on the admin redirect even with a next path', async () => {
      mockExchangeCodeForSession.mockResolvedValue({ error: null })
      mockGetUser.mockResolvedValue({ data: { user: { email: 'staff@chickentime.com' } } })
      mockMaybeSingle.mockResolvedValue({ data: { role: 'staff' } })
      const res = await callback('/order/customize/item-1')
      expect(res.headers.get('location')).toBe('http://localhost/admin/redirect')
    })
  })
})
