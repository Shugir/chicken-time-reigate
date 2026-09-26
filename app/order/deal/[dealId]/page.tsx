'use client'

import { Suspense, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import Image from 'next/image'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Check, ChevronDown, RotateCcw, ShoppingBag, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { EMPTY_SELECTION, type ModifierSelection } from '@/components/Menu/ModifierForm'
import { GroupHeader, ItemOptionSections } from '@/components/Menu/GroupedCustomizer'
import QtyStepper from '@/components/Menu/QtyStepper'
import { isSelectionComplete, upgradesTotal } from '@/components/Deals/deal-slot-picker-logic'
import { customizerLayout, receiptLines } from '@/lib/customizer-layout'
import { matchDeals } from '@/lib/deal-engine'
import { bundlesContaining, dealPriceLabel, lockedSlotIndex, slotItems, type BundleDeal } from '@/lib/deal-page'
import { dbToMenuItem, FALLBACK_IMG, itemConfig, lineUnitPrice, type DbMenuItem, type MenuItem } from '@/lib/menu-items'
import { formatExtra, hasNoCustomization } from '@/lib/order-modifiers'
import { queueCartLine } from '@/lib/use-cart'

/** One picked unit. Each tap adds its own entry so units can carry different options. */
interface PickUnit { uid: string; item_id: string; selection: ModifierSelection; notes: string }

const LOCKED_UID = 'locked'
const UNIT_NOTES_MAX = 200
const money = (n: number) => `£${n.toFixed(2)}`
const pad2 = (n: number) => String(n).padStart(2, '0')
// A tab switch changes the route, which remounts this page: set on arrow-key switches so the new
// page puts focus back on the selected tab
const REFOCUS_TAB_KEY = 'dealTabRefocus'

const hasOptions = (item: MenuItem) => !hasNoCustomization(itemConfig(item))

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

function Skeleton() {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 animate-pulse" role="status" aria-busy="true" aria-label="Loading meal deal">
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

// useSearchParams needs a Suspense boundary (Next 16: a prerendered page bails out to the client up to it)
export default function DealPage() {
  return (
    <Suspense fallback={<Skeleton />}>
      <DealPageContent />
    </Suspense>
  )
}

function DealPageContent() {
  const { dealId } = useParams<{ dealId: string }>()
  const itemId = useSearchParams().get('item')
  const router = useRouter()
  const [data, setData] = useState<{ deals: BundleDeal[]; items: MenuItem[] } | null>(null)

  useEffect(() => {
    let cancelled = false
    const json = (res: Response) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json()
    }
    Promise.all([fetch('/api/deals/active').then(json), fetch('/api/menu-items').then(json)])
      .then(([deals, rows]: [{ type: string }[], DbMenuItem[]]) => {
        if (cancelled) return
        setData({ deals: deals.filter((d): d is BundleDeal => d.type === 'bundle'), items: rows.map(dbToMenuItem) })
      })
      .catch((err) => {
        console.error('Failed to load meal deal:', err)
        if (cancelled) return
        toast.error('Couldn’t load that deal. Please try again.', { id: 'deal-load-failed' })
        router.replace('/order')
      })
    return () => { cancelled = true }
  }, [router])

  const deal = data?.deals.find((d) => d.id === dealId)
  const tapped = itemId ? data?.items.find((i) => i.id === itemId && i.is_available !== false) : undefined
  const containing = data && tapped ? bundlesContaining(data.deals, tapped) : []
  const locked = deal && tapped && lockedSlotIndex(deal, tapped) >= 0 ? tapped : undefined
  // Unknown/inactive deal: back to the menu. Tapped item not in this deal: the first deal that has it.
  const redirect = !data
    ? null
    : !deal
      ? '/order'
      : tapped && !locked && containing.length > 0
        ? `/order/deal/${containing[0].id}?item=${tapped.id}`
        : null

  useEffect(() => {
    if (!redirect) return
    if (redirect === '/order') toast('That deal isn’t available right now.', { id: 'deal-unavailable' })
    router.replace(redirect)
  }, [redirect, router])

  const goBack = () => (window.history.length > 1 ? router.back() : router.push('/order'))

  if (!data || redirect || !deal) return <Skeleton />

  const tabs = locked && containing.length >= 2 ? containing : []
  const switchTo = (id: string) => {
    if (id !== deal.id) router.replace(`/order/deal/${id}?item=${locked!.id}`)
  }
  const onTabKey = (e: KeyboardEvent, i: number) => {
    const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key]
    if (next === undefined) return
    e.preventDefault()
    const target = tabs[(next + tabs.length) % tabs.length]
    try {
      if (target.id !== deal.id) sessionStorage.setItem(REFOCUS_TAB_KEY, '1')
    } catch {
      // Storage blocked: the switch still works, focus just isn't restored
    }
    switchTo(target.id)
  }

  return (
    <div className="bg-white min-h-screen">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 pb-32 lg:pb-12">
        <button
          onClick={goBack}
          className="min-h-[44px] inline-flex items-center gap-2 text-sm font-medium text-zinc-500 hover:text-zinc-900 transition-colors mb-4"
        >
          <ArrowLeft size={16} /> Back to menu
        </button>

        {tabs.length > 0 && (
          <div role="tablist" aria-label="Choose your meal deal" className="flex flex-wrap gap-2 mb-5">
            {tabs.map((t, i) => {
              const selected = t.id === deal.id
              return (
                <button
                  key={t.id}
                  ref={(el) => {
                    if (!el || !selected) return
                    try {
                      if (sessionStorage.getItem(REFOCUS_TAB_KEY)) { sessionStorage.removeItem(REFOCUS_TAB_KEY); el.focus() }
                    } catch {
                      // Storage blocked: no focus restore
                    }
                  }}
                  role="tab"
                  id={`deal-tab-${t.id}`}
                  aria-selected={selected}
                  aria-controls="deal-panel"
                  tabIndex={selected ? 0 : -1}
                  onClick={() => switchTo(t.id)}
                  onKeyDown={(e) => onTabKey(e, i)}
                  className={`min-h-[44px] rounded-xl px-4 text-sm text-left font-bold border-2 transition-colors ${
                    selected ? 'bg-brand-dark text-white border-brand-dark' : 'bg-white text-zinc-700 border-zinc-200 hover:border-zinc-400'
                  }`}
                >
                  {t.name} · <span className="tabular-nums">{dealPriceLabel(t.config)}</span>
                </button>
              )
            })}
          </div>
        )}

        <div id="deal-panel" role={tabs.length > 0 ? 'tabpanel' : undefined} aria-labelledby={tabs.length > 0 ? `deal-tab-${deal.id}` : undefined}>
          {/* key: switching deal (or locked item) starts a fresh build */}
          <DealBuilder key={`${deal.id}:${locked?.id ?? ''}`} deal={deal} items={data.items} locked={locked} />
        </div>
      </div>
    </div>
  )
}

function DealBuilder({ deal, items, locked }: { deal: BundleDeal; items: MenuItem[]; locked?: MenuItem }) {
  const router = useRouter()
  // Blocks a second Add tap while navigation is in flight (it would queue the lines twice)
  const adding = useRef(false)
  const nextUid = useRef(0)
  const groups = deal.config.groups
  const lockedIndex = locked ? lockedSlotIndex(deal, locked) : -1

  const initialPicks = (): Record<number, PickUnit[]> =>
    locked ? { [lockedIndex]: [{ uid: LOCKED_UID, item_id: locked.id, selection: EMPTY_SELECTION, notes: '' }] } : {}
  const initialExpanded = () => (locked && hasOptions(locked) ? LOCKED_UID : null)

  // picks[groupIndex] is one entry per picked unit
  const [picks, setPicks] = useState<Record<number, PickUnit[]>>(initialPicks)
  const [expanded, setExpanded] = useState<string | null>(initialExpanded)
  const [upgradeQty, setUpgradeQty] = useState<Record<string, number>>({})

  const itemsById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items])
  const available = useMemo(() => items.filter((i) => i.is_available !== false), [items])
  const upgradeItems = (deal.config.upgrades?.item_ids ?? [])
    .map((id) => itemsById.get(id))
    .filter((i): i is MenuItem => i != null && i.is_available !== false)

  // Locked slot first, then the others in their configured order
  const order = lockedIndex >= 0 ? [lockedIndex, ...groups.map((_, i) => i).filter((i) => i !== lockedIndex)] : groups.map((_, i) => i)
  // Every unit is qty 1
  const slotCount = (gi: number) => (picks[gi] ?? []).length

  function addPick(gi: number, item: MenuItem) {
    if (slotCount(gi) >= groups[gi].max_qty) return
    const uid = `u${nextUid.current++}`
    setPicks((prev) => ({ ...prev, [gi]: [...(prev[gi] ?? []), { uid, item_id: item.id, selection: EMPTY_SELECTION, notes: '' }] }))
    if (hasOptions(item)) setExpanded(uid)
  }
  function removePick(gi: number, uid: string) {
    setPicks((prev) => ({ ...prev, [gi]: (prev[gi] ?? []).filter((p) => p.uid !== uid) }))
    setExpanded((e) => (e === uid ? null : e))
  }
  function updatePick(gi: number, uid: string, patch: Partial<Pick<PickUnit, 'selection' | 'notes'>>) {
    setPicks((prev) => ({ ...prev, [gi]: (prev[gi] ?? []).map((p) => (p.uid === uid ? { ...p, ...patch } : p)) }))
  }

  // ── Deal math: the same as the old pop-up, with the checkout engine's own discount ──
  const units = order.flatMap((gi) => (picks[gi] ?? []).map((u) => ({ gi, u })))
  const complete = isSelectionComplete(groups, Object.fromEntries(
    groups.map((_, gi) => [gi, (picks[gi] ?? []).map((u) => ({ item_id: u.item_id, qty: 1 }))]),
  ))
  const remaining = groups.reduce((n, g, gi) => n + Math.max(0, g.min_qty - slotCount(gi)), 0)
  const priceOf = (id: string) => itemsById.get(id)?.price ?? 0
  const itemsSum = units.reduce((s, { u }) => s + priceOf(u.item_id), 0)
  // matchDeals bundles only min_qty items per slot, so picks beyond min_qty stay full price
  const saving = complete
    ? matchDeals(
        units.map(({ u }) => ({ menu_item_id: u.item_id, quantity: 1 })),
        [{ id: deal.id, type: 'bundle', name: deal.name, config: deal.config, is_active: true }],
        new Map(available.map((i) => [i.id, { id: i.id, price: i.price, category: i.category, is_available: true }])),
      ).totalDiscount
    : 0
  const unitExtras = (u: PickUnit) => {
    const item = itemsById.get(u.item_id)
    return item ? lineUnitPrice(item, { spicy_level: u.selection.spicy ?? undefined, extras: u.selection.extras }) - item.price : 0
  }
  const extrasSum = units.reduce((s, { u }) => s + unitExtras(u), 0)
  const chosenUpgrades = upgradeItems.filter((i) => (upgradeQty[i.id] ?? 0) > 0)
  const upgradesSum = upgradesTotal(chosenUpgrades.map((i) => ({ price: i.price, qty: upgradeQty[i.id] })))
  const total = itemsSum - saving + extrasSum + upgradesSum

  const handleAdd = () => {
    if (!complete || adding.current) return
    adding.current = true
    try {
      // One cart line per unit with its options, as the pop-up queued them; checkout applies the bundle price
      for (const { u } of units) {
        queueCartLine(sessionStorage, u.item_id, {
          spicy_level: u.selection.spicy ?? undefined,
          removals: u.selection.removals,
          additions: u.selection.additions,
          extras: u.selection.extras,
          notes: u.notes.trim() || undefined,
        }, 1)
      }
      // Upgrades are ordinary menu items at their normal price
      for (const i of chosenUpgrades) queueCartLine(sessionStorage, i.id, { removals: [], additions: [], extras: [] }, upgradeQty[i.id])
    } catch {
      // sessionStorage itself throws when site data is blocked: the lines can't be queued
    }
    // replace, so browser Back from /order doesn't reopen this page
    router.replace('/order')
  }

  const handleReset = () => {
    setPicks(initialPicks())
    setExpanded(initialExpanded())
    setUpgradeQty({})
  }

  const heroItem = locked ?? (groups.length > 0 ? slotItems(deal, 0, available)[0] : undefined)
  const priceLabel = deal.config.price_type === 'percent' ? `${deal.config.discount_percent}% off selected items` : `${dealPriceLabel(deal.config)} meal deal`
  const upgradesNumber = pad2(order.length + 1)
  const receiptNumber = pad2(order.length + (upgradeItems.length > 0 ? 2 : 1))
  const ctaLabel = complete ? 'Add +' : `Select required items (${remaining} left)`

  const unitRow = (gi: number, unit: PickUnit) => {
    const item = itemsById.get(unit.item_id)
    if (!item) return null
    const config = itemConfig(item)
    const summary = summarise(unit)
    // The tapped item's options stay open: it is the reason the customer is here
    const alwaysOpen = unit.uid === LOCKED_UID
    const open = alwaysOpen || expanded === unit.uid
    const panelId = `unit-${unit.uid}`
    return (
      <li key={unit.uid} className="rounded-xl border border-zinc-200 overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-zinc-900 truncate">{item.name}</p>
            {summary && <p className="text-xs text-zinc-500 truncate">{summary}</p>}
          </div>
          {!alwaysOpen && (
            <button
              type="button"
              onClick={() => setExpanded(open ? null : unit.uid)}
              aria-expanded={open}
              aria-controls={panelId}
              className="min-h-[44px] px-2 flex items-center gap-1 text-xs font-semibold text-brand-red"
            >
              Customise
              <ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
          )}
          {unit.uid === LOCKED_UID ? (
            <span className="shrink-0 rounded-md bg-brand-red/10 text-brand-red text-[11px] font-bold uppercase px-2 py-1">Your choice</span>
          ) : (
            <button
              type="button"
              onClick={() => removePick(gi, unit.uid)}
              aria-label={`Remove ${item.name}`}
              className="w-11 h-11 shrink-0 rounded-full flex items-center justify-center text-zinc-400 hover:text-brand-red hover:bg-zinc-50 transition-colors"
            >
              <X size={15} />
            </button>
          )}
        </div>
        {open && (
          <div id={panelId} className="border-t border-zinc-100 bg-zinc-50/60 p-3 sm:p-4 space-y-4">
            <ItemOptionSections
              layout={customizerLayout(config)}
              config={config}
              value={unit.selection}
              onChange={(next) => updatePick(gi, unit.uid, { selection: next })}
              soldOut={item.sold_out_extras}
            />
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-zinc-700" htmlFor={`note-${unit.uid}`}>Special instructions</label>
                <span className="text-xs text-zinc-500 tabular-nums">{unit.notes.length} / {UNIT_NOTES_MAX}</span>
              </div>
              <input
                id={`note-${unit.uid}`}
                type="text"
                value={unit.notes}
                onChange={(e) => updatePick(gi, unit.uid, { notes: e.target.value })}
                placeholder="No onions"
                maxLength={UNIT_NOTES_MAX}
                className="w-full border-2 border-zinc-200 rounded-xl px-3 py-2.5 min-h-[44px] text-base sm:text-sm text-brand-dark placeholder-zinc-400 bg-white focus:outline-none focus:border-brand-red"
              />
            </div>
          </div>
        )}
      </li>
    )
  }

  const receipt = (showActions: boolean) => (
    <aside aria-label="Your selection" className="bg-white rounded-2xl border border-zinc-100 shadow-sm">
      <div className="flex items-start justify-between gap-3 bg-brand-dark rounded-t-2xl px-5 py-4">
        <div className="flex items-start gap-3">
          <span aria-hidden="true" className="w-8 h-8 shrink-0 rounded-full bg-brand-red text-white text-xs font-bold flex items-center justify-center tabular-nums">
            {receiptNumber}
          </span>
          <div className="min-w-0">
            <h2 className="font-heading font-bold text-white">Your Selection</h2>
            <p className="text-sm text-white/70">{deal.name}</p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs font-bold uppercase tracking-wide text-white/70">Live total</p>
          <p className="text-white font-black tabular-nums">{money(total)}</p>
        </div>
      </div>

      <div className="p-5 space-y-4">
        <div className="space-y-2">
          {units.length === 0 && chosenUpgrades.length === 0 ? (
            <p className="text-sm text-zinc-500">Nothing picked yet.</p>
          ) : (
            <>
              {units.map(({ gi, u }) => {
                const item = itemsById.get(u.item_id)
                if (!item) return null
                const extras = receiptLines(customizerLayout(itemConfig(item)), itemConfig(item), u.selection, '')
                  .filter((l) => typeof l.amount === 'number')
                return (
                  <div key={u.uid} className="text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <span className="min-w-0">
                        <span className="text-brand-red font-bold">[{groups[gi].label}]</span>{' '}
                        <span className="text-zinc-700">{item.name}</span>
                      </span>
                      <span className="shrink-0 tabular-nums text-zinc-700">{money(item.price)}</span>
                    </div>
                    {extras.map((l, i) => (
                      <div key={i} className="flex items-start justify-between gap-3 pl-4 text-zinc-500">
                        <span className="min-w-0">{l.label}</span>
                        <span className="shrink-0 tabular-nums">+{money(l.amount as number)}</span>
                      </div>
                    ))}
                  </div>
                )
              })}
              {chosenUpgrades.map((i) => (
                <div key={i.id} className="flex items-start justify-between gap-3 text-sm">
                  <span className="min-w-0">
                    <span className="text-brand-red font-bold">[Upgrade]</span>{' '}
                    <span className="text-zinc-700">{i.name} × {upgradeQty[i.id]}</span>
                  </span>
                  <span className="shrink-0 tabular-nums text-zinc-700">+{money(i.price * upgradeQty[i.id])}</span>
                </div>
              ))}
            </>
          )}
        </div>

        <div className="space-y-1.5 pt-3 border-t border-zinc-100 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-zinc-500">Items at menu price</span>
            <span className="tabular-nums text-zinc-700">{money(itemsSum)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-zinc-500">Meal deal saving</span>
            <span className="tabular-nums text-emerald-700">−{money(saving)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-zinc-500">Extras &amp; upgrades</span>
            <span className="tabular-nums text-zinc-700">+{money(extrasSum + upgradesSum)}</span>
          </div>
          <div className="flex items-center justify-between pt-1.5 border-t border-zinc-100 font-bold text-brand-dark">
            <span>Total</span>
            <span className="tabular-nums">{money(total)}</span>
          </div>
        </div>

        <div className="space-y-2 pt-1">
          {showActions && (
            <button
              type="button"
              onClick={handleAdd}
              disabled={!complete}
              aria-label={complete ? `Add ${deal.name} to order, ${money(total)}` : undefined}
              className="w-full min-h-[44px] flex items-center justify-between gap-2 bg-brand-red hover:bg-red-700 text-white font-bold rounded-2xl px-4 py-3 transition-colors disabled:bg-zinc-200 disabled:text-zinc-500 disabled:cursor-not-allowed"
            >
              <span>{ctaLabel}</span>
              {complete && <span className="tabular-nums">{money(total)}</span>}
            </button>
          )}
          <button
            type="button"
            onClick={handleReset}
            className="w-full min-h-[44px] flex items-center justify-center gap-2 text-zinc-500 hover:text-zinc-700 font-semibold transition-colors"
          >
            <RotateCcw size={16} aria-hidden="true" />
            <span>Reset all</span>
          </button>
        </div>
      </div>
    </aside>
  )

  return (
    <>
      <div className="grid lg:grid-cols-12 gap-8 items-start">
        {/* Left: hero + numbered groups */}
        <div className="lg:col-span-8 space-y-6 min-w-0">
          <header className="grid sm:grid-cols-2 gap-5 items-center">
            <div className="relative aspect-[4/3] rounded-3xl overflow-hidden bg-zinc-100">
              <Image src={heroItem?.image ?? FALLBACK_IMG} alt={heroItem?.name ?? deal.name} fill priority sizes="(max-width: 640px) 100vw, 400px" className="object-cover" />
              <div className="absolute top-0 right-0 bg-brand-red text-white text-[11px] font-black px-3 py-2 rounded-bl-2xl shadow-lg">MEAL DEAL</div>
            </div>
            <div>
              <h1 className="font-heading font-black text-3xl text-zinc-900 leading-tight">{deal.name}</h1>
              <p className="mt-3 text-2xl font-heading font-black text-brand-red tabular-nums">{priceLabel}</p>
              <p className="text-sm text-zinc-500 mt-2 leading-relaxed">Choose your items below</p>
            </div>
          </header>

          {order.map((gi, pos) => {
            const group = groups[gi]
            const count = slotCount(gi)
            const chosen = picks[gi] ?? []
            const titleId = `slot-${gi}`
            const need = group.min_qty === group.max_qty ? `${group.min_qty}` : `${group.min_qty}-${group.max_qty}`
            return (
              <section key={gi} aria-labelledby={titleId} className="bg-white rounded-2xl border border-zinc-100">
                <GroupHeader
                  number={pad2(pos + 1)}
                  title={group.label}
                  subtitle={gi === lockedIndex ? 'Your choice. Set its options below.' : `${count} of ${need} selected`}
                  titleId={titleId}
                  right={count > 0 && (
                    <span className="shrink-0 rounded-full px-2.5 py-1 bg-brand-red text-white text-xs font-bold">{count} Selected</span>
                  )}
                />
                <div className="p-3 sm:p-5 space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                    {slotItems(deal, gi, available, locked).map((item) => {
                      const pickedQty = chosen.filter((p) => p.item_id === item.id).length
                      const atMax = count >= group.max_qty
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => addPick(gi, item)}
                          disabled={atMax}
                          aria-label={`Add ${item.name}${pickedQty > 0 ? `, ${pickedQty} picked` : ''}`}
                          className={`relative min-w-0 rounded-xl border-2 overflow-hidden text-left transition-colors disabled:cursor-not-allowed ${
                            pickedQty > 0
                              ? 'border-brand-red bg-brand-red/5'
                              : atMax
                                ? 'border-zinc-100 opacity-50'
                                : 'border-zinc-200 bg-white hover:border-zinc-400'
                          }`}
                        >
                          <div className="relative w-full aspect-[4/3] bg-zinc-100">
                            <Image src={item.image} alt="" fill className="object-cover" sizes="200px" />
                          </div>
                          <div className="p-2.5 flex items-start justify-between gap-1">
                            <p className={`text-xs sm:text-sm font-semibold leading-tight break-words min-w-0 ${pickedQty > 0 ? 'text-brand-red' : 'text-brand-dark'}`}>
                              {item.name}
                            </p>
                            {pickedQty > 0 && (
                              <span className="flex items-center gap-0.5 shrink-0 text-brand-red text-xs font-bold">
                                {pickedQty > 1 && pickedQty}
                                <Check size={13} aria-hidden="true" />
                              </span>
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                  {chosen.length > 0 && <ul className="space-y-2">{chosen.map((unit) => unitRow(gi, unit))}</ul>}
                </div>
              </section>
            )
          })}

          {upgradeItems.length > 0 && (
            <section aria-labelledby="deal-upgrades" className="bg-white rounded-2xl border border-zinc-100">
              <GroupHeader
                number={upgradesNumber}
                title={deal.config.upgrades?.label || 'Upgrade your deal'}
                subtitle="Added at the normal menu price"
                titleId="deal-upgrades"
                right={chosenUpgrades.length > 0 && (
                  <span className="shrink-0 rounded-full px-2.5 py-1 bg-brand-red text-white text-xs font-bold">
                    {chosenUpgrades.reduce((n, i) => n + upgradeQty[i.id], 0)} Selected
                  </span>
                )}
              />
              <div className="p-3 sm:p-5 divide-y divide-zinc-100">
                {upgradeItems.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 py-2">
                    <div className="relative w-12 h-12 shrink-0 rounded-lg overflow-hidden bg-zinc-100">
                      <Image src={item.image} alt="" fill className="object-cover" sizes="48px" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-zinc-800 truncate">{item.name}</p>
                      <p className="text-xs text-zinc-500 tabular-nums">+{money(item.price)}</p>
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

          {/* Mobile: the receipt sits below the groups; the sticky bar below carries Add */}
          <div className="lg:hidden">{receipt(false)}</div>
        </div>

        {/* Desktop: sticky receipt with Add / Reset */}
        <div className="hidden lg:block lg:col-span-4 lg:sticky lg:top-6 self-start">{receipt(true)}</div>
      </div>

      {/* Mobile sticky bottom bar */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-zinc-100 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={handleAdd}
          disabled={!complete}
          aria-label={complete ? `Add ${deal.name} to order, ${money(total)}` : undefined}
          className="w-full min-h-[44px] font-bold text-sm sm:text-base py-4 rounded-2xl flex items-center justify-center gap-1.5 px-3 transition-all bg-brand-red hover:bg-red-700 active:scale-[0.98] text-white shadow-lg shadow-red-900/20 disabled:bg-zinc-200 disabled:text-zinc-500 disabled:shadow-none disabled:cursor-not-allowed"
        >
          {complete && <ShoppingBag size={18} className="shrink-0" />}
          {/* Only the words may truncate; the price always shows in full */}
          <span className="truncate">{ctaLabel}</span>
          {complete && <span className="shrink-0 tabular-nums">{money(total)}</span>}
        </button>
      </div>
    </>
  )
}
