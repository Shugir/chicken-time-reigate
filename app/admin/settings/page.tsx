'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Settings,
  Loader2,
  Check,
  X,
  Clock,
  Store,
  UploadCloud,
} from 'lucide-react'
import Image from 'next/image'
import { createBrowserClient } from '@supabase/ssr'
import AdminSidebar from '@/components/admin/admin-sidebar'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

interface StoreSettings {
  id: number
  is_open: boolean
  prep_time_minutes: number
  logo_url: string | null
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export default function SettingsPage() {
  const [settings, setSettings]   = useState<StoreSettings | null>(null)
  const [loading, setLoading]     = useState(true)
  const [toggleBusy, setToggleBusy]   = useState(false)
  const [prepSave, setPrepSave]       = useState<SaveState>('idle')
  const [prepValue, setPrepValue]     = useState('')
  const prepTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [logoUploading, setLogoUploading] = useState(false)
  const [logoError, setLogoError]         = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/store-settings')
      .then((r) => r.json())
      .then((data: StoreSettings) => {
        setSettings(data)
        setPrepValue(String(data.prep_time_minutes))
        setLoading(false)
      })
  }, [])

  async function patch(body: Partial<StoreSettings>) {
    const res = await fetch('/api/admin/store-settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error('Save failed')
    return res.json() as Promise<StoreSettings>
  }

  async function handleToggle() {
    if (!settings || toggleBusy) return
    const next = !settings.is_open
    setSettings((s) => s ? { ...s, is_open: next } : s)
    setToggleBusy(true)
    try {
      const updated = await patch({ is_open: next })
      setSettings(updated)
    } catch {
      setSettings((s) => s ? { ...s, is_open: !next } : s)
    } finally {
      setToggleBusy(false)
    }
  }

  function handlePrepChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setPrepValue(val)
    setPrepSave('idle')
    if (prepTimer.current) clearTimeout(prepTimer.current)
    prepTimer.current = setTimeout(async () => {
      const parsed = parseInt(val, 10)
      if (isNaN(parsed) || parsed < 1 || parsed > 120) return
      setPrepSave('saving')
      try {
        const updated = await patch({ prep_time_minutes: parsed })
        setSettings(updated)
        setPrepSave('saved')
        setTimeout(() => setPrepSave('idle'), 1500)
      } catch {
        setPrepSave('error')
      }
    }, 700)
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoUploading(true)
    setLogoError(null)
    try {
      const { error: uploadError } = await supabase.storage
        .from('brand')
        .upload('logos/logo', file, { upsert: true, contentType: file.type })
      if (uploadError) throw new Error(uploadError.message)
      const { data: { publicUrl } } = supabase.storage.from('brand').getPublicUrl('logos/logo')
      const logoUrl = `${publicUrl}?t=${Date.now()}`
      const updated = await patch({ logo_url: logoUrl })
      setSettings(updated)
    } catch (err) {
      setLogoError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setLogoUploading(false)
      e.target.value = ''
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex">
      <AdminSidebar />

      {/* ── Main ── */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center px-8 py-5 border-b border-zinc-800 bg-zinc-900/50">
          <div>
            <h1 className="text-xl font-bold text-white">Store Settings</h1>
            <p className="text-sm text-zinc-500 mt-0.5">Control store availability and wait times</p>
          </div>
        </header>

        <div className="flex-1 px-8 py-8">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 text-zinc-600 animate-spin" />
            </div>
          ) : settings ? (
            <div className="max-w-xl space-y-5">

              {/* ── Store Open Toggle ── */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                <div className="flex items-center justify-between gap-6">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-colors
                      ${settings.is_open ? 'bg-emerald-500/15' : 'bg-red-500/15'}`}>
                      <Store className={`w-6 h-6 ${settings.is_open ? 'text-emerald-400' : 'text-red-400'}`} />
                    </div>
                    <div>
                      <p className="text-base font-semibold text-white">Store Open / Accepting Orders</p>
                      <p className={`text-sm font-medium mt-0.5 ${settings.is_open ? 'text-emerald-400' : 'text-red-400'}`}>
                        {settings.is_open ? 'Open — customers can place orders' : 'Closed — orders are disabled'}
                      </p>
                    </div>
                  </div>

                  {/* Big toggle */}
                  <button
                    role="switch"
                    aria-checked={settings.is_open}
                    onClick={handleToggle}
                    disabled={toggleBusy}
                    className={`relative inline-flex h-8 w-14 shrink-0 cursor-pointer rounded-full transition-colors duration-200
                      focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-red focus-visible:ring-offset-2
                      focus-visible:ring-offset-zinc-900 disabled:opacity-50
                      ${settings.is_open ? 'bg-emerald-500' : 'bg-zinc-700'}`}
                  >
                    <span className={`inline-block h-6 w-6 mt-1 transform rounded-full bg-white shadow transition-transform duration-200
                      ${settings.is_open ? 'translate-x-7' : 'translate-x-1'}`} />
                  </button>
                </div>

                {!settings.is_open && (
                  <div className="mt-5 flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                    <X className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                    <p className="text-sm text-red-300 leading-snug">
                      Storefront will show a "Currently Closed" banner and checkout will be disabled.
                    </p>
                  </div>
                )}
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
                  <div className="relative">
                    <input
                      type="number"
                      min={1}
                      max={120}
                      value={prepValue}
                      onChange={handlePrepChange}
                      className="w-24 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-2xl font-bold text-white text-center
                                 focus:outline-none focus:ring-2 focus:ring-brand-red focus:border-brand-red
                                 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                  <span className="text-zinc-400 text-base font-medium">minutes</span>
                  <div className="ml-2">
                    {prepSave === 'saving' && <Loader2 className="w-4 h-4 text-zinc-500 animate-spin" />}
                    {prepSave === 'saved'  && <Check className="w-4 h-4 text-emerald-400" />}
                    {prepSave === 'error'  && <X className="w-4 h-4 text-red-400" />}
                  </div>
                </div>
                <p className="text-xs text-zinc-600 mt-3">Saves automatically · 1–120 minutes</p>
              </div>

              {/* ── Brand Logo ── */}
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

                <div className="flex items-center gap-6 mb-5">
                  <div className="w-32 h-16 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center overflow-hidden shrink-0">
                    <Image
                      src={settings.logo_url ?? '/chicken-time-logo_v1.png'}
                      alt="Brand logo preview"
                      width={128}
                      height={64}
                      className="object-contain w-full h-full p-1"
                      unoptimized={!!settings.logo_url}
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-zinc-500 mb-2">PNG, JPEG or WebP · max 2 MB</p>
                    <label className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-colors
                      ${logoUploading ? 'bg-zinc-700 text-zinc-400 cursor-not-allowed' : 'bg-zinc-800 hover:bg-zinc-700 text-white'}`}>
                      {logoUploading ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Uploading…</>
                      ) : (
                        <><UploadCloud className="w-4 h-4" /> Upload logo</>
                      )}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="sr-only"
                        disabled={logoUploading}
                        onChange={handleLogoUpload}
                      />
                    </label>
                  </div>
                </div>

                {logoError && (
                  <div className="flex items-center gap-2 text-xs text-red-400 mt-1">
                    <X className="w-3.5 h-3.5 shrink-0" />
                    {logoError}
                  </div>
                )}
              </div>

            </div>
          ) : (
            <p className="text-zinc-500">Failed to load settings.</p>
          )}
        </div>
      </main>
    </div>
  )
}
