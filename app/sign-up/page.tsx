'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createBrowserClient } from '@supabase/ssr'
import { Mail, Lock, Eye, EyeOff, User, ChevronRight, ArrowLeft, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import toast from 'react-hot-toast'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

export default function SignUpPage() {
  const [showPassword, setShowPassword]           = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [name, setName]                           = useState('')
  const [email, setEmail]                         = useState('')
  const [password, setPassword]                   = useState('')
  const [confirmPassword, setConfirmPassword]     = useState('')
  const [loading, setLoading]                     = useState(false)
  const [oauthLoading, setOauthLoading]           = useState<string | null>(null)
  const [error, setError]                         = useState<string | null>(null)
  const [success, setSuccess]                     = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    setLoading(true)
    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name.trim() || null } },
    })
    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }
    setSuccess(true)
    setLoading(false)
  }

  async function handleOAuth(provider: 'google' | 'facebook') {
    setOauthLoading(provider)
    setError(null)
    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }

  if (success) {
    return (
      <div className="h-[calc(100dvh-4rem)] flex items-center justify-center bg-white px-4">
        <div className="w-full max-w-sm text-center">
          <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
          <h2 className="font-heading font-black text-2xl text-brand-dark mb-2">Check your email</h2>
          <p className="text-sm text-gray-500 mb-6">
            We sent a confirmation link to{' '}
            <span className="font-semibold text-brand-dark">{email}</span>.
            Click it to activate your account.
          </p>
          <Link href="/sign-in" className="text-sm text-brand-red font-bold hover:underline">
            Back to Sign In
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="h-[calc(100dvh-4rem)] flex overflow-hidden">

      {/* ── Left panel — brand imagery ── */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col justify-between p-12 overflow-hidden">
        <div className="absolute inset-0 bg-brand-dark" />
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 110% 80% at 60% 110%, rgba(228,0,43,0.45) 0%, rgba(255,80,0,0.15) 40%, transparent 65%),' +
              'radial-gradient(ellipse 80% 60% at 20% -10%, rgba(255,199,44,0.08) 0%, transparent 50%)',
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              'repeating-linear-gradient(0deg,#fff,#fff 1px,transparent 1px,transparent 60px),' +
              'repeating-linear-gradient(90deg,#fff,#fff 1px,transparent 1px,transparent 60px)',
          }}
        />
        <div className="relative z-10">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-white/40 hover:text-white/80 text-xs font-semibold tracking-wider uppercase transition-colors"
          >
            <ArrowLeft size={14} /> Back to site
          </Link>
        </div>
        <div className="relative z-10 flex flex-col gap-8">
          <div className="text-[80px] leading-none select-none">🍗</div>
          <div>
            <h2 className="font-heading font-black text-white text-5xl leading-tight">
              Join the<br />
              <span className="text-brand-red">Chicken Time</span><br />
              family.
            </h2>
            <p className="text-white/50 text-base mt-5 leading-relaxed max-w-xs">
              Order faster, track your favourites, and never miss a deal again.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            {[
              { icon: '⚡', text: 'Faster checkout every time' },
              { icon: '❤️', text: 'Save your favourite orders' },
              { icon: '🎁', text: 'Exclusive member deals' },
            ].map(({ icon, text }) => (
              <div key={text} className="flex items-center gap-3">
                <span className="text-base">{icon}</span>
                <span className="text-white/60 text-sm font-medium">{text}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="relative z-10">
          <p className="text-white/20 text-xs">© {new Date().getFullYear()} Chicken Time Reigate</p>
        </div>
      </div>

      {/* ── Right panel — form ── */}
      <div className="w-full lg:w-1/2 flex items-center justify-center bg-white px-6 sm:px-12 overflow-y-auto">
        <div className="w-full max-w-sm py-10">

          <Link
            href="/"
            className="lg:hidden inline-flex items-center gap-1.5 text-gray-400 hover:text-gray-700 text-xs font-semibold uppercase tracking-wider mb-8 transition-colors"
          >
            <ArrowLeft size={13} /> Home
          </Link>

          <div className="mb-8">
            <h1 className="font-heading font-black text-3xl text-brand-dark">Create account</h1>
            <p className="text-gray-500 text-sm mt-1.5">Join Chicken Time — it&apos;s free</p>
          </div>

          {/* OAuth — prominent, first */}
          <p className="text-xs text-gray-400 text-center mb-3 font-medium">Quick sign up</p>
          <div className="space-y-3 mb-6">
            <button
              type="button"
              onClick={() => handleOAuth('google')}
              disabled={!!oauthLoading || loading}
              className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-50 disabled:opacity-50
                         text-gray-800 font-semibold rounded-xl py-3.5 text-sm transition-colors
                         border border-gray-200 shadow-sm"
            >
              {oauthLoading === 'google' ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
              )}
              Continue with Google
            </button>

            <button
              type="button"
              onClick={() => handleOAuth('facebook')}
              disabled={!!oauthLoading || loading}
              className="w-full flex items-center justify-center gap-3 bg-[#1877F2] hover:bg-[#1565D8] disabled:opacity-50
                         text-white font-semibold rounded-xl py-3.5 text-sm transition-colors shadow-sm"
            >
              {oauthLoading === 'facebook' ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="white">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              )}
              Continue with Facebook
            </button>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px bg-gray-100" />
            <span className="text-xs text-gray-400 font-medium">or sign up with email</span>
            <div className="flex-1 h-px bg-gray-100" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="name" className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                Full name
              </label>
              <div className="relative">
                <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 text-sm text-brand-dark placeholder:text-gray-400 focus:outline-none focus:border-brand-red focus:ring-2 focus:ring-brand-red/10 transition"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="email" className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                Email address
              </label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 text-sm text-brand-dark placeholder:text-gray-400 focus:outline-none focus:border-brand-red focus:ring-2 focus:ring-brand-red/10 transition"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  required
                  minLength={8}
                  className="w-full pl-10 pr-11 py-3 rounded-xl border border-gray-200 text-sm text-brand-dark placeholder:text-gray-400 focus:outline-none focus:border-brand-red focus:ring-2 focus:ring-brand-red/10 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="confirm-password" className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                Confirm password
              </label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  id="confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat your password"
                  required
                  className="w-full pl-10 pr-11 py-3 rounded-xl border border-gray-200 text-sm text-brand-dark placeholder:text-gray-400 focus:outline-none focus:border-brand-red focus:ring-2 focus:ring-brand-red/10 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 transition-colors"
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2.5 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !!oauthLoading}
              className="w-full flex items-center justify-center gap-2 bg-brand-red hover:bg-red-700 active:bg-red-800 disabled:opacity-60 disabled:cursor-not-allowed text-white font-black text-base py-3.5 rounded-xl transition-colors shadow-lg shadow-red-500/20 mt-2"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>Create Account <ChevronRight size={18} /></>
              )}
            </button>

            <p className="text-xs text-gray-400 text-center leading-relaxed">
              By signing up you agree to our{' '}
              <Link href="/terms" className="text-brand-red hover:underline">Terms</Link>
              {' '}and{' '}
              <Link href="/privacy" className="text-brand-red hover:underline">Privacy Policy</Link>.
            </p>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Already have an account?{' '}
            <Link href="/sign-in" className="text-brand-red font-bold hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
