import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('menu_items')
    .select('id, name, description, price, compare_at_price, image_url, category, is_available, custom_options, extras, removals, additions, dietary_flags, allergens, combo_category, size_tier')
    .eq('is_available', true)
    .order('category', { ascending: true })
    .order('name', { ascending: true })

  if (error) {
    console.error('Menu items fetch error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
