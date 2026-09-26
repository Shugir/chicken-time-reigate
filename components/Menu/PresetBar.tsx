'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Heart, X } from 'lucide-react'
import { cleanPresetName, PRESET_NAME_MAX, PRESETS_PER_ITEM_MAX, type SavedPreset } from '@/lib/presets'

/** Chips for the signed-in customer's saved builds of this item. Render only when there is at least one. */
export default function PresetBar({
  presets, onApply, onDelete,
}: {
  presets: SavedPreset[]
  onApply: (preset: SavedPreset) => void
  onDelete: (preset: SavedPreset) => void
}) {
  return (
    <section aria-label="Your presets" className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-semibold text-brand-dark">Your presets:</span>
      {presets.map((p) => (
        <span key={p.id} className="inline-flex items-center rounded-2xl border border-zinc-200 bg-white">
          <button
            type="button"
            onClick={() => onApply(p)}
            className="min-h-[44px] pl-3 pr-1 text-sm font-semibold text-brand-dark hover:text-brand-red transition-colors"
          >
            {p.name}
          </button>
          <button
            type="button"
            onClick={() => onDelete(p)}
            aria-label={`Delete preset ${p.name}`}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-zinc-400 hover:text-brand-red transition-colors"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </span>
      ))}
    </section>
  )
}

/**
 * The receipt's preset control: a sign-in link when signed out, otherwise a
 * "Save preset" button that opens an inline name form.
 */
export function SavePresetControl({
  signedIn, presets, onSave,
}: {
  signedIn: boolean
  presets: SavedPreset[]
  /** Resolves true when saved, so the form can close */
  onSave: (name: string) => Promise<boolean>
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  if (!signedIn) {
    return (
      <Link
        href="/sign-in"
        className="w-full min-h-[44px] flex items-center justify-center gap-2 text-zinc-500 hover:text-zinc-700 font-semibold transition-colors"
      >
        <Heart size={16} aria-hidden="true" />
        <span>Sign in to save presets</span>
      </Link>
    )
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full min-h-[44px] flex items-center justify-center gap-2 text-zinc-500 hover:text-zinc-700 font-semibold transition-colors"
      >
        <Heart size={16} aria-hidden="true" />
        <span>Save preset</span>
      </button>
    )
  }

  const cleaned = cleanPresetName(name)
  // At the limit only a same-name save (which replaces that preset) is allowed
  const atLimit = presets.length >= PRESETS_PER_ITEM_MAX
  const canSave = cleaned != null && (!atLimit || presets.some((p) => p.name === cleaned))

  const close = () => { setOpen(false); setName('') }
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSave || saving || !cleaned) return
    setSaving(true)
    const ok = await onSave(cleaned)
    setSaving(false)
    if (ok) close()
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={PRESET_NAME_MAX}
        aria-label="Preset name"
        placeholder="Name this build"
        autoFocus
        className="w-full min-h-[44px] rounded-xl border border-zinc-200 px-3 text-sm text-brand-dark focus:outline-none focus:ring-2 focus:ring-brand-red"
      />
      {atLimit && (
        <p className="text-xs text-zinc-500">
          You have {PRESETS_PER_ITEM_MAX} presets for this item. Use an existing name to replace one, or delete one first.
        </p>
      )}
      <div className="flex gap-2">
        {canSave && (
          <button
            type="submit"
            disabled={saving}
            className="flex-1 min-h-[44px] rounded-2xl bg-brand-dark text-white font-semibold disabled:opacity-60 transition-opacity"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        )}
        <button
          type="button"
          onClick={close}
          className="flex-1 min-h-[44px] rounded-2xl border border-zinc-200 text-zinc-600 font-semibold hover:bg-zinc-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
