-- ============================================================
-- FANTASMAS BIKER'S SHOP — CONSTRUCTOR TOTAL (ACTUALIZACIÓN)
-- Ejecuta este archivo UNA VEZ en Supabase > SQL Editor.
-- Conserva productos, promociones, rifas, eventos y ajustes actuales.
-- ============================================================

alter table public.shop_sections
  add column if not exists section_type text not null default 'system';

alter table public.shop_sections
  add column if not exists content jsonb not null default '{}'::jsonb;

alter table public.shop_sections
  add column if not exists created_at timestamptz not null default now();

update public.shop_sections set section_type = 'custom'
where section_key like 'custom_%' and section_type <> 'custom';

update public.shop_sections set section_type = 'system'
where section_key not like 'custom_%' and section_type not in ('system','custom');

create index if not exists shop_sections_type_order_idx
on public.shop_sections(section_type, sort_order);

notify pgrst, 'reload schema';
