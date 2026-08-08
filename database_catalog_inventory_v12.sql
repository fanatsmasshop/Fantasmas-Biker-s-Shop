-- ============================================================
-- FANTASMAS BIKER'S SHOP — CATÁLOGO E INVENTARIO V12
-- Ejecuta este archivo UNA VEZ en Supabase > SQL Editor.
-- Conserva productos, pedidos, fotografías y usuarios actuales.
-- ============================================================

alter table public.shop_products add column if not exists sku text;
alter table public.shop_products add column if not exists stock integer;
alter table public.shop_products add column if not exists online_sale boolean not null default true;

update public.shop_products
set sku = nullif(upper(btrim(sku)), '')
where sku is not null;

update public.shop_products
set stock = 0
where stock is not null and stock < 0;

-- Si una instalación anterior permitió SKU repetidos, conserva el primero y
-- deja los demás sin SKU para que la creación del índice nunca se interrumpa.
with repeated_skus as (
  select id,
         row_number() over (partition by upper(sku) order by created_at, id) as position
  from public.shop_products
  where sku is not null and btrim(sku) <> ''
)
update public.shop_products p
set sku = null
from repeated_skus r
where p.id = r.id and r.position > 1;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'shop_products_stock_nonnegative'
      and conrelid = 'public.shop_products'::regclass
  ) then
    alter table public.shop_products
      add constraint shop_products_stock_nonnegative check (stock is null or stock >= 0);
  end if;
end $$;

create unique index if not exists shop_products_sku_unique_idx
on public.shop_products (upper(sku))
where sku is not null and btrim(sku) <> '';

create index if not exists shop_products_public_catalog_idx
on public.shop_products (active, featured desc, sort_order, created_at desc);

create index if not exists shop_products_category_idx
on public.shop_products (category)
where active = true;

-- Permite que el mismo catálogo funcione aunque pedidos se haya instalado antes.
alter table if exists public.shop_orders
  add column if not exists stock_applied boolean not null default false;

-- Importación masiva segura. Un SKU existente actualiza; sin SKU crea uno nuevo.
create or replace function public.import_shop_products(p_products jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_item jsonb;
  v_id uuid;
  v_name text;
  v_sku text;
  v_image_url text;
  v_stock integer;
  v_inserted integer := 0;
  v_updated integer := 0;
begin
  if not public.is_shop_admin() then
    raise exception 'No autorizado';
  end if;
  if jsonb_typeof(p_products) <> 'array' then
    raise exception 'El archivo no contiene una lista válida';
  end if;
  if jsonb_array_length(p_products) < 1 or jsonb_array_length(p_products) > 1000 then
    raise exception 'Importa entre 1 y 1000 productos por archivo';
  end if;

  for v_item in select value from jsonb_array_elements(p_products)
  loop
    v_name := btrim(coalesce(v_item->>'name', ''));
    if v_name = '' then raise exception 'Todos los productos necesitan nombre'; end if;
    v_sku := nullif(upper(btrim(coalesce(v_item->>'sku', ''))), '');
    v_image_url := nullif(btrim(coalesce(v_item->>'image_url', '')), '');
    v_stock := case
      when not (v_item ? 'stock') or v_item->'stock' = 'null'::jsonb then null
      else greatest(0, trunc((v_item->>'stock')::numeric)::integer)
    end;
    v_id := null;

    if v_sku is not null then
      select id into v_id
      from public.shop_products
      where upper(sku) = v_sku
      limit 1
      for update;
    end if;

    if v_id is not null then
      update public.shop_products
      set name = left(v_name, 120),
          sku = v_sku,
          category = left(coalesce(nullif(btrim(v_item->>'category'), ''), 'General'), 60),
          description = left(coalesce(v_item->>'description', ''), 500),
          price = case when not (v_item ? 'price') or v_item->'price' = 'null'::jsonb then null else greatest(0, (v_item->>'price')::numeric) end,
          previous_price = case when not (v_item ? 'previous_price') or v_item->'previous_price' = 'null'::jsonb then null else greatest(0, (v_item->>'previous_price')::numeric) end,
          stock = v_stock,
          sort_order = coalesce((v_item->>'sort_order')::integer, 0),
          active = coalesce((v_item->>'active')::boolean, true),
          featured = coalesce((v_item->>'featured')::boolean, false),
          online_sale = coalesce((v_item->>'online_sale')::boolean, true),
          image_url = coalesce(v_image_url, image_url),
          updated_at = now()
      where id = v_id;
      v_updated := v_updated + 1;
    else
      insert into public.shop_products
        (name, sku, category, description, price, previous_price, stock,
         sort_order, active, featured, online_sale, image_url, updated_at)
      values
        (left(v_name, 120), v_sku,
         left(coalesce(nullif(btrim(v_item->>'category'), ''), 'General'), 60),
         left(coalesce(v_item->>'description', ''), 500),
         case when not (v_item ? 'price') or v_item->'price' = 'null'::jsonb then null else greatest(0, (v_item->>'price')::numeric) end,
         case when not (v_item ? 'previous_price') or v_item->'previous_price' = 'null'::jsonb then null else greatest(0, (v_item->>'previous_price')::numeric) end,
         v_stock, coalesce((v_item->>'sort_order')::integer, 0),
         coalesce((v_item->>'active')::boolean, true),
         coalesce((v_item->>'featured')::boolean, false),
         coalesce((v_item->>'online_sale')::boolean, true),
         v_image_url, now());
      v_inserted := v_inserted + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'total', v_inserted + v_updated,
    'inserted', v_inserted,
    'updated', v_updated
  );
end;
$$;

-- Ajuste rápido de existencias desde el panel; no permite valores negativos.
create or replace function public.adjust_shop_product_stock(p_product_id uuid, p_delta integer)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_stock integer;
begin
  if not public.is_shop_admin() then raise exception 'No autorizado'; end if;
  if p_delta is null or p_delta = 0 or abs(p_delta) > 10000 then raise exception 'Ajuste inválido'; end if;

  update public.shop_products
  set stock = greatest(0, stock + p_delta), updated_at = now()
  where id = p_product_id and stock is not null
  returning stock into v_stock;

  if not found then
    raise exception 'Producto sin inventario limitado o inexistente';
  end if;
  return jsonb_build_object('id', p_product_id, 'stock', v_stock);
end;
$$;

revoke all on function public.import_shop_products(jsonb) from public;
revoke all on function public.adjust_shop_product_stock(uuid, integer) from public;
grant execute on function public.import_shop_products(jsonb) to authenticated;
grant execute on function public.adjust_shop_product_stock(uuid, integer) to authenticated;

notify pgrst, 'reload schema';
