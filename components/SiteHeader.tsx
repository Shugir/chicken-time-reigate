'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { Menu, X } from 'lucide-react'
import { supabase } from '@/lib/supabase-browser'

const NAV_LINKS = [
  { label: 'Home',     href: '/' },
  { label: 'Our Menu', href: '/order' },
  { label: 'Deals',    href: '/deals' },
  { label: 'About',    href: '/about' },
  { label: 'Contact',  href: '/contact' },
]

export function SiteHeader() {
  const pathname = usePathname()
  const [open, setOpen]               = useState(false)
  const [logoUrl, setLogoUrl]         = useState<string | null>(null)
  const [isLoggedIn, setIsLoggedIn]   = useState(false)
  const [loyaltyPoints, setLoyaltyPoints] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/admin/store-settings')
      .then((r) => r.json())
      .then((d) => { if (d.logo_url) setLogoUrl(d.logo_url) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    function syncFromSession(hasSession: boolean) {
      setIsLoggedIn(hasSession)
      if (!hasSession) {
        setLoyaltyPoints(null)
        return
      }
      fetch('/api/loyalty/balance').then(async (r) => {
        if (r.ok) { const d = await r.json(); setLoyaltyPoints(d.balance ?? 0) }
      })
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      syncFromSession(!!session)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      syncFromSession(!!session)
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <header className="sticky top-0 z-50 bg-brand-dark border-b border-white/10 shadow-lg shadow-black/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-1 flex items-center justify-between gap-6">

        {/* Logo */}
        <Link href="/" className="flex items-center shrink-0">
          <Image
            src={logoUrl ?? '/chicken-time-logo_v1.png'}
            alt="Chicken Time Reigate Logo"
            width={700}
            height={150}
            className="h-14 w-auto"
            unoptimized={!!logoUrl}
          />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map(({ label, href }) => (
            <Link
              key={href}
              href={href}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                pathname === href
                  ? 'bg-white/10 text-white'
                  : 'text-white/70 hover:text-white hover:bg-white/[0.08]'
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>

        {/* Desktop auth UI */}
        <div className="hidden md:flex items-center gap-2 shrink-0">
          {isLoggedIn && loyaltyPoints !== null && (
            <Link
              href="/account"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/20 text-amber-400 text-xs font-bold hover:bg-amber-500/30 transition-colors"
            >
              🍗 {loyaltyPoints.toLocaleString()} pts
            </Link>
          )}
          {isLoggedIn ? (
            <Link
              href="/account"
              className="px-4 py-2 text-sm font-semibold text-white/80 hover:text-white transition-colors rounded-lg hover:bg-white/[0.08]"
            >
              My Account
            </Link>
          ) : (
            <>
              <Link
                href="/sign-in"
                className="px-4 py-2 text-sm font-semibold text-white/80 hover:text-white transition-colors rounded-lg hover:bg-white/[0.08]"
              >
                Sign In
              </Link>
              <Link
                href="/sign-up"
                className="px-4 py-2 text-sm font-bold bg-brand-red hover:bg-red-700 active:bg-red-800 text-white rounded-lg transition-colors shadow-md shadow-red-900/40"
              >
                Sign Up
              </Link>
            </>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="md:hidden border-t border-white/10 bg-brand-dark px-4 pt-3 pb-5 space-y-1">
          {NAV_LINKS.map(({ label, href }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className={`block px-4 py-3 rounded-lg text-sm font-semibold transition-colors ${
                pathname === href
                  ? 'bg-white/10 text-white'
                  : 'text-white/70 hover:text-white hover:bg-white/[0.08]'
              }`}
            >
              {label}
            </Link>
          ))}
          <div className="flex gap-2 pt-3 border-t border-white/10 mt-3">
            {isLoggedIn ? (
              <Link
                href="/account"
                onClick={() => setOpen(false)}
                className="flex-1 text-center px-4 py-2.5 text-sm font-semibold text-white border border-white/20 rounded-lg hover:bg-white/[0.08] transition-colors"
              >
                {loyaltyPoints !== null ? `🍗 ${loyaltyPoints.toLocaleString()} pts · My Account` : 'My Account'}
              </Link>
            ) : (
              <>
                <Link
                  href="/sign-in"
                  onClick={() => setOpen(false)}
                  className="flex-1 text-center px-4 py-2.5 text-sm font-semibold text-white border border-white/20 rounded-lg hover:bg-white/[0.08] transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  href="/sign-up"
                  onClick={() => setOpen(false)}
                  className="flex-1 text-center px-4 py-2.5 text-sm font-bold bg-brand-red hover:bg-red-700 text-white rounded-lg transition-colors"
                >
                  Sign Up
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  )
}
