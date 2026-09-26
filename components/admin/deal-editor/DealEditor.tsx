'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { AlertTriangle, ChevronLeft, Loader2, Plus } from 'lucide-react'
import AdminSidebar from '@/components/admin/admin-sidebar'
import { FOCUS_RING, INPUT_BASE, LABEL_CLS } from '@/components/admin/menu-item-editor/constants'
import { inSlot } from '@/lib/deal-engine'
import {
  EMPTY_CONFIG, ItemPicker, SlotEditor, TYPE_LABELS,
  bogoSideItemIds, bundleConfigForSave, fromDateTimeLocal, normalizeSlot, toDateTimeLocal,
  type Category, type Deal, type DealType, type MenuItemOption, type Slot,
} from './shared'

const INPUT = `w-full h-11 ${INPUT_BASE}`
const SELECT = `w-full h-11 ${INPUT_BASE}`

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-950 text-white flex">
      <AdminSidebar />
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  )
}

function Breadcrumb({ current, onNavigate }: { current: string; onNavigate?: (e: { preventDefault: () => void }) => void }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex items-center gap-1.5 text-xs text-zinc-400">
        <li>
          <Link href="/admin/deals" onNavigate={onNavigate} className={`inline-flex items-center gap-1 rounded hover:text-white transition-colors ${FOCUS_RING}`}>
            <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" /> Deals
          </Link>
        </li>
        <li aria-hidden="true">›</li>
        <li aria-current="page" className="text-zinc-300">{current}</li>
      </ol>
    </nav>
  )
}

function Card({ title, subtitle, action, children }: { title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-white">{title}</h2>
          {subtitle && <p className="text-sm text-zinc-400">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

const isDealType = (t: unknown): t is DealType => t === 'bogo' || t === 'bundle' || t === 'order_discount'

/**
 * The deal add/edit page. `dealId` edits an existing deal; otherwise `type` picks what to create.
 * Loads the deal, the menu items and the categories, then shows the form.
 */
export default function DealEditor({ dealId, type }: { dealId?: string; type?: string }) {
  const [deal, setDeal] = useState<Deal | null>(null)
  const [menuItems, setMenuItems] = useState<MenuItemOption[] | null>(null)
  const [categories, setCategories] = useState<Category[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(!dealId && !isDealType(type) ? 'Choose a deal type from the Deals page.' : null)

  useEffect(() => {
    const json = (r: Response) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
    Promise.all([fetch('/api/admin/menu-items').then(json), fetch('/api/categories').then(json)])
      .then(([m, c]) => {
        setMenuItems(Array.isArray(m) ? m : [])
        setCategories(Array.isArray(c) ? c : [])
      })
      .catch(() => setLoadError('Could not load the menu. Please try again.'))
  }, [])

  useEffect(() => {
    if (!dealId) return
    fetch(`/api/admin/deals/${encodeURIComponent(dealId)}`)
      .then(async (r) => {
        const d = await r.json().catch(() => ({}))
        if (r.status === 404) throw new Error('This deal no longer exists. It may have been deleted.')
        if (!r.ok) throw new Error(d.error ?? 'Could not load this deal.')
        setDeal(d)
      })
      .catch((e: Error) => setLoadError(e.message))
  }, [dealId])

  const title = dealId ? 'Edit deal' : `New ${isDealType(type) ? TYPE_LABELS[type] : ''} deal`

  if (loadError) {
    return (
      <Shell>
        <div className="px-4 sm:px-8 py-6 space-y-6">
          <Breadcrumb current={title} />
          <div role="alert" className="max-w-lg rounded-2xl border border-red-500/30 bg-red-500/10 p-6">
            <AlertTriangle className="w-6 h-6 text-red-400 mb-3" aria-hidden="true" />
            <p className="text-white font-semibold">{loadError}</p>
            <Link href="/admin/deals" className={`inline-flex items-center mt-4 h-11 px-4 rounded-xl bg-zinc-800 text-sm font-medium text-white hover:bg-zinc-700 ${FOCUS_RING}`}>
              Back to Deals
            </Link>
          </div>
        </div>
      </Shell>
    )
  }

  if (!menuItems || !categories || (dealId && !deal)) {
    return (
      <Shell>
        <div className="px-4 sm:px-8 py-6 space-y-6 max-w-3xl" aria-busy="true">
          <Breadcrumb current={title} />
          <p className="sr-only" role="status">Loading…</p>
          {[0, 1].map((i) => <div key={i} className="h-56 rounded-2xl bg-zinc-900 border border-zinc-800 animate-pulse" />)}
        </div>
      </Shell>
    )
  }

  const initial: Deal = deal ?? {
    id: '', type: type as DealType, name: '', config: EMPTY_CONFIG[type as DealType], is_active: true,
    custom_label: null, available_from: null, available_until: null, image_url: null,
  }
  return <DealForm initial={initial} isEdit={!!dealId} menuItems={menuItems} categories={categories} />
}

function DealForm({ initial, isEdit, menuItems, categories }: {
  initial: Deal
  isEdit: boolean
  menuItems: MenuItemOption[]
  categories: Category[]
}) {
  const router = useRouter()
  const type = initial.type
  const [name, setName] = useState(initial.name)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- deal config is per-type JSON, validated by the API
  const [config, setConfig] = useState<any>(initial.config)
  const [customLabel, setCustomLabel] = useState(initial.custom_label ?? '')
  const [availableFrom, setAvailableFrom] = useState(toDateTimeLocal(initial.available_from))
  const [availableUntil, setAvailableUntil] = useState(toDateTimeLocal(initial.available_until))
  const existingImageUrl = initial.image_url ?? ''
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Unsaved changes: warn before leaving the page
  const snapshot = JSON.stringify([name, config, customLabel, availableFrom, availableUntil, imageFile?.name])
  const [baseline] = useState(snapshot)
  const dirty = snapshot !== baseline && !saving
  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])
  const guardLeave = (e: { preventDefault: () => void }) => {
    if (dirty && !window.confirm('Leave without saving? Your changes will be lost.')) e.preventDefault()
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- see config above
  function set(path: (string | number)[], value: any) {
    setConfig((prev: unknown) => {
      const next = structuredClone(prev) as Record<string | number, unknown>
      let cur = next
      for (let i = 0; i < path.length - 1; i++) cur = cur[path[i]] as Record<string | number, unknown>
      cur[path[path.length - 1]] = value
      return next
    })
  }

  // Writing item_ids also drops any legacy `category` so the deal becomes purely item-based.
  function setBogoItems(side: 'buy' | 'get', ids: string[]) {
    setConfig((prev: Record<string, Record<string, unknown>>) => {
      const next = structuredClone(prev)
      next[side].item_ids = ids
      delete next[side].category
      return next
    })
  }

  // Slots carry long item lists, so a new slot is scrolled into view with its label focused.
  const slotsRef = useRef<HTMLDivElement>(null)
  const slotAdded = useRef(false)
  const slotCount = config.groups?.length ?? 0
  useEffect(() => {
    if (!slotAdded.current) return
    slotAdded.current = false
    const last = slotsRef.current?.lastElementChild as HTMLElement | null
    last?.scrollIntoView({ block: 'center' })
    last?.querySelector('input')?.focus({ preventScroll: true })
  }, [slotCount])
  function addSlot() {
    slotAdded.current = true
    set(['groups'], [...config.groups, { label: '', min_qty: 1, max_qty: 1, item_ids: [] }])
  }
  const addSlotButton = (tone: string) => (
    <button
      type="button"
      onClick={addSlot}
      className={`h-11 px-4 inline-flex items-center gap-2 rounded-xl border text-sm font-medium hover:text-white hover:border-zinc-500 transition-colors ${tone} ${FOCUS_RING}`}
    >
      <Plus className="w-4 h-4" aria-hidden="true" /> Add slot
    </button>
  )

  const bogoMissingItems = type === 'bogo' && (
    bogoSideItemIds(config.buy, menuItems).length === 0 || bogoSideItemIds(config.get, menuItems).length === 0
  )
  const upgradeIds: string[] = type === 'bundle' ? config.upgrades?.item_ids ?? [] : []
  const upgradesInSlots = menuItems.filter((m) =>
    upgradeIds.includes(m.id) && (config.groups ?? []).some((g: Slot) => inSlot({ item_ids: g.item_ids ?? [], category: g.category }, m)),
  )
  const blocker = !name.trim() ? 'Give the deal a name.' : bogoMissingItems ? 'Select at least one buy item and one get item.' : null

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (blocker) return setError(blocker)
    setSaving(true)
    setError(null)
    try {
      let imageUrl = existingImageUrl.trim() || null
      if (imageFile) {
        const fd = new FormData()
        fd.append('file', imageFile)
        const up = await fetch('/api/admin/menu/upload', { method: 'POST', body: fd })
        const upData = await up.json().catch(() => ({}))
        if (!up.ok) throw new Error(`Image upload failed: ${upData.error ?? 'Unknown error'}`)
        imageUrl = upData.url
      }
      const payload = {
        type, name,
        config: type === 'bundle' ? bundleConfigForSave(config) : config,
        custom_label: customLabel.trim() || null,
        available_from: fromDateTimeLocal(availableFrom),
        available_until: fromDateTimeLocal(availableUntil),
        image_url: imageUrl,
      }
      const res = await fetch(isEdit ? `/api/admin/deals/${initial.id}` : '/api/admin/deals', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Save failed')
      toast.success(isEdit ? `Saved ${name.trim()}` : `Created ${name.trim()}`)
      router.push('/admin/deals')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
      setSaving(false)
    }
  }

  const title = isEdit ? 'Edit deal' : `New ${TYPE_LABELS[type]} deal`
  const saveLabel = saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create deal'
  const cancelCls = `h-11 px-4 inline-flex items-center justify-center rounded-xl border border-zinc-700 text-sm font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors ${FOCUS_RING}`
  const saveCls = `h-11 px-5 inline-flex items-center justify-center gap-2 rounded-xl bg-brand-red text-white text-sm font-semibold hover:bg-red-600 transition-colors disabled:opacity-60 ${FOCUS_RING}`
  const saveButton = (className = '') => (
    <button type="submit" form="deal-form" disabled={saving} className={`${saveCls} ${className}`}>
      {saving && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
      {saveLabel}
    </button>
  )
  const cancelLink = (className = '') => (
    <Link href="/admin/deals" onNavigate={guardLeave} className={`${cancelCls} ${className}`}>Cancel</Link>
  )

  return (
    <Shell>
      <header className="sticky top-14 md:top-0 z-20 border-b border-zinc-800 bg-zinc-900/95 backdrop-blur px-4 sm:px-8 py-4">
        <div className="flex items-center gap-4">
          <div className="min-w-0 flex-1">
            <Breadcrumb current={title} onNavigate={guardLeave} />
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <h1 className="text-xl font-bold text-white">{title}</h1>
              <span className="text-[11px] font-bold uppercase tracking-wider text-brand-red px-2 py-0.5 bg-brand-red/10 rounded">{TYPE_LABELS[type]}</span>
              {dirty && (
                <span className="text-[11px] font-semibold text-amber-300 bg-amber-500/15 border border-amber-500/30 rounded-full px-2 py-0.5">Unsaved changes</span>
              )}
            </div>
            {isEdit && <p className="text-sm text-zinc-400 truncate">{initial.name}</p>}
          </div>
          <div className="hidden md:flex items-center gap-3 shrink-0">
            {cancelLink()}
            {saveButton()}
          </div>
        </div>
        {error && (
          <p role="alert" className="mt-3 text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl px-3.5 py-2.5">{error}</p>
        )}
      </header>

      <form id="deal-form" onSubmit={handleSave} noValidate className="px-4 sm:px-8 pt-6 pb-32 md:pb-10 max-w-3xl space-y-6">
        <Card title="Basics" subtitle="How the deal is named and when it runs.">
          <div>
            <label htmlFor="deal-name" className={LABEL_CLS}>Deal name</label>
            <input id="deal-name" value={name} onChange={(e) => setName(e.target.value)} className={INPUT} placeholder="e.g. Buy 1 Get 1 Free Wings" />
          </div>
          <div>
            <label htmlFor="deal-label" className={LABEL_CLS}>Custom label (optional, replaces the automatic badge text)</label>
            <input id="deal-label" value={customLabel} onChange={(e) => setCustomLabel(e.target.value)} placeholder="Leave blank to use the default label" className={INPUT} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="deal-from" className={LABEL_CLS}>Available from (optional)</label>
              <input id="deal-from" type="datetime-local" value={availableFrom} onChange={(e) => setAvailableFrom(e.target.value)} className={INPUT} />
            </div>
            <div>
              <label htmlFor="deal-until" className={LABEL_CLS}>Available until (optional)</label>
              <input id="deal-until" type="datetime-local" value={availableUntil} onChange={(e) => setAvailableUntil(e.target.value)} className={INPUT} />
            </div>
          </div>
          <div>
            <label htmlFor="deal-image" className={LABEL_CLS}>Deal image (optional)</label>
            {existingImageUrl && !imageFile && (
              <div className="relative w-24 h-24 rounded-xl overflow-hidden bg-zinc-800 border border-zinc-700 mb-2">
                <Image src={existingImageUrl} alt="Current deal image" fill className="object-cover" sizes="96px" unoptimized />
              </div>
            )}
            <input
              id="deal-image"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              disabled={saving}
              onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
              className="block text-sm text-zinc-400 file:mr-3 file:h-11 file:px-4 file:rounded-xl file:border-0 file:bg-zinc-800 file:text-white file:text-sm file:font-medium hover:file:bg-zinc-700"
            />
          </div>
        </Card>

        {type === 'bogo' && (
          <>
            <Card title="Discount" subtitle="What the customer saves on the Get items.">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="bogo-discount" className={LABEL_CLS}>Discount</label>
                  <select
                    id="bogo-discount"
                    value={config.get.discount === 'free' ? 'free' : 'percent'}
                    onChange={(e) => set(['get', 'discount'], e.target.value === 'free' ? 'free' : { percent: 50 })}
                    className={SELECT}
                  >
                    <option value="free">Free</option>
                    <option value="percent">Percent off</option>
                  </select>
                </div>
                {config.get.discount !== 'free' && (
                  <div>
                    <label htmlFor="bogo-percent" className={LABEL_CLS}>Percent off</label>
                    <input
                      id="bogo-percent" type="number" min={1} max={100}
                      value={config.get.discount.percent}
                      onChange={(e) => set(['get', 'discount'], { percent: parseInt(e.target.value) || 0 })}
                      className={INPUT}
                    />
                  </div>
                )}
              </div>
            </Card>
            <Card title="Buy" subtitle="The customer buys these.">
              <div className="max-w-[10rem]">
                <label htmlFor="buy-qty" className={LABEL_CLS}>Buy quantity</label>
                <input id="buy-qty" type="number" min={1} value={config.buy.qty} onChange={(e) => set(['buy', 'qty'], parseInt(e.target.value) || 1)} className={INPUT} />
              </div>
              <ItemPicker title="Buy items" itemIds={bogoSideItemIds(config.buy, menuItems)} menuItems={menuItems} categories={categories} onChange={(ids) => setBogoItems('buy', ids)} />
            </Card>
            <Card title="Get" subtitle="The customer gets these at the discount.">
              <div className="max-w-[10rem]">
                <label htmlFor="get-qty" className={LABEL_CLS}>Get quantity</label>
                <input id="get-qty" type="number" min={1} value={config.get.qty} onChange={(e) => set(['get', 'qty'], parseInt(e.target.value) || 1)} className={INPUT} />
              </div>
              <ItemPicker title="Get items" itemIds={bogoSideItemIds(config.get, menuItems)} menuItems={menuItems} categories={categories} onChange={(ids) => setBogoItems('get', ids)} />
            </Card>
          </>
        )}

        {type === 'bundle' && (
          <>
            <Card title="Price" subtitle="What the whole bundle costs.">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="bundle-price-type" className={LABEL_CLS}>Price type</label>
                  <select
                    id="bundle-price-type"
                    value={config.price_type ?? 'fixed'}
                    onChange={(e) => {
                      set(['price_type'], e.target.value)
                      if (e.target.value === 'percent') set(['price'], 0)
                    }}
                    className={SELECT}
                  >
                    <option value="fixed">Fixed price (£)</option>
                    <option value="percent">Percentage off</option>
                  </select>
                </div>
                {(config.price_type ?? 'fixed') === 'percent' ? (
                  <div>
                    <label htmlFor="bundle-percent" className={LABEL_CLS}>Discount %</label>
                    <input id="bundle-percent" type="number" min={1} max={100} value={config.discount_percent ?? ''} onChange={(e) => set(['discount_percent'], parseFloat(e.target.value) || 0)} className={INPUT} />
                  </div>
                ) : (
                  <div>
                    <label htmlFor="bundle-price" className={LABEL_CLS}>Bundle price (£)</label>
                    <input id="bundle-price" type="number" min={0} step="0.01" value={config.price} onChange={(e) => set(['price'], parseFloat(e.target.value) || 0)} className={INPUT} />
                  </div>
                )}
              </div>
            </Card>
            <Card
              title={`Slots (${config.groups.length})`}
              subtitle="Each slot is one choice the customer makes, e.g. Main, Side, Drink."
              action={addSlotButton('bg-zinc-800 border-zinc-600 text-white')}
            >
              <div ref={slotsRef} className="space-y-4">
                {config.groups.map((g: Slot, i: number) => (
                  <div key={i} data-slot>
                    <SlotEditor
                      group={normalizeSlot(g)}
                      menuItems={menuItems}
                      categories={categories}
                      onChange={(next) => set(['groups', i], next)}
                      onRemove={config.groups.length > 1 ? () => set(['groups'], config.groups.filter((_: Slot, gi: number) => gi !== i)) : undefined}
                    />
                  </div>
                ))}
              </div>
              {addSlotButton('border-dashed border-zinc-700 text-zinc-300')}
            </Card>
            <Card title="Upgrades (optional)" subtitle="Paid add-ons offered on the meal deal page at their normal price.">
              <div>
                <label htmlFor="upgrades-label" className={LABEL_CLS}>Section title</label>
                <input
                  id="upgrades-label"
                  value={config.upgrades?.label ?? ''}
                  onChange={(e) => set(['upgrades'], { ...config.upgrades, item_ids: config.upgrades?.item_ids ?? [], label: e.target.value })}
                  placeholder="Upgrade your deal"
                  className={INPUT}
                />
              </div>
              <ItemPicker title="Upgrade items" itemIds={upgradeIds} menuItems={menuItems} categories={categories} onChange={(ids) => set(['upgrades'], { ...config.upgrades, item_ids: ids })} />
              {upgradesInSlots.length > 0 && (
                <p className="text-xs text-amber-400 bg-amber-900/20 border border-amber-800/60 rounded-lg px-3 py-2">
                  {upgradesInSlots.length === 1
                    ? `${upgradesInSlots[0].name} also sits in a slot, so the deal may count it as a bundle item.`
                    : `${upgradesInSlots.map((m) => m.name).join(', ')} also sit in a slot, so the deal may count them as bundle items.`}
                </p>
              )}
            </Card>
          </>
        )}

        {type === 'order_discount' && (
          <Card title="Discount" subtitle="Taken off the whole order or one category.">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="od-scope" className={LABEL_CLS}>Applies to</label>
                <select id="od-scope" value={config.scope} onChange={(e) => set(['scope'], e.target.value)} className={SELECT}>
                  <option value="order">Whole order</option>
                  <option value="category">Specific category</option>
                </select>
              </div>
              {config.scope === 'category' && (
                <div>
                  <label htmlFor="od-category" className={LABEL_CLS}>Category</label>
                  <select id="od-category" value={config.category ?? ''} onChange={(e) => set(['category'], e.target.value)} className={SELECT}>
                    <option value="">— choose category —</option>
                    {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label htmlFor="od-type" className={LABEL_CLS}>Discount type</label>
                <select id="od-type" value={config.discount.type} onChange={(e) => set(['discount', 'type'], e.target.value)} className={SELECT}>
                  <option value="percent">Percent</option>
                  <option value="amount">Amount (£)</option>
                </select>
              </div>
              <div>
                <label htmlFor="od-value" className={LABEL_CLS}>Value</label>
                <input id="od-value" type="number" min={0} step="0.01" value={config.discount.value} onChange={(e) => set(['discount', 'value'], parseFloat(e.target.value) || 0)} className={INPUT} />
              </div>
              <div>
                <label htmlFor="od-min" className={LABEL_CLS}>Minimum subtotal (£, optional)</label>
                <input id="od-min" type="number" min={0} step="0.01" value={config.min_subtotal ?? ''} onChange={(e) => set(['min_subtotal'], e.target.value ? parseFloat(e.target.value) : undefined)} className={INPUT} />
              </div>
            </div>
          </Card>
        )}
      </form>

      {/* Mobile action bar */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-20 border-t border-zinc-800 bg-zinc-900/95 backdrop-blur px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex gap-3">
        {cancelLink('flex-1')}
        {saveButton('flex-1')}
      </div>
    </Shell>
  )
}
