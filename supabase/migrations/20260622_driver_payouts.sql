-- ── Driver payouts table ──────────────────────────────────────────────────────
create table if not exists driver_payouts (
  id               uuid          primary key default gen_random_uuid(),
  driver_id        uuid          not null references drivers(id) on delete cascade,
  amount           numeric(10,2) not null,
  pay_period_start date          not null,
  pay_period_end   date          not null,
  created_at       timestamptz   not null default now()
);

alter table driver_payouts enable row level security;

create index if not exists idx_driver_payouts_driver_id on driver_payouts(driver_id);

-- ── is_driver_paid flag on orders ─────────────────────────────────────────────
alter table orders
  add column if not exists is_driver_paid boolean not null default false;

create index if not exists idx_orders_driver_paid
  on orders(driver_id, is_driver_paid);
