'use client'

import type { ModifierConfig, PricedOption, SelectedExtra } from '@/lib/order-modifiers'
import ModifierSection, { OptionBadge, Pill } from './ModifierSection'
import QtyStepper from './QtyStepper'

/** Everything a customer can choose for one item, minus quantity and notes. */
export interface ModifierSelection {
  spicy: string | null
  removals: string[]
  additions: string[]
  extras: SelectedExtra[]
}

export const EMPTY_SELECTION: ModifierSelection = { spicy: null, removals: [], additions: [], extras: [] }

interface Props {
  config: ModifierConfig
  value: ModifierSelection
  onChange: (next: ModifierSelection) => void
  /** Option names to disable with a "Sold out" hint. */
  soldOut?: string[]
  /** Show 1, 2, 3… badges on the section headers (full-page customizer only). */
  numbered?: boolean
}

const priceHint = (p: number) => (p > 0 ? `+£${p.toFixed(2)}` : 'Free')

const toggle = (list: string[], value: string) =>
  list.includes(value) ? list.filter((v) => v !== value) : [...list, value]

/**
 * The option sections shared by the item drawer and the bundle popup's pick rows.
 * Renders Spicy, Ingredients, the priced categories and Free additions as sibling
 * <section>s, so a `divide-y` parent separates them.
 */
export default function ModifierForm({ config, value, onChange, soldOut, numbered = false }: Props) {
  const isSoldOut = (name: string) => soldOut?.includes(name) ?? false
  const patch = (next: Partial<ModifierSelection>) => onChange({ ...value, ...next })

  // Sections render in a fixed order and empty ones are skipped, so a running counter
  // yields gap-free numbers that match sectionCount(config).
  let n = 0
  const nextNumber = () => (numbered ? ++n : undefined)

  const qtyOf = (category: string, name: string) =>
    value.extras.find((e) => e.category === category && e.name === name)?.qty ?? 0

  // multi mode: qty 0 drops the entry
  const setExtraQty = (category: string, option: PricedOption, next: number) => {
    const rest = value.extras.filter((e) => !(e.category === category && e.name === option.name))
    patch({ extras: next > 0 ? [...rest, { name: option.name, price: option.price, qty: next, category }] : rest })
  }

  // single mode: one per category, tapping the chosen option again clears it
  const pickSingle = (category: string, option: PricedOption) => {
    const rest = value.extras.filter((e) => e.category !== category)
    const wasPicked = value.extras.some((e) => e.category === category && e.name === option.name)
    patch({ extras: wasPicked ? rest : [...rest, { name: option.name, price: option.price, qty: 1, category }] })
  }

  // pick mode: several per category, one of each; tapping again removes it
  const togglePick = (category: string, option: PricedOption) =>
    setExtraQty(category, option, qtyOf(category, option.name) > 0 ? 0 : 1)

  return (
    <>
      {config.spicyLevels.length > 0 && (
        // spicy_level is a single TEXT column, so this stays single-select even if
        // modifier_select_modes says multi.
        <ModifierSection title="Spicy level" subtitle="Choose one, tap again to clear" number={nextNumber()}>
          <div className="grid grid-cols-2 gap-2">
            {config.spicyLevels.map((level) => (
              <Pill
                key={level.name}
                label={level.name}
                hint={priceHint(level.price)}
                description={level.description}
                badge={level.badge}
                selected={value.spicy === level.name}
                onClick={() => patch({ spicy: value.spicy === level.name ? null : level.name })}
              />
            ))}
          </div>
        </ModifierSection>
      )}

      {config.ingredients.length > 0 && (
        <ModifierSection title="Ingredients" subtitle="Tap to leave one out" number={nextNumber()}>
          <div className="grid grid-cols-2 gap-2">
            {config.ingredients.map((ing) => {
              const removed = value.removals.includes(ing)
              return (
                <Pill
                  key={ing}
                  label={ing}
                  hint={removed ? 'Removed' : undefined}
                  tone="danger"
                  selected={removed}
                  onClick={() => patch({ removals: toggle(value.removals, ing) })}
                />
              )
            })}
          </div>
        </ModifierSection>
      )}

      {config.categories.map((cat) => (
        <ModifierSection
          key={cat.key}
          title={cat.label}
          subtitle={cat.mode === 'single' ? 'Choose one, tap again to clear' : 'Add as many as you like'}
          number={nextNumber()}
        >
          {cat.mode === 'single' || cat.mode === 'pick' ? (
            <div className="grid grid-cols-2 gap-2">
              {cat.options.map((opt) => (
                <Pill
                  key={opt.name}
                  label={opt.name}
                  hint={isSoldOut(opt.name) ? 'Sold out' : priceHint(opt.price)}
                  description={opt.description}
                  badge={opt.badge}
                  selected={qtyOf(cat.key, opt.name) > 0}
                  disabled={isSoldOut(opt.name)}
                  onClick={() => (cat.mode === 'pick' ? togglePick : pickSingle)(cat.key, opt)}
                />
              ))}
            </div>
          ) : (
            <div className="divide-y divide-zinc-50">
              {cat.options.map((opt) => (
                <div key={opt.name} className="flex items-center justify-between gap-3 py-1.5">
                  <div className="min-w-0">
                    <p className={`flex items-center gap-1.5 text-sm font-semibold ${isSoldOut(opt.name) ? 'text-zinc-400' : 'text-zinc-800'}`}>
                      {opt.name}
                      {opt.badge && <OptionBadge text={opt.badge} />}
                    </p>
                    {opt.description && <p className="text-xs text-zinc-500">{opt.description}</p>}
                    <p className="text-xs text-zinc-400">{isSoldOut(opt.name) ? 'Sold out' : priceHint(opt.price)}</p>
                  </div>
                  <QtyStepper
                    value={qtyOf(cat.key, opt.name)}
                    onChange={(next) => setExtraQty(cat.key, opt, next)}
                    label={opt.name}
                    disabled={isSoldOut(opt.name)}
                  />
                </div>
              ))}
            </div>
          )}
        </ModifierSection>
      ))}

      {config.additions.length > 0 && (
        <ModifierSection title="Free additions" subtitle="No extra charge" number={nextNumber()}>
          <div className="grid grid-cols-2 gap-2">
            {config.additions.map((add) => (
              <Pill
                key={add}
                label={add}
                hint={isSoldOut(add) ? 'Sold out' : 'Free'}
                selected={value.additions.includes(add)}
                disabled={isSoldOut(add)}
                onClick={() => patch({ additions: toggle(value.additions, add) })}
              />
            ))}
          </div>
        </ModifierSection>
      )}
    </>
  )
}
