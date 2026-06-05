-- ── Drivers table ────────────────────────────────────────────────────────────
create table if not exists drivers (
  id               uuid          primary key default gen_random_uuid(),
  name             text          not null,
  phone            text,
  status           text          not null default 'available'
                                 check (status in ('available', 'on_delivery', 'offline')),
  per_delivery_wage numeric(10,2) not null default 0,
  is_active        boolean       not null default true,
  created_at       timestamptz   not null default now()
);

alter table drivers enable row level security;

-- ── Fleet columns on orders ───────────────────────────────────────────────────
alter table orders
  add column if not exists driver_id       uuid references drivers(id) on delete set null,
  add column if not exists delivery_status text check (
    delivery_status in ('pending', 'out_for_delivery', 'delivered', 'failed')
  ),
  add column if not exists failure_reason text;

create index if not exists idx_orders_driver_id       on orders(driver_id);
create index if not exists idx_orders_delivery_status on orders(delivery_status);
