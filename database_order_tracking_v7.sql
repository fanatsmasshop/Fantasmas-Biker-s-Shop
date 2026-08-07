-- ============================================================
-- FANTASMAS BIKER'S SHOP — SEGUIMIENTO Y AVISOS DE PEDIDOS V7
-- Ejecuta este archivo UNA VEZ en Supabase > SQL Editor.
-- Conserva todos los pedidos y datos actuales.
-- ============================================================

alter table public.shop_orders
  add column if not exists email_notifications boolean not null default false;

alter table public.shop_orders
  add column if not exists email_last_status text;

alter table public.shop_orders
  add column if not exists email_last_sent_at timestamptz;

create index if not exists shop_orders_number_phone_idx
  on public.shop_orders(order_number, customer_phone);

notify pgrst, 'reload schema';

