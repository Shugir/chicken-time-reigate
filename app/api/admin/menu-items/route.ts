import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getUserPermissions, hasPermission } from '@/lib/get-user-permissions'
import { validateMenuItemInput } from '@/lib/menu-item-input'

// Categorized modifier columns (see 20260921a_menu_item_modifier_categories.sql)
const MODIFIER_LISTS = [
  'spicy_levels', 'ingredients', 'add_ons', 'drinks_regular', 'drinks_large',
  'dips', 'sides', 'fries_regular', 'fries_large', 'other_extras', 'extra_ingredients',
]

export async function GET() {
  // The promotions and deals builders both pick items to attach rewards to, so
  // reading the catalogue is allowed for either; editing stays MenuManager-only.
  const perms = await getUserPermissions()
  if (!perms || !(hasPermission(perms, 'MenuManager') || hasPermission(perms, 'Promotions') || hasPermission(perms, 'Deals'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data, error } = await supabaseAdmin
    .from('menu_items')
    .select('*')
    .order('category', { ascending: true })
    .order('name', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const perms = await getUserPermissions()
  if (!perms || !hasPermission(perms, 'MenuManager')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const input = validateMenuItemInput(body, { partial: false })
  if (!input.ok) return NextResponse.json({ error: input.error }, { status: 400 })

  const payload = {
    description: null,
    image_url: null,
    is_available: true,
    sold_out_extras: [],
    extras: [],
    removals: [],
    additions: [],
    ...Object.fromEntries(MODIFIER_LISTS.map((k) => [k, []])),
    dietary_flags: [],
    allergens: [],
    // modifier_select_modes is only set when sent, so the column default applies otherwise
    ...input.value,
  }

  const { data, error } = await supabaseAdmin
    .from('menu_items')
    .insert(payload)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
