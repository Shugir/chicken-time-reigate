create table if not exists staff_permissions (
  id          uuid        primary key default gen_random_uuid(),
  email       text        not null unique,
  role        text        not null default 'staff'
                          check (role in ('owner', 'staff')),
  permissions jsonb       not null default '[]'::jsonb,
  created_at  timestamptz not null default now()
);

alter table staff_permissions enable row level security;
