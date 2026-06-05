alter table menu_items
  add column if not exists dietary_flags text[] not null default '{}';
