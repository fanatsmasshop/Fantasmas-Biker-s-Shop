-- FANTASMAS BIKER'S SHOP — V15 RESERVA CRÍTICA DE INVENTARIO
-- Ejecutar en Supabase SQL Editor ANTES de publicar cloudflare-mercadopago-worker.js.

begin;

create table if not exists public.shop_product_reservations (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.shop_orders(id) on delete cascade,
  product_id uuid not null references public.shop_products(id) on delete cascade,
  quantity integer not null check (quantity > 0 and quantity <= 99),
  status text not null default 'active' check (status in ('active','released','consumed')),
  reserved_until timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(order_id, product_id)
);

create index if not exists shop_product_reservations_active_idx
  on public.shop_product_reservations(product_id, reserved_until)
  where status='active';

alter table public.shop_product_reservations enable row level security;
revoke all on table public.shop_product_reservations from anon, authenticated;
grant all on table public.shop_product_reservations to service_role;

create or replace function public.reserve_shop_order_products(p_order_id uuid, p_minutes integer default 20)
returns jsonb language plpgsql security definer set search_path=public,auth as $$
declare
  v_order public.shop_orders%rowtype;
  v_item jsonb;
  v_product_id uuid;
  v_quantity integer;
  v_stock integer;
  v_reserved integer;
  v_count integer:=0;
  v_until timestamptz:=now()+make_interval(mins=>greatest(5,least(120,p_minutes)));
begin
  if coalesce(auth.role(),'') <> 'service_role' then raise exception 'No autorizado'; end if;
  select * into v_order from public.shop_orders where id=p_order_id for update;
  if not found then raise exception 'Pedido no encontrado'; end if;

  for v_item in select value from jsonb_array_elements(v_order.items) loop
    if coalesce(v_item->>'kind','product') <> 'product' then continue; end if;
    v_product_id := (v_item->>'id')::uuid;
    v_quantity := greatest(1,least(99,coalesce((v_item->>'quantity')::integer,1)));

    select stock into v_stock from public.shop_products where id=v_product_id and active=true for update;
    if not found then raise exception 'Un producto ya no está disponible'; end if;

    update public.shop_product_reservations
      set status='released',updated_at=now()
      where product_id=v_product_id and status='active' and reserved_until<=now();

    select coalesce(sum(quantity),0)::integer into v_reserved
      from public.shop_product_reservations
      where product_id=v_product_id and status='active' and reserved_until>now() and order_id<>p_order_id;

    if v_stock is not null and (v_stock-v_reserved) < v_quantity then
      raise exception 'La última existencia de % acaba de ser reservada por otro cliente',coalesce(v_item->>'name','un producto');
    end if;

    insert into public.shop_product_reservations(order_id,product_id,quantity,status,reserved_until,updated_at)
    values(p_order_id,v_product_id,v_quantity,'active',v_until,now())
    on conflict(order_id,product_id) do update set quantity=excluded.quantity,status='active',reserved_until=excluded.reserved_until,updated_at=now();
    v_count:=v_count+1;
  end loop;
  return jsonb_build_object('ok',true,'reserved',v_count,'reserved_until',v_until);
end; $$;

create or replace function public.release_shop_order_products(p_order_id uuid)
returns integer language plpgsql security definer set search_path=public,auth as $$
declare v_count integer;
begin
  if coalesce(auth.role(),'') <> 'service_role' and not public.is_shop_admin() then raise exception 'No autorizado'; end if;
  update public.shop_product_reservations set status='released',updated_at=now()
  where order_id=p_order_id and status='active';
  get diagnostics v_count=row_count;
  return v_count;
end; $$;

-- Sustituye la confirmación V11: consume una reserva válida o, si expiró,
-- vuelve a comprobar disponibilidad real antes de descontar stock.
create or replace function public.confirm_shop_order_payment(p_order_id uuid,p_payment_id text default null,p_payment_status text default 'approved')
returns public.shop_orders language plpgsql security definer set search_path=public,auth as $$
declare
  v_order public.shop_orders%rowtype;
  v_item jsonb;
  v_product_id uuid;
  v_quantity integer;
  v_stock integer;
  v_reserved_others integer;
begin
  if coalesce(auth.role(),'') <> 'service_role' and not public.is_shop_admin() then raise exception 'No autorizado'; end if;
  select * into v_order from public.shop_orders where id=p_order_id for update;
  if not found then raise exception 'Pedido no encontrado'; end if;

  if p_payment_status='approved' and not v_order.stock_applied then
    for v_item in select value from jsonb_array_elements(v_order.items) loop
      if coalesce(v_item->>'kind','product')='product' then
        v_product_id := (v_item->>'id')::uuid;
        v_quantity := greatest(1,least(99,coalesce((v_item->>'quantity')::integer,1)));
        select stock into v_stock from public.shop_products where id=v_product_id for update;
        if not found then raise exception 'Producto no encontrado'; end if;
        update public.shop_product_reservations set status='released',updated_at=now()
          where product_id=v_product_id and status='active' and reserved_until<=now() and order_id<>p_order_id;
        select coalesce(sum(quantity),0)::integer into v_reserved_others
          from public.shop_product_reservations
          where product_id=v_product_id and status='active' and reserved_until>now() and order_id<>p_order_id;
        if v_stock is not null and (v_stock-v_reserved_others)<v_quantity then
          raise exception 'Existencias insuficientes para %',coalesce(v_item->>'name','un producto');
        end if;
      elsif v_item->>'kind'='raffle_number' and not exists(
        select 1 from public.shop_raffle_numbers n where n.order_id=p_order_id
          and n.raffle_id=(v_item->>'raffle_id')::uuid and n.number=(v_item->>'raffle_number')::integer
          and n.status='reserved' and n.reserved_until>now()
      ) then
        raise exception 'La reserva del número % venció o ya no está disponible',v_item->>'raffle_number';
      end if;
    end loop;

    for v_item in select value from jsonb_array_elements(v_order.items) loop
      if coalesce(v_item->>'kind','product')='product' then
        update public.shop_products set stock=stock-greatest(1,coalesce((v_item->>'quantity')::integer,1)),updated_at=now()
        where id=(v_item->>'id')::uuid and stock is not null;
      end if;
    end loop;

    update public.shop_product_reservations set status='consumed',updated_at=now()
      where order_id=p_order_id and status='active';
    update public.shop_raffle_numbers set status='paid',paid_at=now(),reserved_until=null,updated_at=now()
      where order_id=p_order_id and status='reserved';
  end if;

  update public.shop_orders set mp_payment_id=coalesce(nullif(p_payment_id,''),mp_payment_id),
    mp_payment_status=coalesce(nullif(p_payment_status,''),mp_payment_status),
    status=case when p_payment_status='approved' then 'paid' else status end,
    stock_applied=case when p_payment_status='approved' then true else stock_applied end,updated_at=now()
  where id=p_order_id returning * into v_order;
  return v_order;
end; $$;

revoke all on function public.reserve_shop_order_products(uuid,integer) from public;
revoke all on function public.release_shop_order_products(uuid) from public;
grant execute on function public.reserve_shop_order_products(uuid,integer) to service_role;
grant execute on function public.release_shop_order_products(uuid) to authenticated,service_role;

commit;
