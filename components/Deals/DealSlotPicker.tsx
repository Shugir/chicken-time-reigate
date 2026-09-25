'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import { Check, ChevronDown, Plus, X } from 'lucide-react'
import ModifierForm, { EMPTY_SELECTION, type ModifierSelection } from '@/components/Menu/ModifierForm'
import QtyStepper from '@/components/Menu/QtyStepper'
import { slotQty, isSelectionComplete, upgradesTotal } from './deal-slot-picker-logic'
import { inSlot, matchDeals, type BundleUpgrades } from '@/lib/deal-engine'
import { formatExtra, spicyPrice, toModifierConfig, unitPrice, type ModifierConfig, type SelectedExtra } from '@/lib/order-modifiers'

interface SlotItem {
  id: string
  name: string
  price: number
  image_url: string | null
  category: string
  extras: { name: string; price: number }[] | null
  removals: string[] | null
  additions: string[] | null
  modifiers?: ModifierConfig
}

interface Pick {
  item_id: string
  qty: number
  spicy_level?: string
  removals: string[]
  additions: string[]
  extras: SelectedExtra[]
  notes?: string
}

interface Upgrade { item_id: string; qty: number }

/** One picked unit. Each tap adds its own entry so units can carry different options. */
interface PickUnit { uid: string; item_id: string; selection: ModifierSelection; notes: string }

interface Group { label: string; min_qty: number; max_qty: number; item_ids?: string[]; category?: string }

interface Deal {
  id: string
  name: string
  config: { groups: Group[]; price: number; price_type?: 'fixed' | 'percent'; discount_percent?: number; upgrades?: BundleUpgrades }
}

interface Props {
  deal: Deal
  itemsById: Map<string, SlotItem>
  onClose: () => void
  onComplete: (picks: Pick[], upgrades: Upgrade[]) => void
}

const hasOptions = (c: ModifierConfig) =>
  Boolean(c.spicyLevels.length || c.ingredients.length || c.additions.length || c.categories.length)

const toPick = (u: PickUnit): Pick => ({
  item_id: u.item_id,
  qty: 1,
  spicy_level: u.selection.spicy ?? undefined,
  removals: u.selection.removals,
  additions: u.selection.additions,
  extras: u.selection.extras,
  notes: u.notes.trim(),
})

/** "Spicy: Hot · No Lettuce · Coke ×2 · “no onions”", or '' when nothing is chosen. */
function summarise(u: PickUnit): string {
  const s = u.selection
  const note = u.notes.trim()
  return [
    ...(s.spicy ? [`Spicy: ${s.spicy}`] : []),
    ...s.removals.map((r) => `No ${r}`),
    ...s.additions,
    ...s.extras.map(formatExtra),
    ...(note ? [`“${note}”`] : []),
  ].join(' · ')
}

export default function DealSlotPicker({ deal, itemsById, onClose, onComplete }: Props) {
  const [visible, setVisible] = useState(false)
  // picks[groupIndex] is one entry per picked unit
  const [picks, setPicks] = useState<Record<number, PickUnit[]>>({})
  const [expanded, setExpanded] = useState<string | null>(null)
  const [upgradeQty, setUpgradeQty] = useState<Record<string, number>>({})
  const panelRef = useRef<HTMLDivElement>(null)
  const nextUid = useRef(0)

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true))
    panelRef.current?.focus()
    document.body.style.overflow = 'hidden'
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      cancelAnimationFrame(id)
      document.body.style.overflow = ''
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  // Rows that predate Phase 1 have no `modifiers`; the contract's legacy fallback
  // turns their flat removals/extras into the same shape.
  const configs = useMemo(
    () => new Map(
      Array.from(itemsById.values()).map((it) => [
        it.id,
        it.modifiers ?? toModifierConfig({ removals: it.removals, additions: it.additions, extras: it.extras }),
      ]),
    ),
    [itemsById],
  )

  const upgradeItems = useMemo(
    () => (deal.config.upgrades?.item_ids ?? []).map((id) => itemsById.get(id)).filter((i): i is SlotItem => Boolean(i)),
    [deal.config.upgrades, itemsById],
  )

  const slotCount = (gi: number) => slotQty((picks[gi] ?? []).map(toPick))

  function addPick(gi: number, item: SlotItem) {
    if (slotCount(gi) >= deal.config.groups[gi].max_qty) return
    const uid = `u${nextUid.current++}`
    setPicks((prev) => ({ ...prev, [gi]: [...(prev[gi] ?? []), { uid, item_id: item.id, selection: EMPTY_SELECTION, notes: '' }] }))
    if (hasOptions(configs.get(item.id)!)) setExpanded(uid)
  }

  function removePick(gi: number, uid: string) {
    setPicks((prev) => ({ ...prev, [gi]: (prev[gi] ?? []).filter((p) => p.uid !== uid) }))
    setExpanded((e) => (e === uid ? null : e))
  }

  function updatePick(gi: number, uid: string, patch: { selection?: ModifierSelection; notes?: string }) {
    setPicks((prev) => ({ ...prev, [gi]: (prev[gi] ?? []).map((p) => (p.uid === uid ? { ...p, ...patch } : p)) }))
  }

  const units = Object.values(picks).flat()
  const allComplete = isSelectionComplete(deal.config.groups, Object.fromEntries(
    deal.config.groups.map((_, gi) => [gi, (picks[gi] ?? []).map(toPick)]),
  ))
  const isPercent = deal.config.price_type === 'percent'
  const itemsSum = units.reduce((s, u) => s + (itemsById.get(u.item_id)?.price ?? 0), 0)
  // Ask the checkout engine itself: it bundles only min_qty items per slot, so picks
  // beyond min_qty (up to max_qty) stay full price and must not show as discounted.
  const bundleSavings = allComplete
    ? matchDeals(
        units.map((u) => ({ menu_item_id: u.item_id, quantity: 1 })),
        [{ id: deal.id, type: 'bundle', name: deal.name, config: deal.config, is_active: true }],
        new Map(Array.from(itemsById.values()).map((i) => [i.id, { id: i.id, price: i.price, category: i.category, is_available: true }])),
      ).totalDiscount
    : 0
  const extrasSum = units.reduce((s, u) => {
    const base = itemsById.get(u.item_id)?.price ?? 0
    return s + (unitPrice(base + spicyPrice(configs.get(u.item_id)?.spicyLevels, u.selection.spicy), u.selection.extras) - base)
  }, 0)
  const upgradesSum = upgradesTotal(
    upgradeItems.filter((i) => upgradeQty[i.id] > 0).map((i) => ({ price: i.price, qty: upgradeQty[i.id] })),
  )
  const total = itemsSum - bundleSavings + extrasSum + upgradesSum

  function handleSubmit() {
    onComplete(
      units.map(toPick),
      upgradeItems.filter((i) => upgradeQty[i.id] > 0).map((i) => ({ item_id: i.id, qty: upgradeQty[i.id] })),
    )
  }

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity duration-200 ${visible ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Phone: bottom sheet. Desktop: centered card. */}
      <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-5" onClick={onClose}>
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label={`Build ${deal.name}`}
          tabIndex={-1}
          onClick={(e) => e.stopPropagation()}
          className={`w-full sm:max-w-[560px] bg-white rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92dvh] sm:max-h-[90vh] outline-none transition-all duration-200 ${
            visible ? 'opacity-100 translate-y-0 sm:scale-100' : 'opacity-0 translate-y-8 sm:translate-y-3 sm:scale-95'
          }`}
        >
          <div className="relative px-5 py-4 border-b border-zinc-100 flex items-start justify-between gap-3 shrink-0">
            <div className="sm:hidden absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-zinc-200" aria-hidden="true" />
            <div>
              <h2 className="font-heading font-black text-xl text-zinc-900 leading-tight">{deal.name}</h2>
              <p className="text-sm text-zinc-400 mt-0.5">
                {isPercent ? `${deal.config.discount_percent}% off` : `£${deal.config.price.toFixed(2)}`}
              </p>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="w-11 h-11 -mr-2 -mt-1 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto overscroll-contain divide-y divide-zinc-100">
            {deal.config.groups.map((group, gi) => {
              const count = slotCount(gi)
              const chosen = picks[gi] ?? []
              return (
                <section key={gi} className="px-5 py-4" aria-label={group.label}>
                  <div className="flex items-center justify-between">
                    <p className="font-heading font-semibold text-zinc-900 text-sm">{group.label}</p>
                    <span className="text-[11px] font-semibold text-brand-red">
                      {count} of {group.min_qty === group.max_qty ? group.min_qty : `${group.min_qty}-${group.max_qty}`} selected
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-3">
                    {Array.from(itemsById.values())
                      .filter((it) => inSlot({ item_ids: group.item_ids ?? [], category: group.category }, it))
                      .map((item) => {
                        const pickedQty = chosen.filter((p) => p.item_id === item.id).length
                        const atMax = count >= group.max_qty
                        return (
                          <button
                            key={item.id}
                            onClick={() => addPick(gi, item)}
                            disabled={atMax}
                            aria-label={`Add ${item.name}`}
                            className={`rounded-xl border-2 overflow-hidden text-left transition-all disabled:cursor-not-allowed ${
                              pickedQty > 0
                                ? 'border-brand-red bg-brand-red/5'
                                : atMax
                                  ? 'border-zinc-100 opacity-40'
                                  : 'border-zinc-100 hover:border-zinc-300 active:scale-[0.98]'
                            }`}
                          >
                            {item.image_url ? (
                              <div className="relative w-full h-20">
                                <Image src={item.image_url} alt="" fill className="object-cover" sizes="200px" />
                              </div>
                            ) : (
                              <div className="w-full h-20 bg-zinc-100 flex items-center justify-center text-2xl">🍽️</div>
                            )}
                            <div className="p-2.5 flex items-start justify-between gap-1">
                              <p className={`text-xs font-semibold leading-tight ${pickedQty > 0 ? 'text-brand-red' : 'text-zinc-800'}`}>
                                {item.name}
                              </p>
                              {pickedQty > 0 && (
                                <span className="flex items-center gap-0.5 shrink-0 text-brand-red text-xs font-bold">
                                  {pickedQty > 1 && pickedQty}
                                  <Check size={13} />
                                </span>
                              )}
                            </div>
                          </button>
                        )
                      })}
                  </div>

                  {chosen.length > 0 && (
                    <ul className="mt-3 space-y-2">
                      {chosen.map((unit) => {
                        const item = itemsById.get(unit.item_id)
                        if (!item) return null
                        const config = configs.get(item.id)!
                        const summary = summarise(unit)
                        const open = expanded === unit.uid
                        return (
                          <li key={unit.uid} className="rounded-xl border border-zinc-200 overflow-hidden">
                            <div className="flex items-center gap-2 px-3 py-2">
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-zinc-900 truncate">{item.name}</p>
                                {summary && <p className="text-xs text-zinc-400 truncate">{summary}</p>}
                              </div>
                              <button
                                onClick={() => setExpanded(open ? null : unit.uid)}
                                aria-expanded={open}
                                className="min-h-[44px] px-2 flex items-center gap-1 text-xs font-semibold text-brand-red"
                              >
                                Customise
                                <ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
                              </button>
                              <button
                                onClick={() => removePick(gi, unit.uid)}
                                aria-label={`Remove ${item.name}`}
                                className="w-11 h-11 shrink-0 rounded-full flex items-center justify-center text-zinc-400 hover:text-brand-red hover:bg-zinc-50 transition-colors"
                              >
                                <X size={15} />
                              </button>
                            </div>
                            {open && (
                              <div className="border-t border-zinc-100 bg-zinc-50/60 divide-y divide-zinc-100">
                                {hasOptions(config) && (
                                  <ModifierForm
                                    config={config}
                                    value={unit.selection}
                                    onChange={(next) => updatePick(gi, unit.uid, { selection: next })}
                                  />
                                )}
                                <div className="px-4 py-3">
                                  <label className="block text-xs font-semibold text-zinc-700 mb-1.5" htmlFor={`note-${unit.uid}`}>
                                    Special instructions
                                  </label>
                                  <input
                                    id={`note-${unit.uid}`}
                                    type="text"
                                    value={unit.notes}
                                    onChange={(e) => updatePick(gi, unit.uid, { notes: e.target.value })}
                                    placeholder="No onions"
                                    maxLength={200}
                                    className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 min-h-[44px] text-base sm:text-sm text-zinc-700 placeholder-zinc-400 bg-white focus:outline-none focus:border-zinc-400"
                                  />
                                </div>
                              </div>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </section>
              )
            })}

            {upgradeItems.length > 0 && (
              <section className="px-5 py-4" aria-label={deal.config.upgrades?.label || 'Upgrade your deal'}>
                <p className="font-heading font-semibold text-zinc-900 text-sm">
                  {deal.config.upgrades?.label || 'Upgrade your deal'}
                </p>
                <p className="text-xs text-zinc-400 mt-0.5">Added at the normal menu price</p>
                <div className="mt-3 divide-y divide-zinc-50">
                  {upgradeItems.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 py-2">
                      {item.image_url ? (
                        <div className="relative w-12 h-12 shrink-0 rounded-lg overflow-hidden">
                          <Image src={item.image_url} alt="" fill className="object-cover" sizes="48px" />
                        </div>
                      ) : (
                        <div className="w-12 h-12 shrink-0 rounded-lg bg-zinc-100 flex items-center justify-center text-lg">🍽️</div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-zinc-800 truncate">{item.name}</p>
                        <p className="text-xs text-zinc-400">+£{item.price.toFixed(2)}</p>
                      </div>
                      <QtyStepper
                        value={upgradeQty[item.id] ?? 0}
                        onChange={(next) => setUpgradeQty((prev) => ({ ...prev, [item.id]: next }))}
                        label={item.name}
                        max={9}
                      />
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Sticky footer */}
          <div className="border-t border-zinc-100 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] bg-white shrink-0">
            {(extrasSum > 0 || upgradesSum > 0) && (
              <div className="flex justify-between text-xs text-zinc-400 mb-2">
                <span>Extras &amp; upgrades</span>
                <span>+£{(extrasSum + upgradesSum).toFixed(2)}</span>
              </div>
            )}
            <button
              onClick={handleSubmit}
              disabled={!allComplete}
              className={`w-full min-h-[44px] font-bold py-4 rounded-2xl flex items-center justify-between px-5 transition-all ${
                !allComplete
                  ? 'bg-zinc-200 text-zinc-400 cursor-not-allowed'
                  : 'bg-brand-red hover:bg-red-700 active:scale-[0.98] text-white shadow-lg shadow-red-900/20'
              }`}
            >
              <span className="flex items-center gap-2 text-base">
                {allComplete && <Plus size={18} />}
                {allComplete ? 'Add Bundle to Order' : 'Select required items'}
              </span>
              {allComplete && <span className="text-base tabular-nums">£{total.toFixed(2)}</span>}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
