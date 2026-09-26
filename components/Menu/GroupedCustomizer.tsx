'use client'

import { Fragment, useId, type ReactNode } from 'react'
import { Check } from 'lucide-react'
import type { ModifierCategory, ModifierConfig, PricedOption } from '@/lib/order-modifiers'
import {
  groupSelectedCount, hasQuickNote, NOTES_MAX, QUICK_NOTES, toggleQuickNote,
  type LayoutGroup, type LayoutSection,
} from '@/lib/customizer-layout'
import type { ModifierSelection } from './ModifierForm'
import { OptionBadge } from './ModifierSection'
import QtyStepper from './QtyStepper'

interface Props {
  layout: LayoutGroup[]
  config: ModifierConfig
  value: ModifierSelection
  onChange: (next: ModifierSelection) => void
  notes: string
  onNotesChange: (next: string) => void
  /** Option names to disable with a "Sold out" hint. */
  soldOut?: string[]
}

const priceText = (p: number) => (p > 0 ? `+£${p.toFixed(2)}` : '£0.00 (Included)')
const pad2 = (n: number) => String(n).padStart(2, '0')

const toggle = (list: string[], value: string) =>
  list.includes(value) ? list.filter((v) => v !== value) : [...list, value]

// p-2 on mobile keeps a QtyStepper (124px) inside a 2-column card at 360px.
const CARD = 'relative min-w-0 w-full min-h-[44px] text-left p-2 sm:p-3 rounded-xl border-2 transition-colors'
const cardTone = (selected: boolean, disabled: boolean) =>
  disabled
    ? 'border-zinc-100 opacity-50 cursor-not-allowed'
    : selected
      ? 'border-brand-red bg-brand-red/5'
      : 'border-zinc-200 bg-white hover:border-zinc-400'

function CheckCircle({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center ${
        on ? 'bg-brand-red text-white' : 'border-2 border-zinc-300'
      }`}
    >
      {on && <Check size={12} strokeWidth={3} />}
    </span>
  )
}

/** Name, description, badge, then the price line; right padding clears the check circle. */
function CardBody({ opt, hint, hintClass = 'text-zinc-500', nameClass = 'text-brand-dark' }: {
  opt: Pick<PricedOption, 'name' | 'description' | 'badge'>
  hint: string
  hintClass?: string
  nameClass?: string
}) {
  return (
    <span className="block pr-6">
      <span className={`block text-sm font-semibold break-words ${nameClass}`}>{opt.name}</span>
      {opt.description && <span className="block text-xs text-zinc-500 mt-0.5">{opt.description}</span>}
      {opt.badge && <span className="block mt-1"><OptionBadge text={opt.badge} /></span>}
      <span className={`block text-xs font-semibold mt-1 ${hintClass}`}>{hint}</span>
    </span>
  )
}

export function GroupHeader({ number, title, subtitle, titleId, right }: {
  number: string
  title: string
  subtitle: string
  titleId: string
  right?: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-3 bg-brand-dark rounded-t-2xl px-5 py-4">
      <span
        aria-hidden="true"
        className="w-8 h-8 shrink-0 rounded-full bg-brand-red text-white text-xs font-bold flex items-center justify-center tabular-nums"
      >
        {number}
      </span>
      <div className="min-w-0 flex-1">
        <h2 id={titleId} className="font-heading font-bold text-white">{title}</h2>
        <p className="text-sm text-white/70">{subtitle}</p>
      </div>
      {right}
    </div>
  )
}

type SectionsProps = Pick<Props, 'layout' | 'config' | 'value' | 'onChange' | 'soldOut'> & {
  /**
   * Wraps each group's body (GroupedCustomizer's numbered cards). Without it the sections
   * render bare, every one under its #626262 bar, titled without numbers (the meal deal page).
   */
  renderGroup?: (group: LayoutGroup, body: ReactNode) => ReactNode
}

/** One item's option sections: #626262 sub-section bars and option cards. Selection rules match ModifierForm. */
export function ItemOptionSections({ layout, config, value, onChange, soldOut, renderGroup }: SectionsProps) {
  const isSoldOut = (name: string) => soldOut?.includes(name) ?? false
  const patch = (next: Partial<ModifierSelection>) => onChange({ ...value, ...next })

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

  const optionCard = (cat: ModifierCategory, opt: PricedOption) => {
    const qty = qtyOf(cat.key, opt.name)
    const out = isSoldOut(opt.name)
    // A £0.00 extra ingredient is a free add, not something already in the meal
    const hint = out ? 'Sold out' : cat.key === 'extra_ingredients' && Number(opt.price) === 0 ? 'Free (£0.00)' : priceText(opt.price)

    if (cat.mode === 'single' || cat.mode === 'pick') {
      return (
        <button
          key={opt.name}
          type="button"
          aria-pressed={qty > 0}
          disabled={out}
          onClick={() => (cat.mode === 'pick' ? togglePick : pickSingle)(cat.key, opt)}
          className={`${CARD} ${cardTone(qty > 0, out)}`}
        >
          <CheckCircle on={qty > 0} />
          <CardBody opt={opt} hint={hint} />
        </button>
      )
    }

    // Multi: a <div> card so the Add button / stepper are not nested in another button.
    return (
      <div key={opt.name} className={`${CARD} flex flex-col gap-2 ${cardTone(qty > 0, out)}`}>
        <CheckCircle on={qty > 0} />
        <CardBody opt={opt} hint={hint} />
        <div className="mt-auto">
          {qty > 0 ? (
            <QtyStepper value={qty} onChange={(next) => setExtraQty(cat.key, opt, next)} label={opt.name} disabled={out} />
          ) : (
            <button
              type="button"
              disabled={out}
              onClick={() => setExtraQty(cat.key, opt, 1)}
              aria-label={`Add ${opt.name}`}
              className="w-full min-h-[44px] rounded-lg border-2 border-brand-red text-brand-red text-sm font-bold hover:bg-brand-red hover:text-white disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-brand-red transition-colors"
            >
              + Add
            </button>
          )}
        </div>
      </div>
    )
  }

  const options = (s: LayoutSection) => {
    if (s.kind === 'spicy') {
      return (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {config.spicyLevels.map((level) => {
            const on = value.spicy === level.name
            return (
              <button
                key={level.name}
                type="button"
                aria-pressed={on}
                onClick={() => patch({ spicy: on ? null : level.name })}
                className={`${CARD} ${cardTone(on, false)}`}
              >
                <CheckCircle on={on} />
                <CardBody opt={level} hint={priceText(level.price)} hintClass={on ? 'text-brand-red' : 'text-zinc-500'} />
              </button>
            )
          })}
        </div>
      )
    }

    if (s.kind === 'ingredients') {
      return (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {config.ingredients.map((ing) => {
            const removed = value.removals.includes(ing)
            return (
              <button
                key={ing}
                type="button"
                aria-pressed={!removed}
                onClick={() => patch({ removals: toggle(value.removals, ing) })}
                className={`${CARD} ${removed ? 'border-zinc-200 bg-zinc-50' : 'border-emerald-200 bg-white hover:border-emerald-400'}`}
              >
                <span
                  aria-hidden="true"
                  className={`absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center ${
                    removed ? 'border-2 border-zinc-300' : 'bg-emerald-600 text-white'
                  }`}
                >
                  {!removed && <Check size={12} strokeWidth={3} />}
                </span>
                <CardBody
                  opt={{ name: ing }}
                  hint={removed ? 'Removed' : 'Included'}
                  hintClass={removed ? 'text-brand-red' : 'text-emerald-600'}
                  nameClass={removed ? 'text-zinc-400 line-through' : 'text-brand-dark'}
                />
              </button>
            )
          })}
        </div>
      )
    }

    // 1.3 Extra Ingredients: priced extra_ingredients first, then the free additions
    if (s.kind === 'extras') {
      return (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {s.category?.options.map((opt) => optionCard(s.category!, opt))}
          {config.additions.map((add) => {
            const on = value.additions.includes(add)
            const out = isSoldOut(add)
            return (
              <button
                key={add}
                type="button"
                aria-pressed={on}
                disabled={out}
                onClick={() => patch({ additions: toggle(value.additions, add) })}
                className={`${CARD} ${cardTone(on, out)}`}
              >
                <CheckCircle on={on} />
                <CardBody opt={{ name: add }} hint={out ? 'Sold out' : 'Free (£0.00)'} />
              </button>
            )
          })}
        </div>
      )
    }

    const cat = s.category
    if (!cat) return null
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {cat.options.map((opt) => optionCard(cat, opt))}
      </div>
    )
  }

  const sections = (group: LayoutGroup, bars: boolean, numbered: boolean) =>
    group.sections.map((s) => (
      <div key={s.key} className="space-y-2">
        {/* #626262 bar: white 6.1:1, white/90 hint 5.3:1 (brand red would be 1.3:1 here) */}
        {bars && (
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 bg-[#626262] rounded-lg px-3 py-2">
            <h3 className="text-xs font-bold tracking-wide uppercase text-white">
              {numbered ? `${s.number} ${s.title}` : s.title}
            </h3>
            {s.hint && <span className="text-xs text-white/90">{s.hint}</span>}
          </div>
        )}
        {options(s)}
      </div>
    ))

  if (renderGroup) {
    return layout.map((group) => (
      <Fragment key={group.key}>
        {renderGroup(group, <div className="p-3 sm:p-5 space-y-4">{sections(group, !group.flat, true)}</div>)}
      </Fragment>
    ))
  }
  return <div className="space-y-4">{layout.map((group) => <Fragment key={group.key}>{sections(group, true, false)}</Fragment>)}</div>
}

/**
 * The full-page customizer's option groups (Stitch "Complete Customizer" 01–08) plus the
 * Special Instructions card. Selection rules match ModifierForm exactly.
 */
export default function GroupedCustomizer({ layout, config, value, onChange, notes, onNotesChange, soldOut }: Props) {
  const uid = useId()
  const notesId = `${uid}-notes`

  return (
    <div className="space-y-6">
      <ItemOptionSections
        layout={layout}
        config={config}
        value={value}
        onChange={onChange}
        soldOut={soldOut}
        renderGroup={(group, body) => {
          const titleId = `${uid}-${group.key}`
          const count = groupSelectedCount(group, value)
          return (
            <section aria-labelledby={titleId} className="bg-white rounded-2xl border border-zinc-100">
              <GroupHeader
                number={group.number}
                title={group.title}
                subtitle={group.subtitle}
                titleId={titleId}
                right={count > 0 && (
                  <span className="shrink-0 rounded-full px-2.5 py-1 bg-brand-red text-white text-xs font-bold">
                    {count} Selected
                  </span>
                )}
              />
              {body}
            </section>
          )
        }}
      />

      <section aria-labelledby={notesId} className="bg-white rounded-2xl border border-zinc-100">
        <GroupHeader
          number={pad2(layout.length + 1)}
          title="Special Instructions"
          subtitle="Dietary requests, preparation tweaks or packaging notes."
          titleId={notesId}
          right={<span className="shrink-0 text-xs text-white/70 tabular-nums">{notes.length} / {NOTES_MAX}</span>}
        />
        <div className="p-3 sm:p-5 space-y-3">
          <textarea
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            maxLength={NOTES_MAX}
            rows={3}
            aria-label="Special instructions"
            placeholder="e.g. No onions please, cut in half"
            className="w-full rounded-xl border-2 border-zinc-200 px-3 py-2 text-sm text-brand-dark focus:border-brand-red focus:outline-none resize-none"
          />
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-zinc-500">Quick add:</span>
            {QUICK_NOTES.map((phrase) => {
              const on = hasQuickNote(notes, phrase)
              return (
                <button
                  key={phrase}
                  type="button"
                  aria-pressed={on}
                  onClick={() => onNotesChange(toggleQuickNote(notes, phrase))}
                  className={`min-h-[44px] rounded-full px-3 text-xs font-semibold border transition-colors ${
                    on ? 'bg-brand-red text-white border-brand-red' : 'bg-white text-zinc-700 border-zinc-200 hover:border-zinc-400'
                  }`}
                >
                  {on ? '✓' : '+'} {phrase}
                </button>
              )
            })}
          </div>
        </div>
      </section>
    </div>
  )
}
