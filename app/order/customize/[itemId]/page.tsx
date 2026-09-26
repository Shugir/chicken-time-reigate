'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, ShoppingBag, TriangleAlert } from 'lucide-react'
import { EMPTY_SELECTION, type ModifierSelection } from '@/components/Menu/ModifierForm'
import GroupedCustomizer from '@/components/Menu/GroupedCustomizer'
import QtyStepper from '@/components/Menu/QtyStepper'
import SelectionReceipt from '@/components/Menu/SelectionReceipt'
import { customizerLayout, receiptLines, receiptTotals } from '@/lib/customizer-layout'
import { dbToMenuItem, itemConfig, lineUnitPrice, type DbMenuItem, type MenuItem } from '@/lib/menu-items'
import { queueCartLine } from '@/lib/use-cart'
import { applyPreset, presetPayload, vatIncluded, PRESETS_PER_ITEM_MAX, type PresetPayload, type SavedPreset } from '@/lib/presets'
import { supabase } from '@/lib/supabase-browser'
import toast from 'react-hot-toast'
import PresetBar, { SavePresetControl } from '@/components/Menu/PresetBar'

/** Number of individual choices in a selection, to tell whether applying a preset dropped any */
const choiceCount = (s: Partial<PresetPayload>) =>
  (s.spicy ? 1 : 0) + (s.removals?.length ?? 0) + (s.additions?.length ?? 0) + (s.extras?.length ?? 0)

/** sessionStorage key for the build stashed while the visitor signs in */
const draftKey = (itemId: string) => `customizerDraft:${itemId}`

const PRESET_LIMIT_MSG = `You can save up to ${PRESETS_PER_ITEM_MAX} presets for this item.`

export default function CustomizeItemPage() {
  const { itemId } = useParams<{ itemId: string }>()
  const router = useRouter()
  const [item, setItem] = useState<MenuItem | null>(null)
  const [qty, setQty] = useState(1)
  const [selection, setSelection] = useState<ModifierSelection>(EMPTY_SELECTION)
  const [notes, setNotes] = useState('')
  // Blocks a second Add tap while navigation is in flight (it would queue the line twice)
  const adding = useRef(false)
  // Display-only VAT rate; null (no line) when the store has it off or the fetch fails
  const [vatRate, setVatRate] = useState<number | null>(null)
  // null until the session check settles, so the sign-in link doesn't flash for signed-in users
  const [signedIn, setSignedIn] = useState<boolean | null>(null)
  const [presets, setPresets] = useState<SavedPreset[]>([])

  const loadPresets = useCallback(async () => {
    const { data, error } = await supabase
      .from('item_presets')
      .select('id, name, selection, notes, qty')
      .eq('menu_item_id', itemId)
      .order('created_at')
    if (error) console.error('Failed to load presets:', error)
    setPresets((data ?? []) as SavedPreset[])
  }, [itemId])

  useEffect(() => {
    supabase.auth.getSession().then(
      ({ data }) => {
        setSignedIn(!!data.session)
        if (data.session) loadPresets()
      },
      // Any session error: treat the visitor as signed out
      () => setSignedIn(false),
    )
  }, [loadPresets])

  useEffect(() => {
    fetch('/api/store-settings')
      .then((res) => (res.ok ? res.json() : null))
      .then((s: { show_vat?: boolean; vat_rate?: number | string } | null) => {
        // numeric arrives from Postgres as a string ("20.00")
        const rate = Number(s?.vat_rate)
        if (s?.show_vat === true && Number.isFinite(rate)) setVatRate(rate)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch('/api/menu-items')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json() as Promise<DbMenuItem[]>
      })
      .then((rows) => {
        if (cancelled) return
        const row = rows.find((r) => r.id === itemId)
        // Unknown id or sold out: nothing to customize here
        if (!row || !row.is_available) {
          toast('That item isn’t available right now.', { id: 'customize-unavailable' })
          return router.replace('/order')
        }
        const loaded = dbToMenuItem(row)
        setItem(loaded)
        // Returning from "Sign in to save presets": restore the stashed build, re-validated like a preset
        try {
          const key = draftKey(itemId)
          const raw = sessionStorage.getItem(key)
          if (!raw) return
          sessionStorage.removeItem(key)
          const draft = JSON.parse(raw) as { selection: ModifierSelection; notes: string | null; qty: number }
          const applied = applyPreset(itemConfig(loaded), loaded.sold_out_extras, {
            selection: presetPayload(draft.selection), notes: draft.notes, qty: draft.qty,
          })
          setSelection(applied.selection)
          setNotes(applied.notes)
          setQty(applied.qty)
        } catch {
          // Storage blocked or a malformed draft: start from the default build
        }
      })
      .catch((err) => {
        console.error('Failed to load menu item:', err)
        if (cancelled) return
        toast.error('Couldn’t load that item. Please try again.', { id: 'customize-load-failed' })
        router.replace('/order')
      })
    return () => { cancelled = true }
  }, [itemId, router])

  const goBack = () => (window.history.length > 1 ? router.back() : router.push('/order'))

  if (!item) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 animate-pulse" role="status" aria-busy="true" aria-label="Loading item">
        <div className="h-5 w-32 bg-zinc-100 rounded mb-6" />
        <div className="grid lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 space-y-4">
            <div className="h-64 bg-zinc-100 rounded-3xl" />
            <div className="h-40 bg-zinc-100 rounded-2xl" />
          </div>
          <div className="lg:col-span-4 h-72 bg-zinc-100 rounded-2xl" />
        </div>
      </div>
    )
  }

  const config = itemConfig(item)
  const layout = customizerLayout(config)
  const lines = receiptLines(layout, config, selection, notes)
  // Same function the cart uses, so page total == cart total == checkout
  const unit = lineUnitPrice(item, { spicy_level: selection.spicy ?? undefined, extras: selection.extras })
  const total = unit * qty
  const isOffer = item.compare_at_price != null && item.compare_at_price > item.price
  const badges = [...new Set([item.badge, ...(item.dietaryFlags ?? [])])].filter((b): b is string => !!b)
  const receiptNumber = String(layout.length + 2).padStart(2, '0')
  const vat = vatRate == null
    ? undefined
    : { rate: vatRate, amount: vatIncluded(receiptTotals(item.price, unit, qty).subtotal, vatRate) }

  const handleAdd = () => {
    if (adding.current) return
    adding.current = true
    try {
      queueCartLine(sessionStorage, item.id, {
        spicy_level: selection.spicy ?? undefined,
        removals: selection.removals,
        additions: selection.additions,
        extras: selection.extras,
        notes: notes.trim() || undefined,
      }, qty)
    } catch {
      // sessionStorage itself throws when site data is blocked: the line can't be queued
    }
    // replace, so browser Back from /order doesn't reopen this page
    router.replace('/order')
  }

  const handleReset = () => {
    setSelection(EMPTY_SELECTION)
    setNotes('')
    setQty(1)
  }

  const handleApplyPreset = (preset: SavedPreset) => {
    const applied = applyPreset(config, item.sold_out_extras, preset)
    setSelection(applied.selection)
    setNotes(applied.notes)
    setQty(applied.qty)
    const saved = preset.selection && typeof preset.selection === 'object' ? preset.selection : {}
    toast.success(choiceCount(applied.selection) < choiceCount(saved)
      ? 'Preset applied — some options are no longer available'
      : 'Preset applied')
  }

  const handleDeletePreset = async (preset: SavedPreset) => {
    const { error } = await supabase.from('item_presets').delete().eq('id', preset.id)
    if (error) {
      console.error('Failed to delete preset:', error)
      toast.error('Could not delete preset.')
    }
    await loadPresets()
  }

  const handleSavePreset = async (name: string): Promise<boolean> => {
    // The UI already hides Save at the limit; this guards a stale list
    if (presets.length >= PRESETS_PER_ITEM_MAX && !presets.some((p) => p.name === name)) {
      toast.error(PRESET_LIMIT_MSG)
      return false
    }
    const { error } = await supabase.from('item_presets').upsert(
      { menu_item_id: item.id, name, selection: presetPayload(selection), notes: notes.trim() || null, qty },
      { onConflict: 'user_id,menu_item_id,name' },
    )
    if (error) {
      console.error('Failed to save preset:', error)
      // The DB trigger (20260926c) enforces the limit even when the local list is stale
      toast.error(error.message?.includes('preset limit reached') ? PRESET_LIMIT_MSG : 'Could not save preset. Please try again.')
      return false
    }
    toast.success('Preset saved')
    await loadPresets()
    return true
  }

  const presetControl = signedIn == null
    ? undefined
    : (
      <SavePresetControl
        signedIn={signedIn}
        presets={presets}
        onSave={handleSavePreset}
        itemId={item.id}
        onSignIn={() => {
          try {
            sessionStorage.setItem(draftKey(item.id), JSON.stringify({ selection, notes, qty }))
          } catch {
            // Storage blocked: sign-in still works, the build just isn't restored
          }
        }}
      />
    )

  const receipt = (showActions: boolean) => (
    <SelectionReceipt
      number={receiptNumber}
      itemName={item.name}
      basePrice={item.price}
      unit={unit}
      qty={qty}
      onQtyChange={setQty}
      lines={lines}
      onAdd={handleAdd}
      onReset={handleReset}
      showActions={showActions}
      vat={vat}
      presetControl={presetControl}
    />
  )

  return (
    <div className="bg-white min-h-screen">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 pb-32 lg:pb-12">
        <button
          onClick={goBack}
          className="min-h-[44px] inline-flex items-center gap-2 text-sm font-medium text-zinc-500 hover:text-zinc-900 transition-colors mb-4"
        >
          <ArrowLeft size={16} /> Back to menu
        </button>

        <div className="grid lg:grid-cols-12 gap-8 items-start">
          {/* Left: hero + numbered groups */}
          <div className="lg:col-span-8 space-y-6 min-w-0">
            <header className="grid sm:grid-cols-2 gap-5 items-center">
              <div className="relative aspect-[4/3] rounded-3xl overflow-hidden bg-zinc-100">
                <Image src={item.image} alt={item.name} fill priority sizes="(max-width: 640px) 100vw, 400px" className="object-cover" />
                {isOffer && (
                  <div className="absolute top-0 right-0 bg-brand-red text-white text-[11px] font-black px-3 py-2 rounded-bl-2xl shadow-lg">
                    🔥 OFFER
                  </div>
                )}
              </div>
              <div>
                {badges.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {badges.map((b) => (
                      <span key={b} className="rounded-md px-2 py-0.5 bg-brand-red/10 text-brand-red text-[11px] font-bold uppercase">
                        {b}
                      </span>
                    ))}
                  </div>
                )}
                <h1 className="font-heading font-black text-3xl text-zinc-900 leading-tight">{item.name}</h1>
                {item.description && <p className="text-sm text-zinc-500 mt-2 leading-relaxed">{item.description}</p>}
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span>
                    {isOffer && (
                      <span className="text-sm text-zinc-400 line-through mr-2">£{item.compare_at_price!.toFixed(2)}</span>
                    )}
                    <span className={`text-2xl font-heading font-black ${isOffer ? 'text-brand-red' : 'text-zinc-900'}`}>
                      £{item.price.toFixed(2)}
                    </span>
                  </span>
                  <span className="rounded-md bg-zinc-100 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-zinc-500">
                    Base meal price <span className="tabular-nums text-zinc-700">£{item.price.toFixed(2)}</span>
                  </span>
                </div>
                {item.allergens.length > 0 && (
                  <p className="flex items-center gap-1.5 mt-3 px-2.5 py-1.5 rounded-md bg-amber-50 text-amber-800 text-xs font-medium w-fit">
                    <TriangleAlert size={12} className="shrink-0" />
                    Contains: {item.allergens.join(', ')}
                  </p>
                )}
              </div>
            </header>

            {signedIn && presets.length > 0 && (
              <PresetBar presets={presets} onApply={handleApplyPreset} onDelete={handleDeletePreset} />
            )}

            <GroupedCustomizer
              layout={layout}
              config={config}
              value={selection}
              onChange={setSelection}
              notes={notes}
              onNotesChange={setNotes}
              soldOut={item.sold_out_extras}
            />

            {/* Mobile: the receipt sits below the groups; the sticky bar below carries Add */}
            <div className="lg:hidden">{receipt(false)}</div>
          </div>

          {/* Desktop: sticky receipt with Add / Reset */}
          <div className="hidden lg:block lg:col-span-4 lg:sticky lg:top-6 self-start">{receipt(true)}</div>
        </div>
      </div>

      {/* Mobile sticky bottom bar */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-zinc-100 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex items-center gap-3">
        <QtyStepper value={qty} onChange={setQty} label={item.name} min={1} max={99} />
        <button
          onClick={handleAdd}
          aria-label={`Add ${qty} × ${item.name} to order, £${total.toFixed(2)}`}
          className="flex-1 min-w-0 min-h-[44px] font-bold text-sm sm:text-base py-4 rounded-2xl flex items-center justify-center gap-1.5 px-3 transition-all bg-brand-red hover:bg-red-700 active:scale-[0.98] text-white shadow-lg shadow-red-900/20"
        >
          <ShoppingBag size={18} className="shrink-0" />
          {/* Only the words may truncate; the price always shows in full */}
          <span className="truncate">Add +</span>
          <span className="shrink-0 tabular-nums">£{total.toFixed(2)}</span>
        </button>
      </div>
    </div>
  )
}
