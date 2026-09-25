import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('menu_items')
    .select('id, name, description, price, compare_at_price, image_url, category, is_available, sold_out_extras, custom_options, extras, removals, additions, dietary_flags, allergens, spicy_levels, ingredients, add_ons, drinks_regular, drinks_large, dips, sides, fries_regular, fries_large, other_extras, extra_ingredients, modifier_select_modes')
    .order('category', { ascending: true })
    .order('name', { ascending: true })

  if (error) {
    console.error('Menu items fetch error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
