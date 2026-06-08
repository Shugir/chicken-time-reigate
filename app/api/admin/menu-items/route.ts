import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('menu_items')
    .select('*')
    .order('category', { ascending: true })
    .order('name', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const { name, description, price, image_url, category, is_available, extras, removals, additions, dietary_flags, allergens } = await request.json()

  if (!name || !price || !category) {
    return NextResponse.json({ error: 'name, price, and category are required' }, { status: 400 })
  }

  const payload = {
    name,
    description: description ?? null,
    price,
    image_url: image_url ?? null,
    category,
    is_available: is_available ?? true,
    extras: extras ?? [],
    removals: removals ?? [],
    additions: additions ?? [],
    dietary_flags: dietary_flags ?? [],
    allergens: allergens ?? [],
  }

  console.log('Inserting menu item:', JSON.stringify(payload))

  const { data, error } = await supabaseAdmin
    .from('menu_items')
    .insert(payload)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
