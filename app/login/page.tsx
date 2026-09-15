'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase-browser'
import { Loader2, AlertCircle } from 'lucide-react'
import Image from 'next/image'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [logoUrl, setLogoUrl]   = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/store-settings')
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.logo_url) setLogoUrl(d.logo_url) })
      .catch(() => {})
  }, [])

  async function redirectByRole() {
    const res = await fetch('/api/auth/role')
    const { isStaff, isDriver } = await res.json()
    router.push(isDriver ? '/driver/dashboard' : isStaff ? '/admin/redirect' : '/account')
    router.refresh()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      setError('Invalid email or password.')
      setLoading(false)
      return
    }

    await redirectByRole()
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <Image
            src={logoUrl ?? '/chicken-time-logo_v1.png'}
            alt="Chicken Time"
            width={400}
            height={150}
            className="mb-3 w-full h-auto object-contain drop-shadow-lg"
            unoptimized={!!logoUrl}
          />
          <h1 className="text-xl font-bold text-white">Chicken Time</h1>
          <p className="text-sm text-zinc-500 mt-1">Reigate</p>
        </div>

        {/* Card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-7">

          <h2 className="text-base font-semibold text-white mb-5">Sign in to continue</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                Email address
              </label>
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3.5 py-2.5 text-sm text-white
                           placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-brand-red focus:border-brand-red"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                Password
              </label>
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3.5 py-2.5 text-sm text-white
                           placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-brand-red focus:border-brand-red"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2.5 bg-red-500/10 border border-red-500/20 rounded-lg px-3.5 py-2.5">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <p className="text-sm text-red-300">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand-red hover:bg-brand-red/90 disabled:opacity-60 text-white font-semibold
                         rounded-lg py-2.5 text-sm transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Signing in…
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

        </div>
      </div>
    </div>
  )
}
