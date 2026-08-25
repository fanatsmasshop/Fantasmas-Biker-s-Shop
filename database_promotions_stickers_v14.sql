-- FANTASMAS BIKER'S SHOP V14: promociones calculables, cupones y optimización.
-- Conserva productos, pedidos, imágenes, rifas y contenido actual.

alter table public.shop_promotions add column if not exists discount_type text;
alter table public.shop_promotions add column if not exists discount_value numeric(10,2);
alter table public.shop_promotions add column if not exists scope text not null default 'all';
alter table public.shop_promotions add column if not exists product_ids uuid[] not null default '{}';
alter table public.shop_promotions add column if not exists category_names text[] not null default '{}';
alter table public.shop_promotions add column if not exists minimum_purchase numeric(10,2) not null default 0;

do $$ begin
  alter table public.shop_promotions add constraint shop_promotions_discount_type_check
    check (discount_type is null or discount_type in ('percentage','fixed'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.shop_promotions add constraint shop_promotions_scope_check
    check (scope in ('all','products','categories'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.shop_promotions add constraint shop_promotions_discount_value_check
    check (discount_value is null or discount_value > 0);
exception when duplicate_object then null; end $$;

create index if not exists shop_promotions_active_dates_idx
  on public.shop_promotions(active, starts_at, ends_at);

create table if not exists public.shop_discount_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  title text not null default '',
  discount_type text not null check (discount_type in ('percentage','fixed')),
  discount_value numeric(10,2) not null check (discount_value > 0),
  scope text not null default 'all' check (scope in ('all','products','categories')),
  product_ids uuid[] not null default '{}',
  category_names text[] not null default '{}',
  minimum_purchase numeric(10,2) not null default 0 check (minimum_purchase >= 0),
  max_uses integer check (max_uses is null or max_uses > 0),
  uses_count integer not null default 0 check (uses_count >= 0),
  starts_at timestamptz,
  ends_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists shop_discount_codes_code_unique_idx
  on public.shop_discount_codes(upper(code));
create index if not exists shop_discount_codes_active_dates_idx
  on public.shop_discount_codes(active, starts_at, ends_at);

alter table public.shop_discount_codes enable row level security;
drop policy if exists "admins_manage_discount_codes" on public.shop_discount_codes;
create policy "admins_manage_discount_codes" on public.shop_discount_codes
  for all to authenticated using (public.is_shop_admin()) with check (public.is_shop_admin());

revoke all on table public.shop_discount_codes from anon;
grant select, insert, update, delete on table public.shop_discount_codes to authenticated;
grant all on table public.shop_discount_codes to service_role;

-- Las nuevas tablas ya no quedan expuestas automáticamente en proyectos actuales.
grant select on table public.shop_promotions to anon, authenticated;

create index if not exists shop_raffle_draws_drawn_by_idx on public.shop_raffle_draws(drawn_by);
create index if not exists shop_raffle_draws_raffle_number_idx on public.shop_raffle_draws(raffle_number_id);

drop policy if exists "admin_read_own_profile" on public.shop_admins;
create policy "admin_read_own_profile" on public.shop_admins for select to authenticated
using (user_id = (select auth.uid()));

notify pgrst, 'reload schema';
