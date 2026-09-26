'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import {
  AlertTriangle, ChevronDown, ChevronLeft, Copy, ExternalLink, Image as ImageIcon, Loader2, Plus, Trash2, UploadCloud, X,
} from 'lucide-react'
import AdminSidebar from '@/components/admin/admin-sidebar'
import { DEFAULT_SELECT_MODES, hasNoCustomization, toModifierConfig, type ModifierConfig } from '@/lib/order-modifiers'
import { customizerLayout, type LayoutSection } from '@/lib/customizer-layout'
import type { DbCategory, Extra, MenuItem, SelectMode } from './types'
import {
  COMMON_ALLERGENS, DIETARY_FLAGS, FOCUS_RING, INPUT_BASE, LABEL_CLS, ADD_BTN_CLS, PRICED_CATEGORIES, TAG_INPUT_CLS, type PricedKey,
} from './constants'
import { ExtraNameInput, PricedSection, TagSection } from './option-editors'
import DeleteConfirmModal from './DeleteConfirmModal'

// ─── Page shell (admin sidebar + content column, like every admin page) ──────

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
          <Link href="/admin" onNavigate={onNavigate} className={`inline-flex items-center gap-1 rounded hover:text-white transition-colors ${FOCUS_RING}`}>
            <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" /> Menu Manager
          </Link>
        </li>
        <li aria-hidden="true">›</li>
        <li aria-current="page" className="text-zinc-300">{current}</li>
      </ol>
    </nav>
  )
}

/** Loads the item (edit, or the source of a duplicate) and the categories, then shows the form. */
export default function MenuItemEditor({ itemId, fromId }: { itemId?: string; fromId?: string }) {
  const sourceId = itemId ?? fromId
  const [source, setSource] = useState<MenuItem | null>(null)
  const [categories, setCategories] = useState<DbCategory[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/categories')
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setCategories(Array.isArray(d) ? d : []))
      .catch(() => setCategories([]))
  }, [])

  useEffect(() => {
    if (!sourceId) return
    fetch(`/api/admin/menu-items/${encodeURIComponent(sourceId)}`)
      .then(async (r) => {
        const d = await r.json().catch(() => ({}))
        if (r.status === 404) throw new Error('This menu item no longer exists. It may have been deleted.')
        if (!r.ok) throw new Error(d.error ?? 'Could not load this menu item.')
        setSource(d)
      })
      .catch((e: Error) => setLoadError(e.message))
  }, [sourceId])

  const title = itemId ? 'Edit item' : 'New menu item'

  if (loadError) {
    return (
      <Shell>
        <div className="px-4 sm:px-8 py-6 space-y-6">
          <Breadcrumb current={title} />
          <div role="alert" className="max-w-lg rounded-2xl border border-red-500/30 bg-red-500/10 p-6">
            <AlertTriangle className="w-6 h-6 text-red-400 mb-3" aria-hidden="true" />
            <p className="text-white font-semibold">{loadError}</p>
            <Link href="/admin" className={`inline-flex items-center mt-4 h-11 px-4 rounded-xl bg-zinc-800 text-sm font-medium text-white hover:bg-zinc-700 ${FOCUS_RING}`}>
              Back to Menu Manager
            </Link>
          </div>
        </div>
      </Shell>
    )
  }

  if (!categories || (sourceId && !source)) {
    return (
      <Shell>
        <div className="px-4 sm:px-8 py-6 space-y-6" aria-busy="true">
          <Breadcrumb current={title} />
          <p className="sr-only" role="status">Loading…</p>
          <div className="grid gap-6 lg:grid-cols-12">
            <div className="lg:col-span-8 space-y-6">
              {[0, 1, 2].map((i) => <div key={i} className="h-56 rounded-2xl bg-zinc-900 border border-zinc-800 animate-pulse" />)}
            </div>
            <div className="hidden lg:block lg:col-span-4 h-96 rounded-2xl bg-zinc-900 border border-zinc-800 animate-pulse" />
          </div>
        </div>
      </Shell>
    )
  }

  return <EditorForm source={source} isEdit={!!itemId} categories={categories} />
}

// ─── Layout of the options, in the store customizer's order ──────────────────

type SectionKey = PricedKey | 'ingredients'
interface GroupDef { number: string; title: string; subtitle: string; sections: { key: SectionKey; title: string }[] }

// Mirrors lib/customizer-layout.ts. The admin shows all 7 groups; the store hides empty ones and renumbers.
const GROUPS: GroupDef[] = [
  {
    number: '01', title: 'Item Customize', subtitle: 'Heat, included ingredients and extras.',
    sections: [
      { key: 'spicy_levels', title: 'Spicy Level' },
      { key: 'ingredients', title: 'Ingredients' },
      { key: 'extra_ingredients', title: 'Extra Ingredients' },
    ],
  },
  { number: '02', title: 'Drinks', subtitle: 'A regular drink or a large upgrade.', sections: [{ key: 'drinks_regular', title: 'Regular Drinks' }, { key: 'drinks_large', title: 'Large Drinks' }] },
  { number: '03', title: 'Sides', subtitle: 'Something extra on the side.', sections: [{ key: 'sides', title: 'Sides' }] },
  { number: '04', title: 'Fries', subtitle: 'Portion and seasoning.', sections: [{ key: 'fries_regular', title: 'Regular Fries' }, { key: 'fries_large', title: 'Large Fries' }] },
  { number: '05', title: 'Dips', subtitle: 'House sauces for dipping.', sections: [{ key: 'dips', title: 'Dips' }] },
  { number: '06', title: 'Add-ons', subtitle: 'Extras customers can add.', sections: [{ key: 'add_ons', title: 'Add-ons' }] },
  { number: '07', title: 'Other Extras', subtitle: 'Anything that fits no other group.', sections: [{ key: 'other_extras', title: 'Other Extras' }] },
]

const INGREDIENTS_HINT = 'Included — customers can remove'
const hintOf = (key: SectionKey) => key === 'ingredients' ? INGREDIENTS_HINT : PRICED_CATEGORIES.find((c) => c.key === key)!.hint

// Collapsible group card: #1A1A1A header with a red number chip, like the store. Empty groups start collapsed.
function GroupCard({ number, title, subtitle, count, children }: { number: string; title: string; subtitle: string; count: number; children: React.ReactNode }) {
  const [initiallyOpen] = useState(count > 0)
  return (
    <details open={initiallyOpen} className="group rounded-2xl border border-zinc-800 bg-zinc-900 overflow-hidden">
      <summary className={`flex items-center gap-3 bg-brand-dark px-4 sm:px-5 py-4 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-red`}>
        <span aria-hidden="true" className="w-8 h-8 shrink-0 rounded-full bg-brand-red text-white text-xs font-bold flex items-center justify-center tabular-nums">
          {number}
        </span>
        <span className="min-w-0 flex-1">
          <h3 className="font-heading font-bold text-white">{title}</h3>
          <span className="block text-sm text-white/70 truncate">{subtitle}</span>
        </span>
        <span className={`shrink-0 text-xs font-medium rounded-full px-2.5 py-1 tabular-nums ${count > 0 ? 'bg-white/10 text-white' : 'text-white/60'}`}>
          {count > 0 ? `${count} option${count === 1 ? '' : 's'}` : 'Empty'}
        </span>
        <ChevronDown className="w-4 h-4 shrink-0 text-white/70 transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="p-4 sm:p-5 space-y-5">{children}</div>
    </details>
  )
}

function Card({ title, children, className = '' }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section aria-label={title} className={`rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6 space-y-4 ${className}`}>
      <h2 className="text-base font-semibold text-white">{title}</h2>
      {children}
    </section>
  )
}

// ─── Form ─────────────────────────────────────────────────────────────────────

type FieldKey = 'name' | 'price' | 'compare_at_price' | 'category'
const FIELD_ORDER: FieldKey[] = ['name', 'price', 'compare_at_price', 'category']
// Server messages start with the field's label (lib/menu-item-input.ts)
const SERVER_FIELD_PREFIX: [string, FieldKey][] = [['Name', 'name'], ['Price', 'price'], ['Compare-at', 'compare_at_price'], ['Category', 'category']]

const EMPTY_FORM = { name: '', description: '', price: '', compare_at_price: '', image_url: '', category: '' }

const pad2 = (n: number) => String(n).padStart(2, '0')

function sectionCount(s: LayoutSection, config: ModifierConfig): number {
  if (s.kind === 'spicy') return config.spicyLevels.length
  if (s.kind === 'ingredients') return config.ingredients.length
  return (s.category?.options.length ?? 0) + (s.kind === 'extras' ? config.additions.length : 0)
}

function validate(form: typeof EMPTY_FORM): Partial<Record<FieldKey, string>> {
  const errors: Partial<Record<FieldKey, string>> = {}
  const name = form.name.trim()
  if (!name) errors.name = 'Enter a name.'
  else if (name.length > 80) errors.name = 'Name must be 80 characters or fewer.'
  const price = parseFloat(form.price)
  if (isNaN(price) || price <= 0) errors.price = 'Enter a price more than £0.00.'
  else if (price > 1000) errors.price = 'Price must be £1000.00 or less.'
  if (form.compare_at_price.trim()) {
    const compare = parseFloat(form.compare_at_price)
    if (isNaN(compare) || compare <= 0) errors.compare_at_price = 'Enter a compare-at price more than £0.00, or leave it blank.'
  }
  if (!form.category) errors.category = 'Choose a category.'
  return errors
}

function EditorForm({ source, isEdit, categories }: { source: MenuItem | null; isEdit: boolean; categories: DbCategory[] }) {
  const router = useRouter()
  const [form, setForm] = useState(() =>
    source
      ? {
        name: isEdit ? source.name : `${source.name} (copy)`,
        description: source.description ?? '',
        price: source.price.toFixed(2),
        compare_at_price: source.compare_at_price != null ? source.compare_at_price.toFixed(2) : '',
        image_url: source.image_url ?? '',
        category: source.category,
      }
      : { ...EMPTY_FORM, category: categories[0]?.slug ?? '' }
  )
  const [isAvailable, setIsAvailable] = useState(source?.is_available ?? true)
  const [ingredients, setIngredients] = useState<string[]>(() => source?.ingredients ?? [])
  const [priced, setPriced] = useState<Record<PricedKey, Extra[]>>(() => {
    const init = Object.fromEntries(PRICED_CATEGORIES.map((c) => [c.key, source?.[c.key] ?? []])) as Record<PricedKey, Extra[]>
    // Legacy free "additions" (the old separate list) join Extra Ingredients at £0.00, so saving
    // this item (which clears additions) never drops an extra customers could still pick.
    const legacy = (source?.additions ?? []).filter((n) => !init.extra_ingredients.some((e) => e.name === n))
    if (legacy.length) init.extra_ingredients = [...init.extra_ingredients, ...legacy.map((name) => ({ name, price: 0 }))]
    return init
  })
  const [modes, setModes] = useState<Record<string, SelectMode>>(() => ({
    ...DEFAULT_SELECT_MODES,
    ...source?.modifier_select_modes,
    // Only legacy free additions became Extra Ingredients: keep their tick-once behaviour (as migration 20260926e does)
    ...(source?.additions?.length && !source.extra_ingredients?.length ? { extra_ingredients: 'pick' as const } : {}),
  }))
  const [soldOutExtras, setSoldOutExtras] = useState<string[]>(() => source?.sold_out_extras ?? [])
  const [dietaryFlags, setDietaryFlags] = useState<string[]>(() => source?.dietary_flags ?? [])
  const [allergens, setAllergens] = useState<string[]>(() => source?.allergens ?? [])
  const [allergenInput, setAllergenInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldKey, string>>>({})
  const [showDelete, setShowDelete] = useState(false)
  const [suggestions, setSuggestions] = useState<{ removals: string[]; extras: string[]; allergens: string[] }>({ removals: [], extras: [], allergens: [] })
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageUploading, setImageUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Dirty when anything differs from how the page opened
  const snapshot = JSON.stringify([form, isAvailable, ingredients, priced, modes, soldOutExtras, dietaryFlags, allergens, imageFile && `${imageFile.name}:${imageFile.size}`])
  const [baseline] = useState(snapshot)
  const dirty = snapshot !== baseline && !saving

  // Reload / tab close. App Router has no in-app navigation block, so the back and cancel links confirm themselves.
  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  const guardLeave = (e: { preventDefault: () => void }) => {
    if (dirty && !window.confirm('You have unsaved changes. Leave without saving?')) e.preventDefault()
  }

  useEffect(() => {
    fetch('/api/admin/menu/suggestions')
      .then((r) => r.json())
      .then((d) => setSuggestions({
        removals: Array.isArray(d?.removals) ? d.removals : [],
        extras: Array.isArray(d?.extras) ? d.extras : [],
        allergens: Array.isArray(d?.allergens) ? d.allergens : [],
      }))
      .catch(() => { })
  }, [])

  const field = (key: keyof typeof EMPTY_FORM) => ({
    id: `item-${key}`,
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setForm((f) => ({ ...f, [key]: e.target.value }))
      if (key in fieldErrors) setFieldErrors((prev) => ({ ...prev, [key]: undefined }))
    },
  })

  const errorProps = (key: FieldKey, hintId?: string) => {
    const describedBy = [fieldErrors[key] && `item-${key}-error`, hintId].filter(Boolean).join(' ')
    return { 'aria-invalid': fieldErrors[key] ? true : undefined, 'aria-describedby': describedBy || undefined }
  }

  const fieldError = (name: FieldKey) =>
    fieldErrors[name] ? <p id={`item-${name}-error`} className="mt-1.5 text-xs text-red-400">{fieldErrors[name]}</p> : null

  function showFieldErrors(errors: Partial<Record<FieldKey, string>>) {
    setFieldErrors(errors)
    const first = FIELD_ORDER.find((k) => errors[k])
    if (first) document.getElementById(`item-${first}`)?.focus()
  }

  // Labels of other categories (priced + ingredients) already using this name
  function labelsUsing(name: string, exceptKey: string): string[] {
    if (!name) return []
    const labels: string[] = PRICED_CATEGORIES
      .filter((c) => c.key !== exceptKey && priced[c.key].some((e) => e.name === name))
      .map((c) => c.label)
    if (exceptKey !== 'ingredients' && ingredients.includes(name)) labels.push('Ingredients')
    return labels
  }

  function addAllergen() {
    const val = allergenInput.trim()
    if (!val || allergens.includes(val)) return
    setAllergens((prev) => [...prev, val])
    setAllergenInput('')
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  function clearImage() {
    setImageFile(null)
    setImagePreview(null)
    setForm((f) => ({ ...f, image_url: '' }))
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    const errors = validate(form)
    if (Object.keys(errors).length) return showFieldErrors(errors)
    setFieldErrors({})
    setSaving(true)

    try {
      // Upload the file first; its URL takes priority over the text field. Keep it so a retry doesn't upload again.
      let resolvedImageUrl = form.image_url.trim() || null
      if (imageFile) {
        setImageUploading(true)
        const fd = new FormData()
        fd.append('file', imageFile)
        const uploadRes = await fetch('/api/admin/menu/upload', { method: 'POST', body: fd })
        const uploadData = await uploadRes.json().catch(() => ({}))
        setImageUploading(false)
        if (!uploadRes.ok) throw new Error(`Image upload failed: ${uploadData.error ?? 'Unknown error'}`)
        resolvedImageUrl = uploadData.url
        setForm((f) => ({ ...f, image_url: uploadData.url }))
        setImageFile(null)
      }

      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        price: parseFloat(form.price),
        compare_at_price: form.compare_at_price.trim() ? parseFloat(form.compare_at_price) : null,
        image_url: resolvedImageUrl,
        category: form.category,
        is_available: isAvailable,
        // sold_out_extras matches by name against the union of all priced categories
        sold_out_extras: soldOutExtras.filter((n) => PRICED_CATEGORIES.some((c) => priced[c.key].some((e) => e.name === n))),
        // Free extras now live in extra_ingredients at £0.00 (migration 20260926e)
        additions: [],
        ingredients,
        ...priced,
        modifier_select_modes: modes,
        dietary_flags: dietaryFlags,
        allergens,
      }

      const res = await fetch(isEdit ? `/api/admin/menu-items/${source!.id}` : '/api/admin/menu-items', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const message: string = data.error ?? (isEdit ? 'Failed to update item' : 'Failed to add item')
        const fieldKey = res.status === 400 ? SERVER_FIELD_PREFIX.find(([p]) => message.startsWith(p))?.[1] : undefined
        if (fieldKey) showFieldErrors({ [fieldKey]: `${message}.` })
        else setFormError(message)
        setSaving(false)
        return
      }
      router.push(`/admin?saved=${encodeURIComponent(data.name ?? payload.name)}`)
    } catch (err) {
      setImageUploading(false)
      setSaving(false)
      setFormError(err instanceof Error ? err.message : 'Unknown error')
    }
  }

  async function handleDelete() {
    const res = await fetch(`/api/admin/menu-items/${source!.id}`, { method: 'DELETE' })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setShowDelete(false)
      setFormError(d.error ?? 'Could not delete this item.')
      return
    }
    toast.success(`Deleted ${source!.name}`)
    router.push('/admin')
  }

  // ─── Live preview data ──────────────────────────────────────────────────────
  const priceNum = parseFloat(form.price)
  const compareNum = parseFloat(form.compare_at_price)
  const isOffer = !isNaN(priceNum) && !isNaN(compareNum) && compareNum > priceNum
  const photo = imagePreview ?? (form.image_url.trim() || null)
  // What the store will read after saving. Legacy extras/removals stay on the row (edit only) and still show.
  const config = toModifierConfig({
    ...priced,
    ingredients,
    additions: [],
    modifier_select_modes: modes,
    ...(isEdit && source ? { extras: source.extras, removals: source.removals } : {}),
  })
  const layout = customizerLayout(config)
  const simple = hasNoCustomization(config)

  const title = isEdit ? 'Edit item' : 'New menu item'
  const saveLabel = saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add item'
  const cancelCls = `h-11 px-4 inline-flex items-center justify-center rounded-xl border border-zinc-700 text-sm font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors ${FOCUS_RING}`
  const saveCls = `h-11 px-5 inline-flex items-center justify-center gap-2 rounded-xl bg-brand-red text-white text-sm font-semibold hover:bg-red-600 transition-colors disabled:opacity-60 ${FOCUS_RING}`
  const saveButton = (className = '') => (
    <button type="submit" form="item-form" disabled={saving} className={`${saveCls} ${className}`}>
      {saving && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
      {saveLabel}
    </button>
  )
  const cancelLink = (className = '') => (
    <Link href="/admin" onNavigate={guardLeave} className={`${cancelCls} ${className}`}>Cancel</Link>
  )

  return (
    <Shell>
      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-zinc-800 bg-zinc-900/95 backdrop-blur px-4 sm:px-8 py-4">
        <div className="flex items-center gap-4">
          <div className="min-w-0 flex-1">
            <Breadcrumb current={title} onNavigate={guardLeave} />
            <div className="flex items-center gap-2 mt-1">
              <h1 className="text-xl font-bold text-white">{title}</h1>
              {dirty && (
                <span className="shrink-0 text-[11px] font-semibold text-amber-300 bg-amber-500/15 border border-amber-500/30 rounded-full px-2 py-0.5">
                  Unsaved changes
                </span>
              )}
            </div>
            {isEdit && <p className="text-sm text-zinc-400 truncate">{source!.name}</p>}
          </div>
          <div className="hidden md:flex items-center gap-3 shrink-0">
            {cancelLink()}
            {saveButton()}
          </div>
        </div>
        {formError && (
          <p role="alert" className="mt-3 text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl px-3.5 py-2.5">{formError}</p>
        )}
      </header>

      <form id="item-form" onSubmit={handleSubmit} noValidate className="px-4 sm:px-8 pt-6 pb-32 md:pb-10 grid gap-6 lg:grid-cols-12 items-start">
        {/* ── Basics ── */}
        <Card title="Basics" className="lg:col-start-1 lg:col-span-8">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            {/* 4:3 + object-cover: the same crop as the customer store card (app/order MenuCard) */}
            <div className="relative w-full sm:w-56 aspect-[4/3] shrink-0 rounded-2xl overflow-hidden bg-zinc-800 border border-zinc-700 flex items-center justify-center">
              {photo ? (
                <>
                  <Image src={photo} alt="Item photo preview" fill className="object-cover" sizes="(max-width: 640px) 100vw, 224px" unoptimized />
                  <button
                    type="button"
                    onClick={clearImage}
                    aria-label="Remove photo"
                    className={`absolute top-1 right-1 h-11 w-11 flex items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors ${FOCUS_RING}`}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <ImageIcon className="w-6 h-6 text-zinc-600" aria-hidden="true" />
              )}
            </div>
            <div className="flex-1 min-w-0 space-y-2">
              <label className={`flex items-center justify-center gap-2 w-full h-11 rounded-xl border border-dashed text-sm font-medium transition-colors focus-within:ring-2 focus-within:ring-brand-red
                ${imageUploading ? 'border-zinc-700 text-zinc-600 cursor-not-allowed' : 'border-zinc-600 text-zinc-300 hover:border-brand-red hover:text-white cursor-pointer'}`}>
                {imageUploading
                  ? <><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Uploading…</>
                  : <><UploadCloud className="w-4 h-4" aria-hidden="true" /> Upload photo</>}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="sr-only"
                  disabled={imageUploading}
                  onChange={handleFileChange}
                />
              </label>
              <input
                {...field('image_url')}
                type="url"
                placeholder="Or paste an image URL"
                aria-label="Image URL"
                className={`w-full ${TAG_INPUT_CLS}`}
                disabled={!!imageFile}
              />
            </div>
          </div>
          <p className="text-xs text-zinc-400">
            Shown as 4:3 on the store, cropped to fill. Best at 1200 × 900 px.
            {imageFile && ' The uploaded photo replaces the URL.'}
          </p>

          <div>
            <label htmlFor="item-name" className={LABEL_CLS}>Name <span className="text-red-400" aria-hidden="true">*</span></label>
            <input {...field('name')} {...errorProps('name')} required maxLength={80} placeholder="e.g. Spicy Chicken Burger" className={`w-full ${TAG_INPUT_CLS}`} />
            {fieldError('name')}
          </div>
          <div>
            <label htmlFor="item-description" className={LABEL_CLS}>Description</label>
            <textarea
              {...field('description')}
              rows={2}
              placeholder="Short description of the item"
              className={`w-full resize-none py-2.5 ${INPUT_BASE}`}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="item-price" className={LABEL_CLS}>Price (£) <span className="text-red-400" aria-hidden="true">*</span></label>
              <input
                {...field('price')}
                {...errorProps('price')}
                required
                type="number" step="0.01" min="0" inputMode="decimal" placeholder="0.00"
                className={`w-full [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none ${TAG_INPUT_CLS}`}
              />
              {fieldError('price')}
            </div>
            <div>
              <label htmlFor="item-category" className={LABEL_CLS}>Category <span className="text-red-400" aria-hidden="true">*</span></label>
              <div className="relative">
                <select {...field('category')} {...errorProps('category')} required className={`w-full appearance-none pr-9 ${TAG_INPUT_CLS}`}>
                  {!form.category && <option value="">Choose a category</option>}
                  {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" aria-hidden="true" />
              </div>
              {fieldError('category')}
            </div>
          </div>
          <div>
            <label htmlFor="item-compare_at_price" className={LABEL_CLS}>Compare-at price (optional)</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 text-sm pointer-events-none">£</span>
              <input
                {...field('compare_at_price')}
                {...errorProps('compare_at_price', 'item-compare-hint')}
                type="number" step="0.01" min="0" inputMode="decimal" placeholder="0.00"
                className={`w-full pl-8 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none ${TAG_INPUT_CLS}`}
              />
            </div>
            {fieldError('compare_at_price')}
            <p id="item-compare-hint" className="text-xs text-zinc-400 mt-1.5">
              If higher than the price, the menu shows an offer badge with the original price crossed out.
            </p>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-xl border border-zinc-800 bg-zinc-800/30 px-4 py-2">
            <div className="min-w-0">
              <p id="item-available-label" className="text-sm font-medium text-white">Available on the menu</p>
              <p id="item-available-hint" className="text-xs text-zinc-400">
                {isAvailable ? 'Customers can order this item.' : 'Hidden from the store until you turn it back on.'}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={isAvailable}
              aria-labelledby="item-available-label"
              aria-describedby="item-available-hint"
              onClick={() => setIsAvailable((v) => !v)}
              className={`h-11 w-14 shrink-0 flex items-center justify-center rounded-full ${FOCUS_RING}`}
            >
              <span className={`relative inline-flex h-6 w-11 rounded-full transition-colors ${isAvailable ? 'bg-emerald-500' : 'bg-zinc-600'}`}>
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${isAvailable ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </span>
            </button>
          </div>
        </Card>

        {/* ── Side panel: sticky on desktop, after Basics on mobile ── */}
        <aside aria-label="Preview and actions" className="space-y-4 lg:col-start-9 lg:col-span-4 lg:row-start-1 lg:row-span-4 lg:self-start lg:sticky lg:top-32">
          {/* Live preview, styled like the store card */}
          <section aria-label="Live preview" className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Live preview</h2>
            <div className={`bg-white rounded-2xl overflow-hidden ${isAvailable ? '' : 'opacity-60 grayscale'}`}>
              <div className="relative aspect-[4/3] bg-zinc-100 flex items-center justify-center">
                {photo
                  ? <Image src={photo} alt="" fill className="object-cover" sizes="320px" unoptimized />
                  : <ImageIcon className="w-8 h-8 text-zinc-300" aria-hidden="true" />}
                {isOffer && (
                  <span className="absolute top-0 right-0 bg-brand-red text-white text-[11px] font-black px-3 py-2 rounded-bl-2xl">OFFER</span>
                )}
              </div>
              <div className="p-4 space-y-1">
                <p className="font-heading font-bold text-zinc-900 leading-tight">{form.name.trim() || 'Item name'}</p>
                {form.description.trim() && <p className="text-xs text-zinc-600 line-clamp-2">{form.description.trim()}</p>}
                <div className="pt-1">
                  {!isAvailable ? (
                    <span className="font-heading font-black text-sm text-zinc-500">Sold Out</span>
                  ) : isOffer ? (
                    <span className="flex items-baseline gap-2">
                      <span className="text-xs text-zinc-500 line-through">£{compareNum.toFixed(2)}</span>
                      <span className="font-heading font-black text-lg text-brand-red">£{priceNum.toFixed(2)}</span>
                    </span>
                  ) : (
                    <span className="font-heading font-black text-lg text-zinc-900">{isNaN(priceNum) ? '£0.00' : `£${priceNum.toFixed(2)}`}</span>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* What the customer page will show, with the store's own gap-free numbering */}
          <section aria-label="Customer page" className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Customer page</h2>
            {simple ? (
              <p className="text-sm text-zinc-300">Simple item: adds straight to the bag.</p>
            ) : (
              <ol className="space-y-2 text-sm">
                {layout.map((g) => (
                  <li key={g.key}>
                    <span className="flex items-center gap-2 text-white font-medium">
                      <span className="w-6 h-6 shrink-0 rounded-full bg-brand-red text-white text-[10px] font-bold flex items-center justify-center tabular-nums" aria-hidden="true">{g.number}</span>
                      <span><span className="sr-only">{g.number} </span>{g.title}{g.flat && ` (${sectionCount(g.sections[0], config)})`}</span>
                    </span>
                    {!g.flat && (
                      <ul className="mt-1 ml-8 space-y-0.5 text-zinc-400">
                        {g.sections.map((s) => <li key={s.key}>{s.number} {s.title} ({sectionCount(s, config)})</li>)}
                      </ul>
                    )}
                  </li>
                ))}
                {[`Special Instructions`, `Your Selection`].map((t, i) => (
                  <li key={t} className="flex items-center gap-2 text-zinc-400">
                    <span className="w-6 h-6 shrink-0 rounded-full border border-zinc-700 text-[10px] font-bold flex items-center justify-center tabular-nums" aria-hidden="true">{pad2(layout.length + 1 + i)}</span>
                    <span><span className="sr-only">{pad2(layout.length + 1 + i)} </span>{t}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>

          {isEdit && (
            <div className="grid grid-cols-2 gap-3">
              <a
                href={`/order/customize/${source!.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className={`${cancelCls} gap-2`}
              >
                <ExternalLink className="w-4 h-4" aria-hidden="true" /> View on store<span className="sr-only"> (opens in a new tab)</span>
              </a>
              <Link href={`/admin/menu/new?from=${source!.id}`} onNavigate={guardLeave} className={`${cancelCls} gap-2`}>
                <Copy className="w-4 h-4" aria-hidden="true" /> Duplicate
              </Link>
            </div>
          )}

          <div className="hidden lg:flex gap-3">
            {cancelLink('flex-1')}
            {saveButton('flex-1')}
          </div>
        </aside>

        {/* ── Dietary & allergens ── */}
        <Card title="Dietary & allergens" className="lg:col-start-1 lg:col-span-8">
          <fieldset>
            <legend className={LABEL_CLS}>Dietary flags</legend>
            <div className="flex flex-wrap gap-2">
              {DIETARY_FLAGS.map((flag) => {
                const active = dietaryFlags.includes(flag)
                return (
                  <button
                    key={flag}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setDietaryFlags((prev) => active ? prev.filter((f) => f !== flag) : [...prev, flag])}
                    className={`h-11 text-sm px-4 rounded-full font-medium transition-colors border ${FOCUS_RING} ${active
                      ? 'bg-brand-red/20 border-brand-red/50 text-red-200'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200'
                      }`}
                  >
                    {flag}
                  </button>
                )
              })}
            </div>
          </fieldset>
          <div>
            <p className={LABEL_CLS}>Allergens shown to customers</p>
            <div className="flex gap-2">
              <ExtraNameInput
                value={allergenInput}
                onChange={setAllergenInput}
                onEnter={addAllergen}
                suggestions={[...new Set([...COMMON_ALLERGENS, ...suggestions.allergens])]}
                placeholder="e.g. Gluten, Dairy, Nuts…"
                ariaLabel="Add an allergen"
              />
              <button type="button" onClick={addAllergen} aria-label="Add allergen" className={ADD_BTN_CLS}>
                <Plus className="w-4 h-4" />
              </button>
            </div>
            {allergens.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {allergens.map((a) => (
                  <span key={a} className="flex items-center gap-1 bg-amber-900/30 text-amber-200 border border-amber-700/40 text-sm pl-3 pr-1 py-1 rounded-full">
                    {a}
                    <button type="button" aria-label={`Remove ${a}`} onClick={() => setAllergens((prev) => prev.filter((x) => x !== a))} className={`h-8 w-8 flex items-center justify-center rounded-full text-amber-400 hover:text-white hover:bg-amber-800/50 transition-colors ${FOCUS_RING}`}>
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* ── Customer options, in the store's order ── */}
        <section aria-labelledby="options-title" className="space-y-3 lg:col-start-1 lg:col-span-8">
          <div className="px-0.5">
            <h2 id="options-title" className="text-base font-semibold text-white">Customer options</h2>
            <p className="text-xs text-zinc-400">Same order as the store&rsquo;s customize page. Empty groups are hidden from customers and the rest renumber.</p>
          </div>
          {GROUPS.map((g) => {
            const count = g.sections.reduce((n, s) => n + (s.key === 'ingredients' ? ingredients.length : priced[s.key].length), 0)
            const nested = g.sections.length > 1
            return (
              <GroupCard key={g.number} number={g.number} title={g.title} subtitle={g.subtitle} count={count}>
                {g.sections.map((s, i) => (
                  <div key={s.key} className="space-y-3">
                    {/* #626262 bar: white 6.1:1, white/90 hint 5.3:1 */}
                    {nested ? (
                      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 bg-[#626262] rounded-lg px-3 py-2">
                        <h4 className="text-xs font-bold tracking-wide uppercase text-white">{Number(g.number)}.{i + 1} {s.title}</h4>
                        <span className="text-xs text-white/90">{hintOf(s.key)}</span>
                      </div>
                    ) : (
                      <p className="text-xs text-zinc-400">{hintOf(s.key)}</p>
                    )}
                    {s.key === 'ingredients' ? (
                      <TagSection
                        title="Ingredients"
                        placeholder="e.g. Pickles"
                        items={ingredients}
                        onChange={setIngredients}
                        suggestions={suggestions.removals}
                        warnFor={(n) => labelsUsing(n, 'ingredients')}
                      />
                    ) : (
                      <PricedSection
                        title={s.title}
                        placeholder={PRICED_CATEGORIES.find((c) => c.key === s.key)!.placeholder}
                        items={priced[s.key]}
                        onChange={(next) => setPriced((prev) => ({ ...prev, [s.key]: next }))}
                        soldOut={soldOutExtras}
                        onToggle86={(name) => setSoldOutExtras((prev) => prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name])}
                        // 86 is by name: carry it to the new name. The old name is pruned on save if nothing else uses it.
                        onRename={(from, to) => setSoldOutExtras((prev) => prev.includes(from) && !prev.includes(to) ? [...prev, to] : prev)}
                        suggestions={s.key === 'spicy_levels' ? [] : suggestions.extras}
                        mode={modes[s.key]}
                        onModeChange={(m) => setModes((prev) => ({ ...prev, [s.key]: m }))}
                        warnFor={(n) => labelsUsing(n, s.key)}
                        isSpicy={s.key === 'spicy_levels'}
                      />
                    )}
                  </div>
                ))}
              </GroupCard>
            )
          })}
        </section>

        {/* ── Danger zone ── */}
        {isEdit && (
          <section aria-labelledby="danger-title" className="rounded-2xl border border-red-500/30 bg-red-500/5 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 lg:col-start-1 lg:col-span-8">
            <div>
              <h2 id="danger-title" className="text-base font-semibold text-white">Delete item</h2>
              <p className="text-sm text-zinc-400">Removes {source!.name} from the menu for good.</p>
            </div>
            <button type="button" onClick={() => setShowDelete(true)} className={`h-11 px-4 inline-flex items-center justify-center gap-2 rounded-xl border border-red-500/50 text-sm font-semibold text-red-300 hover:bg-red-500/15 transition-colors ${FOCUS_RING}`}>
              <Trash2 className="w-4 h-4" aria-hidden="true" /> Delete item
            </button>
          </section>
        )}
      </form>

      {/* Mobile action bar. Left padding clears the sidebar's menu button (fixed bottom-6 left-4). */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-20 border-t border-zinc-800 bg-zinc-900/95 backdrop-blur pl-20 pr-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex gap-3">
        {cancelLink('flex-1')}
        {saveButton('flex-1')}
      </div>

      {showDelete && source && (
        <DeleteConfirmModal name={source.name} onClose={() => setShowDelete(false)} onConfirm={handleDelete} />
      )}
    </Shell>
  )
}
