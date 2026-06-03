'use client'

import { useState } from 'react'
import { Oswald } from 'next/font/google'
import { MapPin, Phone, Mail, Clock, Send, CheckCircle } from 'lucide-react'

const oswald = Oswald({
  variable: '--font-oswald',
  subsets: ['latin'],
  weight: ['600', '700'],
})

const HOURS = [
  { days: 'Monday – Thursday', time: '11:00 – 23:00' },
  { days: 'Friday',            time: '11:00 – 00:00' },
  { days: 'Saturday',          time: '11:00 – 00:00' },
  { days: 'Sunday',            time: '12:00 – 22:00' },
]

const SUBJECTS = [
  'General Enquiry',
  'Order Issue',
  'Feedback & Suggestions',
  'Catering & Events',
  'Press & Media',
  'Other',
]

type FormState = { name: string; email: string; subject: string; message: string }
const EMPTY: FormState = { name: '', email: '', subject: '', message: '' }

function InputField({
  label, id, type = 'text', value, onChange, required = true,
}: {
  label: string; id: keyof FormState; type?: string;
  value: string; onChange: (v: string) => void; required?: boolean
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-bold uppercase tracking-[0.12em] text-gray-500">
        {label}{required && <span className="text-brand-red ml-0.5">*</span>}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 bg-white
          outline-none transition-all duration-150
          focus:border-brand-red focus:ring-2 focus:ring-brand-red/10
          placeholder:text-gray-300"
        placeholder={`Your ${label.toLowerCase()}`}
      />
    </div>
  )
}

export default function ContactPage() {
  const [form, setForm] = useState<FormState>(EMPTY)
  const [submitted, setSubmitted] = useState(false)

  function set(field: keyof FormState) {
    return (value: string) => setForm((f) => ({ ...f, [field]: value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    // Placeholder — wire to API route or email service
    setSubmitted(true)
  }

  return (
    <div className={`${oswald.variable} min-h-screen bg-brand-light`}>

      {/* ── Header ── */}
      <header className="bg-brand-dark text-white px-6 py-20 relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage:
              'repeating-linear-gradient(45deg,#fff,#fff 1px,transparent 1px,transparent 32px)',
          }}
        />
        <div className="relative max-w-5xl mx-auto">
          <p className="text-brand-red text-[10px] font-bold tracking-[0.5em] uppercase mb-5 animate-fade-in">
            Get in Touch
          </p>
          <h1
            className="text-white leading-none animate-fade-up"
            style={{
              fontFamily: 'var(--font-oswald)',
              fontSize: 'clamp(60px, 12vw, 130px)',
              fontWeight: 700,
              letterSpacing: '-0.03em',
            }}
          >
            FIND<br />
            <span className="text-brand-red">US.</span>
          </h1>
          <p className="text-gray-400 mt-6 text-lg max-w-md animate-fade-in" style={{ animationDelay: '0.2s' }}>
            Questions, feedback, or just want to say hello — we&apos;re always here.
          </p>
        </div>
      </header>

      {/* ── Main two-column ── */}
      <main className="max-w-6xl mx-auto px-6 py-14 grid grid-cols-1 lg:grid-cols-5 gap-10">

        {/* LEFT: Contact form (wider) */}
        <div className="lg:col-span-3 bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <h2
            className="text-brand-dark mb-1"
            style={{ fontFamily: 'var(--font-oswald)', fontSize: '28px', fontWeight: 700, letterSpacing: '0.02em' }}
          >
            SEND A MESSAGE
          </h2>
          <p className="text-sm text-gray-400 mb-8">We typically reply within a few hours.</p>

          {submitted ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
              <CheckCircle size={52} className="text-brand-red" />
              <h3
                className="text-brand-dark"
                style={{ fontFamily: 'var(--font-oswald)', fontSize: '26px', fontWeight: 700 }}
              >
                MESSAGE SENT!
              </h3>
              <p className="text-gray-500 text-sm max-w-xs">
                Thanks for reaching out. We&apos;ll get back to you as soon as possible.
              </p>
              <button
                onClick={() => { setForm(EMPTY); setSubmitted(false) }}
                className="mt-4 text-xs font-bold text-brand-red hover:underline uppercase tracking-wider"
              >
                Send another message
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <InputField label="Full Name"  id="name"  value={form.name}  onChange={set('name')}  />
                <InputField label="Email"      id="email" value={form.email} onChange={set('email')} type="email" />
              </div>

              {/* Subject select */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="subject" className="text-xs font-bold uppercase tracking-[0.12em] text-gray-500">
                  Subject<span className="text-brand-red ml-0.5">*</span>
                </label>
                <select
                  id="subject"
                  value={form.subject}
                  onChange={(e) => set('subject')(e.target.value)}
                  required
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 bg-white
                    outline-none transition-all duration-150 cursor-pointer
                    focus:border-brand-red focus:ring-2 focus:ring-brand-red/10
                    appearance-none"
                  style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 14px center' }}
                >
                  <option value="" disabled>Select a subject</option>
                  {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              {/* Message */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="message" className="text-xs font-bold uppercase tracking-[0.12em] text-gray-500">
                  Message<span className="text-brand-red ml-0.5">*</span>
                </label>
                <textarea
                  id="message"
                  value={form.message}
                  onChange={(e) => set('message')(e.target.value)}
                  required
                  rows={5}
                  placeholder="Tell us what's on your mind..."
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 bg-white
                    outline-none transition-all duration-150 resize-none
                    focus:border-brand-red focus:ring-2 focus:ring-brand-red/10
                    placeholder:text-gray-300"
                />
              </div>

              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2.5 bg-brand-red hover:bg-red-700 active:bg-red-800
                  text-white font-black py-4 rounded-xl transition-colors shadow-lg shadow-red-500/20"
              >
                <Send size={17} />
                <span style={{ fontFamily: 'var(--font-oswald)', fontSize: '18px', letterSpacing: '0.06em' }}>
                  SEND MESSAGE
                </span>
              </button>
            </form>
          )}
        </div>

        {/* RIGHT: Info panel */}
        <div className="lg:col-span-2 flex flex-col gap-6">

          {/* Contact details */}
          <div className="bg-brand-dark text-white rounded-2xl p-7 space-y-5">
            <h3
              style={{ fontFamily: 'var(--font-oswald)', fontSize: '20px', fontWeight: 700, letterSpacing: '0.06em' }}
              className="text-white mb-1"
            >
              CONTACT INFO
            </h3>
            {[
              { Icon: MapPin, label: '12 High Street, Reigate, Surrey, RH2 9AZ' },
              { Icon: Phone, label: '01737 000 000'                              },
              { Icon: Mail,  label: 'hello@chickentime.co.uk'                   },
            ].map(({ Icon, label }) => (
              <div key={label} className="flex items-start gap-3">
                <Icon size={17} className="text-brand-red shrink-0 mt-0.5" />
                <span className="text-gray-300 text-sm leading-snug">{label}</span>
              </div>
            ))}
          </div>

          {/* Opening hours */}
          <div className="bg-white rounded-2xl border border-gray-100 p-7 shadow-sm">
            <div className="flex items-center gap-2 mb-5">
              <Clock size={17} className="text-brand-red" />
              <h3
                style={{ fontFamily: 'var(--font-oswald)', fontSize: '20px', fontWeight: 700, letterSpacing: '0.06em' }}
                className="text-brand-dark"
              >
                OPENING HOURS
              </h3>
            </div>
            <div className="space-y-3">
              {HOURS.map(({ days, time }) => {
                const isLate = time.includes('00:00')
                return (
                  <div key={days} className="flex items-center justify-between gap-4 py-2 border-b border-gray-50 last:border-0">
                    <span className="text-sm text-gray-600 font-medium">{days}</span>
                    <span className={`text-sm font-bold tabular-nums shrink-0 ${isLate ? 'text-brand-red' : 'text-brand-dark'}`}>
                      {time}
                    </span>
                  </div>
                )
              })}
            </div>
            <p className="text-xs text-gray-400 mt-4">
              Last orders 30 minutes before closing.
            </p>
          </div>

          {/* Map placeholder */}
          <div className="rounded-2xl overflow-hidden relative bg-brand-dark aspect-[4/3] flex items-end">
            {/* Stylised grid map feel */}
            <div
              className="absolute inset-0 opacity-10"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(0deg,#fff,#fff 1px,transparent 1px,transparent 40px),' +
                  'repeating-linear-gradient(90deg,#fff,#fff 1px,transparent 1px,transparent 40px)',
              }}
            />
            {/* Decorative road lines */}
            <div className="absolute inset-0 flex items-center justify-center opacity-20">
              <div className="w-full h-[2px] bg-white" />
            </div>
            <div className="absolute inset-0 flex items-center justify-center opacity-20">
              <div className="w-[2px] h-full bg-white" />
            </div>

            {/* Centre pin */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex flex-col items-center gap-1">
                <div className="w-10 h-10 rounded-full bg-brand-red flex items-center justify-center shadow-lg shadow-red-900/40">
                  <MapPin size={20} className="text-white" />
                </div>
                <div className="w-2 h-2 rounded-full bg-brand-red/40" />
              </div>
            </div>

            {/* Bottom label */}
            <div className="relative z-10 w-full bg-gradient-to-t from-brand-dark/90 to-transparent p-5">
              <p className="text-white text-xs font-bold">12 High Street, Reigate RH2 9AZ</p>
              <a
                href="https://maps.google.com/?q=Reigate+High+Street"
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-red text-xs font-semibold hover:underline mt-0.5 inline-block"
              >
                Open in Google Maps →
              </a>
            </div>
          </div>

        </div>
      </main>
    </div>
  )
}
