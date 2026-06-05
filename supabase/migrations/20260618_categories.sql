create table if not exists public.categories (
  id          uuid        primary key default gen_random_uuid(),
  name        text        not null,
  slug        text        not null unique,
  sort_order  integer     not null default 0,
  is_active   boolean     not null default true,
  image_url   text,
  description text,
  created_at  timestamptz not null default now()
);

alter table public.categories enable row level security;

create policy "public can read categories"
  on public.categories for select using (true);

create policy "service role full access on categories"
  on public.categories using (auth.role() = 'service_role');

insert into public.categories (name, slug, sort_order, image_url, description) values
  ('Deals',   'deals',   1, 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=200&q=80', 'Combo meals & special offers'),
  ('Burgers', 'burgers', 2, 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=200&q=80', 'Crispy fillets & stacked classics'),
  ('Chicken', 'chicken', 3, 'https://images.unsplash.com/photo-1567620832903-9fc6debc209f?w=200&q=80', 'Wings, strips & whole pieces'),
  ('Sides',   'sides',   4, 'https://images.unsplash.com/photo-1576107232684-1279f390859f?w=200&q=80', 'The perfect companions'),
  ('Drinks',  'drinks',  5, 'https://images.unsplash.com/photo-1554866585-cd94860890b7?w=200&q=80', 'Cold drinks & shakes');
