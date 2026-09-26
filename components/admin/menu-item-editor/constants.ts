export const DIETARY_FLAGS = ['Halal', 'Vegetarian', 'Vegan', 'Gluten-Free', 'Dairy-Free', 'Spicy', 'Nut-Free']
export const COMMON_ALLERGENS = ['Celery', 'Crustaceans', 'Dairy', 'Eggs', 'Fish', 'Gluten', 'Lupin', 'Molluscs', 'Mustard', 'Nuts', 'Peanuts', 'Sesame', 'Soya', 'Sulphites']

// Every option list the editor manages. `label` names the list in duplicate-name warnings.
export const PRICED_CATEGORIES = [
  { key: 'spicy_levels', label: 'Spicy Level', hint: 'Heat options — price optional', placeholder: 'e.g. Reaper Inferno' },
  { key: 'extra_ingredients', label: 'Extra Ingredients', hint: 'Set £0.00 for free extras', placeholder: 'e.g. Extra Cheese' },
  { key: 'drinks_regular', label: 'Drinks (Regular)', hint: 'Regular-size drinks', placeholder: 'e.g. Coke' },
  { key: 'drinks_large', label: 'Drinks (Large)', hint: 'Large-size drinks', placeholder: 'e.g. Large Coke' },
  { key: 'sides', label: 'Sides', hint: 'Side dishes', placeholder: 'e.g. Coleslaw' },
  { key: 'fries_regular', label: 'Fries (Regular)', hint: 'Regular-size fries', placeholder: 'e.g. Peri Fries' },
  { key: 'fries_large', label: 'Fries (Large)', hint: 'Large-size fries', placeholder: 'e.g. Large Peri Fries' },
  { key: 'dips', label: 'Dips', hint: 'Dips and sauces', placeholder: 'e.g. Garlic Mayo' },
  { key: 'add_ons', label: 'Add-ons', hint: 'Extras customers can add', placeholder: 'e.g. Bacon' },
  { key: 'other_extras', label: 'Other Extras', hint: 'Anything that fits no other category', placeholder: 'e.g. Cutlery Pack' },
] as const

export type PricedKey = (typeof PRICED_CATEGORIES)[number]['key']

export const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-red focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900'
export const INPUT_BASE = 'bg-zinc-800 border border-zinc-700 rounded-xl px-3.5 text-base sm:text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-brand-red/50 focus:border-brand-red transition-colors aria-[invalid=true]:border-red-500'
export const TAG_INPUT_CLS = `${INPUT_BASE} h-11`
export const LABEL_CLS = 'block text-xs font-medium text-zinc-400 mb-1.5'
export const ADD_BTN_CLS = `shrink-0 h-11 w-11 flex items-center justify-center rounded-xl bg-zinc-700 hover:bg-zinc-600 text-white transition-colors ${FOCUS_RING}`
