-- Track promo code usage and discount on orders
alter table orders
  add column if not exists promo_code_used  text,
  add column if not exists discount_applied numeric not null default 0;
