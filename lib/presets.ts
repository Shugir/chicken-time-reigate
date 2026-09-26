// Named-only saved builds of a customized menu item (Phase E).
// Selections store option names, never prices; applyPreset re-reads prices from
// the current ModifierConfig so a preset never carries stale pricing.

import type { ModifierConfig } from './order-modifiers'
import type { ModifierSelection } from '@/components/Menu/ModifierForm'
import { NOTES_MAX } from './customizer-layout'

export interface PresetPayload {
  spicy: string | null
  removals: string[]
  additions: string[]
  extras: { name: string; category?: string; qty?: number }[]
}

export interface SavedPreset { id: string; name: string; selection: PresetPayload; notes: string | null; qty: number }

export const PRESET_NAME_MAX = 40
export const PRESETS_PER_ITEM_MAX = 10

/** Strips prices from a live selection so it can be stored as a preset. */
export function presetPayload(selection: ModifierSelection): PresetPayload {
  return {
    spicy: selection.spicy,
    removals: [...selection.removals],
    additions: [...selection.additions],
    extras: selection.extras.map((e) => ({ name: e.name, category: e.category, qty: e.qty })),
  }
}

const clampQty = (qty: unknown, max: number) => Math.min(max, Math.max(1, Math.floor(Number(qty)) || 1))

/** Re-applies a stored preset against the item's current options, dropping anything no longer valid. */
export function applyPreset(
  config: ModifierConfig,
  soldOut: string[] | undefined,
  preset: Pick<SavedPreset, 'selection' | 'notes' | 'qty'>
): { selection: ModifierSelection; notes: string; qty: number } {
  const sel = preset.selection && typeof preset.selection === 'object' ? preset.selection : ({} as Partial<PresetPayload>)
  const isSoldOut = (name: string) => soldOut?.includes(name) ?? false

  const spicy = typeof sel.spicy === 'string' && config.spicyLevels.some((l) => l.name === sel.spicy) ? sel.spicy : null

  const removals = Array.isArray(sel.removals) ? sel.removals.filter((r) => config.ingredients.includes(r)) : []

  const additions = Array.isArray(sel.additions)
    ? sel.additions.filter((a) => config.additions.includes(a) && !isSoldOut(a))
    : []

  const seenSingle = new Set<string>()
  const extras = Array.isArray(sel.extras)
    ? sel.extras.reduce<ModifierSelection['extras']>((acc, e) => {
        if (!e || typeof e !== 'object') return acc
        const cat = config.categories.find((c) => c.key === e.category)
        if (!cat) return acc
        const opt = cat.options.find((o) => o.name === e.name)
        if (!opt || isSoldOut(opt.name)) return acc
        if (cat.mode === 'single') {
          if (seenSingle.has(cat.key)) return acc
          seenSingle.add(cat.key)
        }
        const qty = cat.mode === 'single' ? 1 : clampQty(e.qty, 20)
        acc.push({ name: opt.name, price: opt.price, qty, category: e.category })
        return acc
      }, [])
    : []

  return {
    selection: { spicy, removals, additions, extras },
    notes: (preset.notes ?? '').slice(0, NOTES_MAX),
    qty: clampQty(preset.qty, 99),
  }
}

/** The VAT portion of a VAT-inclusive total, at `rate` percent. 0 when rate is at or below 0. */
export function vatIncluded(total: number, rate: number): number {
  if (rate <= 0) return 0
  // Work in whole pence so float error in total*rate can't shift the rounding (e.g. 20.49 @ 20%).
  const pence = Math.round(total * 100)
  return Math.round((pence * rate) / (100 + rate)) / 100
}

/** Trims a preset name, rejecting empty input and capping length. */
export function cleanPresetName(name: string): string | null {
  const trimmed = name.trim()
  return trimmed.length > 0 ? trimmed.slice(0, PRESET_NAME_MAX) : null
}
