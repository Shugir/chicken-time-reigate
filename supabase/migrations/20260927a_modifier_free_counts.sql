-- "First N free" per option group, e.g. {"dips": 1} = the first dip is free.
-- Keys are priced category keys; values are whole numbers 1-20. Checkout frees the N
-- priciest chosen units in that group (lib/order-modifiers.ts freeExtrasDiscount).
alter table public.menu_items
  add column if not exists modifier_free_counts jsonb not null default '{}'::jsonb;

alter table public.menu_items
  drop constraint if exists menu_items_modifier_free_counts_is_object;
alter table public.menu_items
  add constraint menu_items_modifier_free_counts_is_object check (jsonb_typeof(modifier_free_counts) = 'object');
