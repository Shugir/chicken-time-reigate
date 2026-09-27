import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockGetUser = vi.fn()

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
  })),
}))

import { middleware, config } from './middleware'

describe('middleware', () => {
  beforeEach(() => {
    mockGetUser.mockReset()
  })

  it('redirects unauthenticated requests to /sign-in', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const req = new NextRequest('http://localhost/admin/dashboard')
    const res = await middleware(req)

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('http://localhost/sign-in')
  })

  it('lets authenticated requests through without redirecting', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { email: 'staff@chickentime.com' } } })

    const req = new NextRequest('http://localhost/admin/dashboard')
    const res = await middleware(req)

    expect(res.headers.get('location')).toBeNull()
  })

  it('protects the expected route groups', () => {
    expect(config.matcher).toEqual(
      expect.arrayContaining([
        '/admin/:path*',
        '/kitchen',
        '/kitchen/:path*',
        '/account',
        '/account/:path*',
        '/driver',
        '/driver/:path*',
      ]),
    )
  })
})
