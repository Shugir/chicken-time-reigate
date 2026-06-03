'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Mail, Lock, Eye, EyeOff, ChevronRight, ArrowLeft } from 'lucide-react'

export default function SignInPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail]               = useState('')
  const [password, setPassword]         = useState('')
  const [loading, setLoading]           = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    // TODO: wire to auth provider (Supabase Auth, NextAuth, etc.)
    setTimeout(() => setLoading(false), 1500)
  }

  return (
    <div className="h-[calc(100dvh-4rem)] flex overflow-hidden">

      {/* ── Left panel — brand imagery ── */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col justify-between p-12 overflow-hidden">

        {/* Background layers */}
        <div className="absolute inset-0 bg-brand-dark" />
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 110% 80% at 60% 110%, rgba(228,0,43,0.45) 0%, rgba(255,80,0,0.15) 40%, transparent 65%),' +
              'radial-gradient(ellipse 80% 60% at 20% -10%, rgba(255,199,44,0.08) 0%, transparent 50%)',
          }}
        />
        {/* Subtle grid */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              'repeating-linear-gradient(0deg,#fff,#fff 1px,transparent 1px,transparent 60px),' +
              'repeating-linear-gradient(90deg,#fff,#fff 1px,transparent 1px,transparent 60px)',
          }}
        />

        {/* Back link */}
        <div className="relative z-10">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-white/40 hover:text-white/80 text-xs font-semibold tracking-wider uppercase transition-colors"
          >
            <ArrowLeft size={14} /> Back to site
          </Link>
        </div>

        {/* Centre content */}
        <div className="relative z-10 flex flex-col gap-8">
          <div className="text-[80px] leading-none select-none">🍗</div>

          <div>
            <h2 className="font-heading font-black text-white text-5xl leading-tight">
              The best<br />
              <span className="text-brand-red">crispy chicken</span><br />
              in Reigate.
            </h2>
            <p className="text-white/50 text-base mt-5 leading-relaxed max-w-xs">
              Fresh birds every morning. Cooked the moment you order. No shortcuts, ever.
            </p>
          </div>

          {/* Trust chips */}
          <div className="flex flex-wrap gap-2">
            {['🌟 4.9 Rating', '🚚 25 min delivery', '🔥 Cooked to order'].map((t) => (
              <span
                key={t}
                className="bg-white/[0.07] border border-white/10 text-white/60 text-xs font-semibold px-3 py-1.5 rounded-full"
              >
                {t}
              </span>
            ))}
          </div>
        </div>

        {/* Bottom */}
        <div className="relative z-10">
          <p className="text-white/20 text-xs">© {new Date().getFullYear()} Chicken Time Reigate</p>
        </div>
      </div>

      {/* ── Right panel — form ── */}
      <div className="w-full lg:w-1/2 flex items-center justify-center bg-white px-6 sm:px-12 overflow-y-auto">
        <div className="w-full max-w-sm py-10">

          {/* Mobile back link */}
          <Link
            href="/"
            className="lg:hidden inline-flex items-center gap-1.5 text-gray-400 hover:text-gray-700 text-xs font-semibold uppercase tracking-wider mb-8 transition-colors"
          >
            <ArrowLeft size={13} /> Home
          </Link>

          {/* Heading */}
          <div className="mb-8">
            <h1 className="font-heading font-black text-3xl text-brand-dark">Welcome back</h1>
            <p className="text-gray-500 text-sm mt-1.5">Sign in to your Chicken Time account</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Email */}
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

            {/* Password */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Password
                </label>
                <Link href="/forgot-password" className="text-xs text-brand-red hover:underline font-semibold">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
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

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-brand-red hover:bg-red-700 active:bg-red-800 disabled:opacity-60 disabled:cursor-not-allowed text-white font-black text-base py-3.5 rounded-xl transition-colors shadow-lg shadow-red-500/20 mt-2"
            >
              {loading ? (
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>Sign In <ChevronRight size={18} /></>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-gray-100" />
            <span className="text-xs text-gray-400 font-medium">or</span>
            <div className="flex-1 h-px bg-gray-100" />
          </div>

          {/* Sign up link */}
          <p className="text-center text-sm text-gray-500">
            Don&apos;t have an account?{' '}
            <Link href="/sign-up" className="text-brand-red font-bold hover:underline">
              Sign up free
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
