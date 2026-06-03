'use client'

import { useState } from 'react'

export function NewsletterForm() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email) return
    // TODO: wire to email service (Mailchimp, Resend, etc.)
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <p className="text-sm text-brand-yellow font-semibold py-2">
        You&apos;re on the list! 🎉
      </p>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="your@email.com"
        required
        className="w-full px-4 py-2.5 rounded-lg bg-white/[0.08] border border-white/15 text-sm text-white placeholder:text-white/35 focus:outline-none focus:border-brand-yellow focus:ring-1 focus:ring-brand-yellow transition"
      />
      <button
        type="submit"
        className="w-full py-2.5 px-4 bg-brand-red hover:bg-red-700 active:bg-red-800 text-white text-sm font-bold rounded-lg transition-colors shadow-lg shadow-red-900/30"
      >
        Subscribe
      </button>
    </form>
  )
}
