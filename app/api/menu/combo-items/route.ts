import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(request: NextRequest) {
  const category = request.nextUrl.searchParams.get('category')
  if (!category || !['main', 'side', 'drink'].includes(category)) {
    return NextResponse.json({ error: 'category must be main, side, or drink' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('menu_items')
    .select('id, name, description, price, image_url, size_tier')
    .eq('combo_category', category)
    .eq('is_available', true)
    .order('name')

  if (error) return NextResponse.json({ error: 'Failed to fetch combo items' }, { status: 500 })
  return NextResponse.json(data ?? [])
}
