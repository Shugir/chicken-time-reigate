'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { NewsletterForm } from './NewsletterForm'

const QUICK_LINKS = [
  { label: 'Home',     href: '/' },
  { label: 'Our Menu', href: '/order' },
  { label: 'Deals',    href: '/deals' },
  { label: 'About',    href: '/about' },
  { label: 'Contact',  href: '/contact' },
]

const DAY_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const

interface DayHours { enabled: boolean; open: string; close: string }
type BusinessHours = Record<string, DayHours>

interface StoreSettings {
  contact_email:  string | null
  contact_phone:  string | null
  store_address:  string | null
  business_hours: BusinessHours | null
}

function buildHoursRows(hours: BusinessHours): { label: string; time: string }[] {
  const rows: { label: string; time: string }[] = []
  for (const day of DAY_ORDER) {
    const h = hours[day]
    if (!h?.enabled) continue
    const time = `${h.open} – ${h.close}`
    const last = rows[rows.length - 1]
    if (last && last.time === time) {
      const prev = last.label
      last.label = prev.includes('–') ? `${prev.split('–')[0].trim()} – ${capitalize(day)}` : `${prev} – ${capitalize(day)}`
    } else {
      rows.push({ label: capitalize(day), time })
    }
  }
  return rows
}

function capitalize(s: string) { return s.charAt(0).toUpperCase() + s.slice(1) }

const FALLBACK_HOURS = [
  { label: 'Mon – Thu', time: '11:00 – 22:00' },
  { label: 'Fri – Sat', time: '11:00 – 23:00' },
  { label: 'Sunday',    time: '12:00 – 21:00' },
]

export function Footer() {
  const [settings, setSettings] = useState<StoreSettings | null>(null)

  useEffect(() => {
    fetch('/api/store-settings')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setSettings(d) })
      .catch(() => {})
  }, [])

  const address   = settings?.store_address ?? '📍 High Street, Reigate, Surrey RH2 9AZ'
  const phone     = settings?.contact_phone
  const email     = settings?.contact_email
  const hoursRows = settings?.business_hours ? buildHoursRows(settings.business_hours) : FALLBACK_HOURS

  return (
    <footer className="bg-brand-dark text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">

        {/* Brand */}
        <div className="space-y-4">
          <Link href="/" className="flex items-center">
            <Image src="/LOGOS.png" alt="Chicken Time Reigate" width={960} height={200} className="w-full max-w-[280px] h-auto" />
          </Link>
          <p className="text-sm text-white/60 leading-relaxed max-w-[220px]">
            Fresh, crispy chicken made to order. Proudly serving Reigate since 2019.
          </p>
          <p className="text-xs text-white/40">{address}</p>
          {phone && <p className="text-xs text-white/40">📞 {phone}</p>}
          {email && <p className="text-xs text-white/40">✉ {email}</p>}
        </div>

        {/* Quick links */}
        <div className="space-y-4">
          <h3 className="font-heading font-bold text-sm uppercase tracking-widest text-white/50">Quick Links</h3>
          <ul className="space-y-2">
            {QUICK_LINKS.map(({ label, href }) => (
              <li key={href}>
                <Link href={href} className="text-sm text-white/70 hover:text-white transition-colors">{label}</Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Hours */}
        <div className="space-y-4">
          <h3 className="font-heading font-bold text-sm uppercase tracking-widest text-white/50">Opening Hours</h3>
          <ul className="space-y-2">
            {hoursRows.map(({ label, time }) => (
              <li key={label} className="flex justify-between gap-4 text-sm">
                <span className="text-white/60">{label}</span>
                <span className="text-white font-semibold tabular-nums">{time}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-white/40 pt-1">Last orders 30 min before close</p>
        </div>

        {/* Newsletter */}
        <div className="space-y-4">
          <h3 className="font-heading font-bold text-sm uppercase tracking-widest text-white/50">Stay in the Loop</h3>
          <p className="text-sm text-white/60 leading-relaxed">New deals, limited drops, and crispy news straight to your inbox.</p>
          <NewsletterForm />
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-white/35">
          <p suppressHydrationWarning>© {new Date().getFullYear()} Chicken Time Reigate. All rights reserved.</p>
          <div className="flex gap-5">
            <Link href="/privacy"   className="hover:text-white/60 transition-colors">Privacy</Link>
            <Link href="/terms"     className="hover:text-white/60 transition-colors">Terms</Link>
            <Link href="/allergens" className="hover:text-white/60 transition-colors">Allergens</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
