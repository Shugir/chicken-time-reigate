alter table orders
  add column if not exists return_reason text;
