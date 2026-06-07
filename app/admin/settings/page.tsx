'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Settings, Loader2, Check, X, Clock, Store, UploadCloud,
  Phone, Mail, MapPin, Calendar, AlertTriangle, Plus, Trash2,
} from 'lucide-react'
import Image from 'next/image'
import { createBrowserClient } from '@supabase/ssr'
import AdminSidebar from '@/components/admin/admin-sidebar'
import { DAYS, DayKey } from '@/lib/store-status'
import toast from 'react-hot-toast'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

const DAY_LABELS: Record<DayKey, string> = {
  monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday',
  thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday',
}

interface DayHours { enabled: boolean; open: string; close: string }
type BusinessHours = Record<DayKey, DayHours>
interface Holiday { date: string; note?: string }

interface StoreSettings {
  id:                   number
  is_open:              boolean
  is_accepting_orders:  boolean
  prep_time_minutes:    number
  logo_url:             string | null
  contact_email:        string | null
  contact_phone:        string | null
  store_address:        string | null
  business_hours:       BusinessHours
  holidays:             Holiday[]
}

const DEFAULT_HOURS: BusinessHours = {
  monday:    { enabled: true,  open: '11:00', close: '22:00' },
  tuesday:   { enabled: true,  open: '11:00', close: '22:00' },
  wednesday: { enabled: true,  open: '11:00', close: '22:00' },
  thursday:  { enabled: true,  open: '11:00', close: '22:00' },
  friday:    { enabled: true,  open: '11:00', close: '23:00' },
  saturday:  { enabled: true,  open: '11:00', close: '23:00' },
  sunday:    { enabled: true,  open: '12:00', close: '21:00' },
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export default function SettingsPage() {
  const [settings, setSettings]       = useState<StoreSettings | null>(null)
  const [loading, setLoading]         = useState(true)

  // Kill switch
  const [killBusy, setKillBusy]       = useState(false)

  // Contact
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [storeAddress, setStoreAddress] = useState('')
  const contactTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Hours
  const [hours, setHours]             = useState<BusinessHours>(DEFAULT_HOURS)
  const [hoursSave, setHoursSave]     = useState<SaveState>('idle')

  // Holidays
  const [holidays, setHolidays]       = useState<Holiday[]>([])
  const [newDate, setNewDate]         = useState('')
  const [newNote, setNewNote]         = useState('')
  const [holidaySaving, setHolidaySaving] = useState(false)

  // Prep + logo
  const [toggleBusy, setToggleBusy]   = useState(false)
  const [prepSave, setPrepSave]       = useState<SaveState>('idle')
  const [prepValue, setPrepValue]     = useState('')
  const prepTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [logoUploading, setLogoUploading] = useState(false)
  const [logoError, setLogoError]         = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/store-settings')
      .then(r => r.json())
      .then((data: StoreSettings) => {
        setSettings(data)
        setPrepValue(String(data.prep_time_minutes))
        setContactEmail(data.contact_email ?? '')
        setContactPhone(data.contact_phone ?? '')
        setStoreAddress(data.store_address ?? '')
        setHours(data.business_hours ?? DEFAULT_HOURS)
        setHolidays(data.holidays ?? [])
        setLoading(false)
      })
  }, [])

  async function patch(body: Record<string, unknown>) {
    const res = await fetch('/api/admin/store-settings', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error('Save failed')
    return res.json() as Promise<StoreSettings>
  }

  // ── Kill switch ────────────────────────────────────────────────
  async function handleKillSwitch() {
    if (!settings || killBusy) return
    const next = !settings.is_accepting_orders
    setSettings(s => s ? { ...s, is_accepting_orders: next } : s)
    setKillBusy(true)
    try {
      const updated = await patch({ is_accepting_orders: next, is_open: next })
      setSettings(updated)
      toast(next ? '✅ Store accepting orders' : '🛑 Orders paused', { icon: next ? '✅' : '🛑' })
    } catch {
      setSettings(s => s ? { ...s, is_accepting_orders: !next } : s)
      toast.error('Failed to update')
    } finally {
      setKillBusy(false)
    }
  }

  // ── Contact auto-save ──────────────────────────────────────────
  function handleContactChange(field: string, value: string) {
    if (field === 'contact_email') setContactEmail(value)
    if (field === 'contact_phone') setContactPhone(value)
    if (field === 'store_address') setStoreAddress(value)
    if (contactTimer.current) clearTimeout(contactTimer.current)
    contactTimer.current = setTimeout(() => {
      patch({ [field]: value.trim() || null }).catch(() => {})
    }, 800)
  }

  // ── Hours ──────────────────────────────────────────────────────
  function updateDay(day: DayKey, field: keyof DayHours, value: boolean | string) {
    setHours(h => ({ ...h, [day]: { ...h[day], [field]: value } }))
  }

  async function saveHours() {
    setHoursSave('saving')
    try {
      await patch({ business_hours: hours })
      setHoursSave('saved')
      setTimeout(() => setHoursSave('idle'), 1500)
    } catch {
      setHoursSave('error')
    }
  }

  // ── Holidays ───────────────────────────────────────────────────
  async function addHoliday() {
    if (!newDate) return
    const next = [...holidays, { date: newDate, note: newNote.trim() || undefined }]
      .sort((a, b) => a.date.localeCompare(b.date))
    setHolidaySaving(true)
    try {
      await patch({ holidays: next })
      setHolidays(next)
      setNewDate(''); setNewNote('')
    } catch { toast.error('Failed to save') } finally { setHolidaySaving(false) }
  }

  async function removeHoliday(date: string) {
    const next = holidays.filter(h => h.date !== date)
    try {
      await patch({ holidays: next })
      setHolidays(next)
    } catch { toast.error('Failed to remove') }
  }

  // ── Prep time ──────────────────────────────────────────────────
  function handlePrepChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value; setPrepValue(val); setPrepSave('idle')
    if (prepTimer.current) clearTimeout(prepTimer.current)
    prepTimer.current = setTimeout(async () => {
      const parsed = parseInt(val, 10)
      if (isNaN(parsed) || parsed < 1 || parsed > 120) return
      setPrepSave('saving')
      try { const updated = await patch({ prep_time_minutes: parsed }); setSettings(updated); setPrepSave('saved'); setTimeout(() => setPrepSave('idle'), 1500) }
      catch { setPrepSave('error') }
    }, 700)
  }

  // ── Logo ───────────────────────────────────────────────────────
  async function handleToggle() {
    if (!settings || toggleBusy) return
    const next = !settings.is_open
    setSettings(s => s ? { ...s, is_open: next } : s); setToggleBusy(true)
    try { const u = await patch({ is_open: next }); setSettings(u) }
    catch { setSettings(s => s ? { ...s, is_open: !next } : s) }
    finally { setToggleBusy(false) }
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    setLogoUploading(true); setLogoError(null)
    try {
      const { error: uploadError } = await supabase.storage.from('brand').upload('logos/logo', file, { upsert: true, contentType: file.type })
      if (uploadError) throw new Error(uploadError.message)
      const { data: { publicUrl } } = supabase.storage.from('brand').getPublicUrl('logos/logo')
      const u = await patch({ logo_url: `${publicUrl}?t=${Date.now()}` }); setSettings(u)
    } catch (err) { setLogoError(err instanceof Error ? err.message : 'Upload failed') }
    finally { setLogoUploading(false); e.target.value = '' }
  }

  if (loading) return (
    <div className="min-h-screen bg-zinc-950 text-white flex">
      <AdminSidebar />
      <main className="flex-1 flex items-center justify-center"><Loader2 className="w-8 h-8 text-zinc-600 animate-spin" /></main>
    </div>
  )

  const killOn = settings?.is_accepting_orders ?? true

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex">
      <AdminSidebar />

      <main className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center px-8 py-5 border-b border-zinc-800 bg-zinc-900/50">
          <div>
            <h1 className="text-xl font-bold text-white">Store Settings</h1>
            <p className="text-sm text-zinc-500 mt-0.5">Operations, contact info, hours, and availability</p>
          </div>
        </header>

        <div className="flex-1 px-8 py-8 overflow-auto">
          <div className="max-w-2xl space-y-5">

            {/* ── Emergency Kill Switch ── */}
            <div className={`rounded-2xl border p-6 transition-colors ${killOn ? 'bg-zinc-900 border-zinc-800' : 'bg-red-950/30 border-red-800/60'}`}>
              <div className="flex items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${killOn ? 'bg-emerald-500/15' : 'bg-red-500/20'}`}>
                    <AlertTriangle className={`w-6 h-6 ${killOn ? 'text-emerald-400' : 'text-red-400'}`} />
                  </div>
                  <div>
                    <p className="text-base font-bold text-white">Emergency Kill Switch</p>
                    <p className={`text-sm font-medium mt-0.5 ${killOn ? 'text-emerald-400' : 'text-red-400'}`}>
                      {killOn ? 'Accepting orders' : '🛑 Orders paused — checkout disabled'}
                    </p>
                  </div>
                </div>
                <button
                  role="switch" aria-checked={killOn} onClick={handleKillSwitch} disabled={killBusy}
                  className={`relative inline-flex h-9 w-16 shrink-0 cursor-pointer rounded-full transition-colors duration-200 disabled:opacity-50 focus:outline-none ${killOn ? 'bg-emerald-500' : 'bg-red-600'}`}
                >
                  <span className={`inline-block h-7 w-7 mt-1 transform rounded-full bg-white shadow-lg transition-transform duration-200 ${killOn ? 'translate-x-8' : 'translate-x-1'}`} />
                </button>
              </div>
              {!killOn && (
                <div className="mt-4 flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                  <X className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                  <p className="text-sm text-red-300 leading-snug">
                    Checkout is disabled site-wide. Customers see a "currently closed" banner. Business hours still apply when orders are re-enabled.
                  </p>
                </div>
              )}
            </div>

            {/* ── Contact Info ── */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
              <div className="flex items-center gap-4 mb-5">
                <div className="w-12 h-12 rounded-xl bg-sky-500/15 flex items-center justify-center shrink-0">
                  <Phone className="w-6 h-6 text-sky-400" />
                </div>
                <div>
                  <p className="text-base font-semibold text-white">Contact Information</p>
                  <p className="text-sm text-zinc-500 mt-0.5">Displayed in footer and customer emails · auto-saves</p>
                </div>
              </div>
              <div className="space-y-3">
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input type="tel" value={contactPhone} onChange={e => handleContactChange('contact_phone', e.target.value)}
                    placeholder="Phone (e.g. 01737 123456)"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-brand-red" />
                </div>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input type="email" value={contactEmail} onChange={e => handleContactChange('contact_email', e.target.value)}
                    placeholder="Email (e.g. info@chickentime.co.uk)"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-brand-red" />
                </div>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 w-4 h-4 text-zinc-500" />
                  <textarea value={storeAddress} onChange={e => handleContactChange('store_address', e.target.value)}
                    placeholder="Store address (e.g. 12 High Street, Reigate, Surrey RH2 9AZ)"
                    rows={2}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-brand-red resize-none" />
                </div>
              </div>
            </div>

            {/* ── Weekly Schedule ── */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
              <div className="flex items-center justify-between gap-4 mb-5">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-violet-500/15 flex items-center justify-center shrink-0">
                    <Clock className="w-6 h-6 text-violet-400" />
                  </div>
                  <div>
                    <p className="text-base font-semibold text-white">Weekly Schedule</p>
                    <p className="text-sm text-zinc-500 mt-0.5">Controls automatic open/close times</p>
                  </div>
                </div>
                <button
                  onClick={saveHours} disabled={hoursSave === 'saving'}
                  className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
                >
                  {hoursSave === 'saving' ? <Loader2 className="w-4 h-4 animate-spin" /> : hoursSave === 'saved' ? <Check className="w-4 h-4" /> : <Settings className="w-4 h-4" />}
                  {hoursSave === 'saved' ? 'Saved' : 'Save Hours'}
                </button>
              </div>
              <div className="space-y-2">
                {DAYS.map(day => {
                  const h = hours[day]
                  return (
                    <div key={day} className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors ${h.enabled ? 'bg-zinc-800/50 border-zinc-700/50' : 'bg-zinc-900 border-zinc-800/30 opacity-60'}`}>
                      <button
                        onClick={() => updateDay(day, 'enabled', !h.enabled)}
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${h.enabled ? 'bg-violet-600 border-violet-600' : 'border-zinc-600'}`}
                      >
                        {h.enabled && <Check className="w-3 h-3 text-white" />}
                      </button>
                      <span className="text-sm font-medium text-white w-24 shrink-0">{DAY_LABELS[day]}</span>
                      {h.enabled ? (
                        <div className="flex items-center gap-2 ml-auto">
                          <input type="time" value={h.open} onChange={e => updateDay(day, 'open', e.target.value)}
                            className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500" />
                          <span className="text-zinc-500 text-sm">–</span>
                          <input type="time" value={h.close} onChange={e => updateDay(day, 'close', e.target.value)}
                            className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500" />
                        </div>
                      ) : (
                        <span className="ml-auto text-xs text-zinc-600 italic">Closed</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* ── Holiday Overrides ── */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
              <div className="flex items-center gap-4 mb-5">
                <div className="w-12 h-12 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0">
                  <Calendar className="w-6 h-6 text-amber-400" />
                </div>
                <div>
                  <p className="text-base font-semibold text-white">Holiday Closures</p>
                  <p className="text-sm text-zinc-500 mt-0.5">Full-day closures for specific dates</p>
                </div>
              </div>

              {holidays.length > 0 && (
                <div className="space-y-2 mb-4">
                  {holidays.map(h => (
                    <div key={h.date} className="flex items-center justify-between gap-3 bg-zinc-800/50 border border-zinc-700/40 rounded-xl px-4 py-2.5">
                      <div>
                        <p className="text-sm font-semibold text-white">{h.date}</p>
                        {h.note && <p className="text-xs text-zinc-500">{h.note}</p>}
                      </div>
                      <button onClick={() => removeHoliday(h.date)} className="p-1.5 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)}
                  className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/60" />
                <input type="text" value={newNote} onChange={e => setNewNote(e.target.value)}
                  placeholder="Note (e.g. Christmas Day)"
                  className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-amber-500/60" />
                <button onClick={addHoliday} disabled={!newDate || holidaySaving}
                  className="flex items-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-black text-sm font-semibold rounded-lg transition-colors">
                  {holidaySaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* ── Store Open Toggle (manual override) ── */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
              <div className="flex items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-colors ${settings?.is_open ? 'bg-emerald-500/15' : 'bg-red-500/15'}`}>
                    <Store className={`w-6 h-6 ${settings?.is_open ? 'text-emerald-400' : 'text-red-400'}`} />
                  </div>
                  <div>
                    <p className="text-base font-semibold text-white">Manual Open Override</p>
                    <p className={`text-sm font-medium mt-0.5 ${settings?.is_open ? 'text-emerald-400' : 'text-red-400'}`}>
                      {settings?.is_open ? 'Open' : 'Manually closed'}
                    </p>
                  </div>
                </div>
                <button role="switch" aria-checked={settings?.is_open} onClick={handleToggle} disabled={toggleBusy}
                  className={`relative inline-flex h-8 w-14 shrink-0 cursor-pointer rounded-full transition-colors duration-200 disabled:opacity-50 focus:outline-none ${settings?.is_open ? 'bg-emerald-500' : 'bg-zinc-700'}`}>
                  <span className={`inline-block h-6 w-6 mt-1 transform rounded-full bg-white shadow transition-transform duration-200 ${settings?.is_open ? 'translate-x-7' : 'translate-x-1'}`} />
                </button>
              </div>
            </div>

            {/* ── Prep Time ── */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
              <div className="flex items-center gap-4 mb-5">
                <div className="w-12 h-12 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0">
                  <Clock className="w-6 h-6 text-amber-400" />
                </div>
                <div>
                  <p className="text-base font-semibold text-white">Estimated Wait Time</p>
                  <p className="text-sm text-zinc-500 mt-0.5">Shown to customers on the storefront</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <input type="number" min={1} max={120} value={prepValue} onChange={handlePrepChange}
                  className="w-24 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-2xl font-bold text-white text-center focus:outline-none focus:ring-2 focus:ring-brand-red [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
                <span className="text-zinc-400 text-base font-medium">minutes</span>
                <div className="ml-2">
                  {prepSave === 'saving' && <Loader2 className="w-4 h-4 text-zinc-500 animate-spin" />}
                  {prepSave === 'saved'  && <Check className="w-4 h-4 text-emerald-400" />}
                  {prepSave === 'error'  && <X className="w-4 h-4 text-red-400" />}
                </div>
              </div>
              <p className="text-xs text-zinc-600 mt-3">Auto-saves · 1–120 minutes</p>
            </div>

            {/* ── Logo ── */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
              <div className="flex items-center gap-4 mb-5">
                <div className="w-12 h-12 rounded-xl bg-blue-500/15 flex items-center justify-center shrink-0">
                  <UploadCloud className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <p className="text-base font-semibold text-white">Brand Logo</p>
                  <p className="text-sm text-zinc-500 mt-0.5">Shown in the header and receipts</p>
                </div>
              </div>
              <div className="flex items-center gap-6 mb-4">
                <div className="w-32 h-16 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center overflow-hidden shrink-0">
                  <Image src={settings?.logo_url ?? '/chicken-time-logo_v1.png'} alt="Brand logo" width={128} height={64}
                    className="object-contain w-full h-full p-1" unoptimized={!!settings?.logo_url} />
                </div>
                <label className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-colors ${logoUploading ? 'bg-zinc-700 text-zinc-400 cursor-not-allowed' : 'bg-zinc-800 hover:bg-zinc-700 text-white'}`}>
                  {logoUploading ? <><Loader2 className="w-4 h-4 animate-spin" /> Uploading…</> : <><UploadCloud className="w-4 h-4" /> Upload logo</>}
                  <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" disabled={logoUploading} onChange={handleLogoUpload} />
                </label>
              </div>
              {logoError && <div className="flex items-center gap-2 text-xs text-red-400"><X className="w-3.5 h-3.5 shrink-0" />{logoError}</div>}
            </div>

          </div>
        </div>
      </main>
    </div>
  )
}
