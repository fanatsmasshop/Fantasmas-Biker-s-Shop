-- ============================================================
-- FANTASMAS BIKER'S SHOP — RIFAS DIGITALES V11
-- Ejecuta este archivo UNA VEZ en Supabase > SQL Editor.
-- No borra rifas, productos, pedidos ni usuarios existentes.
-- ============================================================

create extension if not exists "pgcrypto";

alter table public.shop_raffles add column if not exists sales_open boolean not null default true;
alter table public.shop_raffles add column if not exists reservation_minutes integer not null default 120;
alter table public.shop_raffles add column if not exists max_numbers_per_order integer not null default 5;

create table if not exists public.shop_raffle_numbers (
  id uuid primary key default gen_random_uuid(),
  raffle_id uuid not null references public.shop_raffles(id) on delete cascade,
  number integer not null check (number > 0),
  status text not null default 'available' check (status in ('available','reserved','paid','blocked','winner')),
  order_id uuid references public.shop_orders(id) on delete set null,
  customer_name text not null default '',
  customer_phone text not null default '',
  customer_email text not null default '',
  reserved_until timestamptz,
  paid_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (raffle_id, number)
);

create index if not exists shop_raffle_numbers_raffle_status_idx
on public.shop_raffle_numbers(raffle_id, status, number);
create index if not exists shop_raffle_numbers_order_idx
on public.shop_raffle_numbers(order_id) where order_id is not null;

create table if not exists public.shop_raffle_draws (
  id uuid primary key default gen_random_uuid(),
  raffle_id uuid not null references public.shop_raffles(id) on delete cascade,
  raffle_number_id uuid not null references public.shop_raffle_numbers(id) on delete restrict,
  prize_order integer not null,
  prize_name text not null,
  winning_number integer not null,
  public_winner text not null default '',
  participant_count integer not null default 0,
  drawn_at timestamptz not null default now(),
  drawn_by uuid references auth.users(id),
  unique (raffle_id, prize_order),
  unique (raffle_id, raffle_number_id)
);

create table if not exists public.shop_raffle_live_state (
  raffle_id uuid primary key references public.shop_raffles(id) on delete cascade,
  phase text not null default 'idle' check (phase in ('idle','countdown','spinning','winner','finished')),
  current_prize text not null default '',
  current_prize_order integer not null default 0,
  winning_number integer,
  public_winner text not null default '',
  revision bigint not null default 0,
  updated_at timestamptz not null default now()
);

create or replace function public.sync_shop_raffle_numbers(p_raffle_id uuid)
returns void language plpgsql security definer set search_path = public, auth as $$
declare v_total integer;
begin
  select total_numbers into v_total from public.shop_raffles where id = p_raffle_id;
  if v_total is null then return; end if;
  insert into public.shop_raffle_numbers(raffle_id, number)
  select p_raffle_id, n from generate_series(1, v_total) n
  on conflict (raffle_id, number) do nothing;
  delete from public.shop_raffle_numbers
  where raffle_id = p_raffle_id and number > v_total and status = 'available';
end; $$;

create or replace function public.shop_raffle_sync_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.sync_shop_raffle_numbers(new.id);
  insert into public.shop_raffle_live_state(raffle_id) values (new.id) on conflict do nothing;
  return new;
end; $$;

drop trigger if exists shop_raffles_sync_numbers on public.shop_raffles;
create trigger shop_raffles_sync_numbers after insert or update of total_numbers
on public.shop_raffles for each row execute function public.shop_raffle_sync_trigger();

select public.sync_shop_raffle_numbers(id) from public.shop_raffles;
insert into public.shop_raffle_live_state(raffle_id)
select id from public.shop_raffles on conflict do nothing;

-- Mapa público: jamás entrega nombres, teléfonos, correos ni folios.
create or replace function public.get_shop_raffle_number_map(p_raffle_id uuid)
returns table(number integer, status text, reserved_until timestamptz)
language sql security definer set search_path = public as $$
  select n.number,
    case when n.status = 'reserved' and n.reserved_until <= now() then 'available' else n.status end,
    case when n.status = 'reserved' and n.reserved_until > now() then n.reserved_until else null end
  from public.shop_raffle_numbers n
  join public.shop_raffles r on r.id = n.raffle_id
  where n.raffle_id = p_raffle_id and r.active = true
  order by n.number;
$$;

-- El Worker usa esta función después de crear el pedido. El bloqueo de fila
-- evita que dos clientes obtengan el mismo número simultáneamente.
create or replace function public.reserve_shop_raffle_numbers(p_order_id uuid, p_selections jsonb)
returns jsonb language plpgsql security definer set search_path = public, auth as $$
declare v_order public.shop_orders%rowtype; v_item jsonb; v_raffle public.shop_raffles%rowtype;
  v_number integer; v_changed integer; v_count integer; v_expires timestamptz;
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'No autorizado'; end if;
  select * into v_order from public.shop_orders where id = p_order_id for update;
  if not found then raise exception 'Pedido no encontrado'; end if;
  if jsonb_typeof(p_selections) <> 'array' then raise exception 'Selección de rifa inválida'; end if;

  for v_raffle in select * from public.shop_raffles where id in
    (select distinct (value->>'raffle_id')::uuid from jsonb_array_elements(p_selections))
  loop
    select count(*) into v_count from jsonb_array_elements(p_selections) x where (x.value->>'raffle_id')::uuid = v_raffle.id;
    if not v_raffle.active or not v_raffle.sales_open then raise exception 'La venta de esta rifa está cerrada'; end if;
    if v_count > v_raffle.max_numbers_per_order then raise exception 'Máximo % números por pedido', v_raffle.max_numbers_per_order; end if;
  end loop;

  for v_item in select value from jsonb_array_elements(p_selections)
  loop
    v_number := (v_item->>'number')::integer;
    select * into v_raffle from public.shop_raffles where id = (v_item->>'raffle_id')::uuid for update;
    if not found or v_number < 1 or v_number > v_raffle.total_numbers then raise exception 'Número de rifa inválido'; end if;
    v_expires := now() + make_interval(mins => greatest(5, least(1440, v_raffle.reservation_minutes)));
    update public.shop_raffle_numbers set status='reserved', order_id=p_order_id,
      customer_name=v_order.customer_name, customer_phone=v_order.customer_phone,
      customer_email=v_order.customer_email, reserved_until=v_expires, updated_at=now()
    where raffle_id=v_raffle.id and number=v_number
      and (status='available' or (status='reserved' and reserved_until <= now()));
    get diagnostics v_changed = row_count;
    if v_changed <> 1 then raise exception 'El número % acaba de ser ocupado. Elige otro.', v_number; end if;
  end loop;
  return jsonb_build_object('ok',true,'reserved',jsonb_array_length(p_selections));
end; $$;

-- V11: confirma productos y números de rifa en una sola transacción.
create or replace function public.confirm_shop_order_payment(p_order_id uuid, p_payment_id text default null, p_payment_status text default 'approved')
returns public.shop_orders language plpgsql security definer set search_path = public, auth as $$
declare v_order public.shop_orders%rowtype; v_item jsonb; v_product_id uuid; v_quantity integer; v_stock integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' and not public.is_shop_admin() then raise exception 'No autorizado'; end if;
  select * into v_order from public.shop_orders where id=p_order_id for update;
  if not found then raise exception 'Pedido no encontrado'; end if;
  if p_payment_status='approved' and not v_order.stock_applied then
    for v_item in select value from jsonb_array_elements(v_order.items) loop
      if coalesce(v_item->>'kind','product') = 'product' then
        v_product_id := (v_item->>'id')::uuid; v_quantity := greatest(1,least(99,coalesce((v_item->>'quantity')::integer,1)));
        select stock into v_stock from public.shop_products where id=v_product_id for update;
        if found and v_stock is not null and v_stock < v_quantity then raise exception 'Existencias insuficientes para %',coalesce(v_item->>'name','un producto'); end if;
      elsif v_item->>'kind' = 'raffle_number' and not exists (
        select 1 from public.shop_raffle_numbers n
        where n.order_id=p_order_id and n.raffle_id=(v_item->>'raffle_id')::uuid
          and n.number=(v_item->>'raffle_number')::integer and n.status='reserved'
          and n.reserved_until > now()
      ) then
        raise exception 'La reserva del número % venció o ya no está disponible', v_item->>'raffle_number';
      end if;
    end loop;
    for v_item in select value from jsonb_array_elements(v_order.items) loop
      if coalesce(v_item->>'kind','product') = 'product' then
        update public.shop_products set stock=stock-greatest(1,coalesce((v_item->>'quantity')::integer,1)),updated_at=now()
        where id=(v_item->>'id')::uuid and stock is not null;
      end if;
    end loop;
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

create or replace function public.release_shop_order_raffles(p_order_id uuid)
returns integer language plpgsql security definer set search_path=public,auth as $$
declare v_count integer;
begin
  if coalesce(auth.role(),'') <> 'service_role' and not public.is_shop_admin() then raise exception 'No autorizado'; end if;
  update public.shop_raffle_numbers set status='available',order_id=null,customer_name='',customer_phone='',customer_email='',reserved_until=null,paid_at=null,updated_at=now()
  where order_id=p_order_id and status in ('reserved','paid');
  get diagnostics v_count=row_count; return v_count;
end; $$;

create or replace function public.admin_set_shop_raffle_number(p_raffle_id uuid,p_number integer,p_action text,p_customer_name text default '',p_customer_phone text default '',p_customer_email text default '')
returns public.shop_raffle_numbers language plpgsql security definer set search_path=public,auth as $$
declare v_row public.shop_raffle_numbers%rowtype;
begin
  if not public.is_shop_admin() then raise exception 'No autorizado'; end if;
  perform public.sync_shop_raffle_numbers(p_raffle_id);
  if p_action='paid' then
    update public.shop_raffle_numbers set status='paid',order_id=null,customer_name=left(btrim(p_customer_name),120),customer_phone=left(regexp_replace(p_customer_phone,'\D','','g'),15),customer_email=left(lower(btrim(p_customer_email)),160),reserved_until=null,paid_at=now(),updated_at=now()
    where raffle_id=p_raffle_id and number=p_number and status in ('available','reserved','paid');
  elsif p_action='release' then
    update public.shop_raffle_numbers set status='available',order_id=null,customer_name='',customer_phone='',customer_email='',reserved_until=null,paid_at=null,updated_at=now()
    where raffle_id=p_raffle_id and number=p_number and status <> 'winner';
  elsif p_action='block' then
    update public.shop_raffle_numbers set status='blocked',order_id=null,customer_name='',customer_phone='',customer_email='',reserved_until=null,paid_at=null,updated_at=now()
    where raffle_id=p_raffle_id and number=p_number and status in ('available','blocked');
  else raise exception 'Acción inválida'; end if;
  select * into v_row from public.shop_raffle_numbers where raffle_id=p_raffle_id and number=p_number;
  if not found then raise exception 'Número no encontrado o no se puede modificar'; end if;
  return v_row;
end; $$;

create or replace function public.admin_shop_raffle_numbers(p_raffle_id uuid)
returns setof public.shop_raffle_numbers language sql security definer set search_path=public,auth as $$
  select n.* from public.shop_raffle_numbers n where public.is_shop_admin() and n.raffle_id=p_raffle_id order by n.number;
$$;

create or replace function public.set_shop_raffle_live_phase(p_raffle_id uuid,p_phase text,p_prize text default '',p_prize_order integer default 0)
returns public.shop_raffle_live_state language plpgsql security definer set search_path=public,auth as $$
declare v_state public.shop_raffle_live_state%rowtype;
begin
  if not public.is_shop_admin() then raise exception 'No autorizado'; end if;
  if p_phase not in ('idle','countdown','spinning','winner','finished') then raise exception 'Fase inválida'; end if;
  insert into public.shop_raffle_live_state(raffle_id,phase,current_prize,current_prize_order,winning_number,public_winner,revision,updated_at)
  values(p_raffle_id,p_phase,left(p_prize,180),p_prize_order,null,'',1,now())
  on conflict(raffle_id) do update set phase=excluded.phase,current_prize=excluded.current_prize,current_prize_order=excluded.current_prize_order,
    winning_number=case when excluded.phase in ('winner','finished') then shop_raffle_live_state.winning_number else null end,
    public_winner=case when excluded.phase in ('winner','finished') then shop_raffle_live_state.public_winner else '' end,
    revision=shop_raffle_live_state.revision+1,updated_at=now() returning * into v_state;
  return v_state;
end; $$;

create or replace function public.draw_shop_raffle_winner(p_raffle_id uuid,p_prize_name text,p_prize_order integer)
returns public.shop_raffle_draws language plpgsql security definer set search_path=public,auth as $$
declare v_number public.shop_raffle_numbers%rowtype; v_draw public.shop_raffle_draws%rowtype; v_count integer; v_public text;
begin
  if not public.is_shop_admin() then raise exception 'No autorizado'; end if;
  if p_prize_order <> coalesce((select max(prize_order)+1 from public.shop_raffle_draws where raffle_id=p_raffle_id),1) then
    raise exception 'Los premios deben sortearse en orden; el principal va al final';
  end if;
  if exists(select 1 from public.shop_raffle_draws where raffle_id=p_raffle_id and prize_order=p_prize_order) then raise exception 'Ese premio ya fue sorteado'; end if;
  select count(*) into v_count from public.shop_raffle_numbers where raffle_id=p_raffle_id and status in ('paid','winner');
  select * into v_number from public.shop_raffle_numbers where raffle_id=p_raffle_id and status='paid'
    and not exists(select 1 from public.shop_raffle_draws d where d.raffle_number_id=shop_raffle_numbers.id)
    order by gen_random_uuid() limit 1 for update;
  if not found then raise exception 'No quedan números pagados disponibles para sortear'; end if;
  v_public := case when length(v_number.customer_name)>2 then left(v_number.customer_name,1)||repeat('•',greatest(2,length(v_number.customer_name)-2))||right(v_number.customer_name,1) else 'Participante' end;
  insert into public.shop_raffle_draws(raffle_id,raffle_number_id,prize_order,prize_name,winning_number,public_winner,participant_count,drawn_by)
  values(p_raffle_id,v_number.id,p_prize_order,left(p_prize_name,180),v_number.number,v_public,v_count,auth.uid()) returning * into v_draw;
  update public.shop_raffle_numbers set status='winner',updated_at=now() where id=v_number.id;
  update public.shop_raffle_live_state set phase='winner',current_prize=v_draw.prize_name,current_prize_order=p_prize_order,
    winning_number=v_draw.winning_number,public_winner=v_draw.public_winner,revision=revision+1,updated_at=now() where raffle_id=p_raffle_id;
  return v_draw;
end; $$;

alter table public.shop_raffle_numbers enable row level security;
alter table public.shop_raffle_draws enable row level security;
alter table public.shop_raffle_live_state enable row level security;

drop policy if exists "admins_read_raffle_numbers" on public.shop_raffle_numbers;
create policy "admins_read_raffle_numbers" on public.shop_raffle_numbers for select to authenticated using (public.is_shop_admin());
drop policy if exists "admins_read_draws" on public.shop_raffle_draws;
create policy "admins_read_draws" on public.shop_raffle_draws for select to authenticated using (public.is_shop_admin());
drop policy if exists "public_read_live_raffle" on public.shop_raffle_live_state;
create policy "public_read_live_raffle" on public.shop_raffle_live_state for select to anon,authenticated using (true);

revoke all on public.shop_raffle_numbers,public.shop_raffle_draws from anon;
grant select on public.shop_raffle_numbers,public.shop_raffle_draws to authenticated;
grant select on public.shop_raffle_live_state to anon,authenticated;
revoke all on function public.sync_shop_raffle_numbers(uuid) from public;
revoke all on function public.get_shop_raffle_number_map(uuid) from public;
revoke all on function public.reserve_shop_raffle_numbers(uuid,jsonb) from public;
revoke all on function public.release_shop_order_raffles(uuid) from public;
revoke all on function public.admin_set_shop_raffle_number(uuid,integer,text,text,text,text) from public;
revoke all on function public.admin_shop_raffle_numbers(uuid) from public;
revoke all on function public.set_shop_raffle_live_phase(uuid,text,text,integer) from public;
revoke all on function public.draw_shop_raffle_winner(uuid,text,integer) from public;
grant execute on function public.get_shop_raffle_number_map(uuid) to anon,authenticated;
grant execute on function public.reserve_shop_raffle_numbers(uuid,jsonb) to service_role;
grant execute on function public.release_shop_order_raffles(uuid) to authenticated,service_role;
grant execute on function public.admin_set_shop_raffle_number(uuid,integer,text,text,text,text) to authenticated;
grant execute on function public.admin_shop_raffle_numbers(uuid) to authenticated;
grant execute on function public.set_shop_raffle_live_phase(uuid,text,text,integer) to authenticated;
grant execute on function public.draw_shop_raffle_winner(uuid,text,integer) to authenticated;

do $$ begin
  alter publication supabase_realtime add table public.shop_raffle_live_state;
exception when duplicate_object or undefined_object then null; end $$;

notify pgrst, 'reload schema';
