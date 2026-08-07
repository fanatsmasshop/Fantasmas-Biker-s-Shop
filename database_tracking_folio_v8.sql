-- ============================================================
-- FANTASMAS BIKER'S SHOP — FOLIO PÚBLICO SEGURO V8
-- Ejecuta este archivo UNA VEZ en Supabase > SQL Editor.
-- Los pedidos existentes conservan su folio y siguen funcionando.
-- ============================================================

create extension if not exists "pgcrypto";

alter table public.shop_orders
  alter column order_number set default
  ('FBS-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)));

notify pgrst, 'reload schema';

