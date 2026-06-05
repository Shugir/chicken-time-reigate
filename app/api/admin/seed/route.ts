import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

const IMG = (id: string) => `https://images.unsplash.com/${id}?w=600&q=80`

const SEED: Record<string, Array<{
  name: string
  description: string
  price: number
  image_url: string
}>> = {
  deals: [
    {
      name:        'Family Feast Box',
      description: '8 pieces of crispy fried chicken, large fries, 4 corn cobs & 4 drinks',
      price:       24.99,
      image_url:   IMG('photo-1626645738196-c2a7c87a8f58'),
    },
    {
      name:        'Chicken & Chips Meal',
      description: '3 crispy chicken strips, seasoned fries and a regular drink',
      price:       8.99,
      image_url:   IMG('photo-1562967914-608f82629710'),
    },
    {
      name:        'Date Night Duo',
      description: '2 smash burgers, 2 large fries, 2 onion rings & 2 drinks',
      price:       19.99,
      image_url:   IMG('photo-1568901346375-23c9450c58cd'),
    },
    {
      name:        'Wing Wednesday Bundle',
      description: '12 hot wings, coleslaw & dipping sauces — every Wednesday price',
      price:       11.99,
      image_url:   IMG('photo-1527477396000-e27163b481c2'),
    },
    {
      name:        'Lunchtime Special',
      description: 'Any burger + regular fries + regular drink, available 11am–3pm',
      price:       9.49,
      image_url:   IMG('photo-1550950158-d0d960dff596'),
    },
    {
      name:        'Kids Combo',
      description: '2 mini chicken strips, small fries, a side of corn & a kids\' juice',
      price:       5.99,
      image_url:   IMG('photo-1604908177522-a5d93d0b3855'),
    },
  ],

  burgers: [
    {
      name:        'Classic Smash Burger',
      description: 'Double smashed beef patty, American cheese, dill pickles, yellow mustard on a toasted brioche bun',
      price:       7.99,
      image_url:   IMG('photo-1568901346375-23c9450c58cd'),
    },
    {
      name:        'BBQ Bacon Melt',
      description: 'Crispy streaky bacon, smoky BBQ sauce, caramelised onions, mature cheddar',
      price:       9.49,
      image_url:   IMG('photo-1550950158-d0d960dff596'),
    },
    {
      name:        'Dirty Bird Burger',
      description: 'Crispy fried chicken thigh fillet, sriracha mayo, crunchy coleslaw, pickled jalapeños',
      price:       8.99,
      image_url:   IMG('photo-1561758033-d89a9ad46330'),
    },
    {
      name:        'Mushroom & Swiss',
      description: 'Sautéed wild mushrooms, Swiss cheese, roasted garlic aioli, on a charred pretzel bun',
      price:       8.49,
      image_url:   IMG('photo-1594212699903-ec8a3eca50f5'),
    },
    {
      name:        'Double Stack Royale',
      description: 'Two smashed patties, thousand island sauce, iceberg, tomato, gherkin',
      price:       10.99,
      image_url:   IMG('photo-1586190848861-99aa4a171e90'),
    },
    {
      name:        'Habanero Inferno',
      description: 'Habanero-marinated beef patty, ghost pepper cheese, scorched onions, cooling ranch drizzle',
      price:       9.29,
      image_url:   IMG('photo-1602030638412-bb8dcc0bc8b0'),
    },
  ],

  chicken: [
    {
      name:        'Signature Fried Chicken',
      description: '24-hour marinated chicken thigh, pressure-fried in seasoned breadcrumbs to golden perfection',
      price:       7.99,
      image_url:   IMG('photo-1626645738196-c2a7c87a8f58'),
    },
    {
      name:        'Hot Wings (6pc)',
      description: 'Crispy wings tossed in your choice of sauce: Buffalo, BBQ, Honey Garlic, or Lemon Pepper',
      price:       6.99,
      image_url:   IMG('photo-1527477396000-e27163b481c2'),
    },
    {
      name:        'Chicken Strips (4pc)',
      description: 'Tender breast strips in a seasoned golden crust, served with honey mustard dip',
      price:       7.49,
      image_url:   IMG('photo-1562967914-608f82629710'),
    },
    {
      name:        'Nashville Hot Chicken',
      description: 'Cayenne-glazed fried chicken layered with pickles on thick white toast',
      price:       8.99,
      image_url:   IMG('photo-1569050467447-ce54b3bbc37d'),
    },
    {
      name:        'Popcorn Chicken',
      description: 'Bite-sized crispy nuggets with your choice of dipping sauce, impossible to stop eating',
      price:       5.99,
      image_url:   IMG('photo-1614632537190-23e4e134d1de'),
    },
    {
      name:        'Grilled Chicken Platter',
      description: 'Herb-marinated grilled breast, chimichurri, charred corn & a side salad',
      price:       9.49,
      image_url:   IMG('photo-1532550907401-a500c9a57435'),
    },
  ],

  sides: [
    {
      name:        'Loaded Fries',
      description: 'Crispy fries smothered in cheese sauce, crispy bacon bits & sliced spring onions',
      price:       4.99,
      image_url:   IMG('photo-1573080496219-bb964210b79c'),
    },
    {
      name:        'Homemade Coleslaw',
      description: 'Creamy coleslaw made fresh daily with a hint of apple cider vinegar and celery seed',
      price:       2.49,
      image_url:   IMG('photo-1512621776951-a57141f2eefd'),
    },
    {
      name:        'Chargrilled Corn',
      description: 'Sweetcorn char-grilled in the husk, finished with herb butter and sea salt',
      price:       2.99,
      image_url:   IMG('photo-1551754655-cd27e38d2076'),
    },
    {
      name:        'Beer-Battered Onion Rings',
      description: 'Golden rings in a crispy beer batter, served with chipotle dipping sauce',
      price:       3.99,
      image_url:   IMG('photo-1598070783768-3fef7e82e81b'),
    },
    {
      name:        'Mac & Cheese',
      description: 'Three-cheese macaroni baked until golden and bubbly on top',
      price:       3.99,
      image_url:   IMG('photo-1551892374-ecf8754cf8b0'),
    },
    {
      name:        'Sweet Potato Fries',
      description: 'Oven-seasoned sweet potato fries with a cinnamon sugar & sea salt dust',
      price:       3.99,
      image_url:   IMG('photo-1604908177522-a5d93d0b3855'),
    },
  ],

  drinks: [
    {
      name:        'Freestyle Coca-Cola',
      description: 'Ice cold Coke from our Freestyle machine — choose from 100+ flavour combinations',
      price:       2.49,
      image_url:   IMG('photo-1548690312-e3b507d8c110'),
    },
    {
      name:        'Mango Lemonade',
      description: 'Fresh mango purée blended with sharp lemonade and a sprig of mint',
      price:       3.49,
      image_url:   IMG('photo-1513558161293-cdaf765ed2fd'),
    },
    {
      name:        'Strawberry Milkshake',
      description: 'Hand-spun thick shake made with real strawberry ice cream',
      price:       4.49,
      image_url:   IMG('photo-1541658016709-82535e94bc69'),
    },
    {
      name:        'Sparkling Water',
      description: 'Chilled San Pellegrino sparkling mineral water',
      price:       1.99,
      image_url:   IMG('photo-1523362628745-0c100150b504'),
    },
    {
      name:        'Iced Matcha Latte',
      description: 'Ceremonial grade matcha, oat milk, a touch of honey — served over ice',
      price:       3.99,
      image_url:   IMG('photo-1556679343-c7306c1976bc'),
    },
    {
      name:        'Fresh Orange Juice',
      description: 'Squeezed to order from Valencia oranges — no sugar, no water, just juice',
      price:       2.99,
      image_url:   IMG('photo-1600271886742-f049cd451bba'),
    },
  ],

  desserts: [
    {
      name:        'Warm Cookie Dough',
      description: 'Baked-to-order chocolate chip cookie dough, served with a scoop of vanilla ice cream',
      price:       5.99,
      image_url:   IMG('photo-1499636136210-6f4ee915583e'),
    },
    {
      name:        'Biscoff Cheesecake',
      description: 'Silky no-bake cheesecake on a crushed Lotus Biscoff base, topped with caramel drizzle',
      price:       5.49,
      image_url:   IMG('photo-1565958011703-44f9829ba187'),
    },
    {
      name:        'Churros & Chocolate Sauce',
      description: 'Crispy churros rolled in cinnamon sugar, with rich dark chocolate dipping sauce',
      price:       4.99,
      image_url:   IMG('photo-1624356401066-ce0b073c4ce5'),
    },
    {
      name:        'Banana Pudding',
      description: 'Southern-style layered vanilla custard, fresh banana & crushed Nilla wafers',
      price:       4.49,
      image_url:   IMG('photo-1551024506-0bccd828d307'),
    },
    {
      name:        'Brownie Sundae',
      description: 'Warm fudgy chocolate brownie, two scoops of vanilla ice cream, chocolate fudge sauce',
      price:       5.99,
      image_url:   IMG('photo-1563729784474-d77dbb933a9e'),
    },
    {
      name:        'Strawberry Cheesecake Shake',
      description: 'Thick shake blended with real cheesecake pieces and fresh strawberries',
      price:       5.49,
      image_url:   IMG('photo-1505252585461-04db1eb84625'),
    },
  ],
}

export async function POST() {
  // Fetch existing categories to get their slugs
  const { data: categories, error: catError } = await supabaseAdmin
    .from('categories')
    .select('id, slug, name')

  if (catError) return NextResponse.json({ error: catError.message }, { status: 500 })

  const existingSlugs = new Set((categories ?? []).map((c: { slug: string }) => c.slug))

  const rows: Array<{
    name: string
    description: string
    price: number
    image_url: string
    category: string
    is_available: boolean
  }> = []

  const skipped: string[] = []

  for (const [slug, items] of Object.entries(SEED)) {
    if (!existingSlugs.has(slug)) {
      skipped.push(slug)
      continue
    }
    for (const item of items) {
      rows.push({ ...item, category: slug, is_available: true })
    }
  }

  if (rows.length === 0) {
    return NextResponse.json({
      inserted: 0,
      skipped,
      message: 'No matching categories found. Ensure categories exist first.',
    })
  }

  const { data, error } = await supabaseAdmin
    .from('menu_items')
    .insert(rows)
    .select('id, name, category')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    inserted: data?.length ?? 0,
    skipped,
    items: data,
  })
}
