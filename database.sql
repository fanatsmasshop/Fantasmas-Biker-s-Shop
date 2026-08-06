-- ============================================================
-- FANTASMAS BIKER'S SHOP — BASE DEL PANEL ADMINISTRATIVO
-- Ejecuta este archivo completo en Supabase > SQL Editor.
-- ============================================================

create extension if not exists "pgcrypto";

-- Personas autorizadas para entrar al panel.
create table if not exists public.shop_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Administrador',
  created_at timestamptz not null default now()
);

-- Productos visibles en la tienda pública.
create table if not exists public.shop_products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'General',
  description text not null default '',
  price numeric(10,2),
  previous_price numeric(10,2),
  image_url text,
  image_path text,
  active boolean not null default true,
  featured boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Promociones con vigencia opcional.
create table if not exists public.shop_promotions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subtitle text not null default '',
  badge text not null default 'PROMOCIÓN',
  image_url text,
  image_path text,
  button_text text not null default 'Pedir por WhatsApp',
  button_url text not null default 'https://wa.me/525610329215',
  starts_at timestamptz,
  ends_at timestamptz,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Información general editable desde el panel.
create table if not exists public.shop_settings (
  setting_key text primary key,
  setting_value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.shop_settings (setting_key, setting_value)
values (
  'store_info',
  jsonb_build_object(
    'announcement', 'Primer aniversario · 24 de agosto · 11:00 a 19:00 h',
    'whatsapp', '5610329215',
    'catalog_phone', '5651531820',
    'design_phone', '5545579857',
    'address', 'Av. Gobernadora 656, Tolotzin I, Condominio T37, Mz. 003, Ecatepec de Morelos'
  )
)
on conflict (setting_key) do nothing;

-- Bucket público para fotografías administradas por la tienda.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'shop-media',
  'shop-media',
  true,
  5242880,
  array['image/jpeg','image/png','image/webp','image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Función utilizada por todas las políticas administrativas.
create or replace function public.is_shop_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.shop_admins
    where user_id = auth.uid()
  );
$$;

grant execute on function public.is_shop_admin() to anon, authenticated;

alter table public.shop_admins enable row level security;
alter table public.shop_products enable row level security;
alter table public.shop_promotions enable row level security;
alter table public.shop_settings enable row level security;

-- Limpiar políticas si se vuelve a ejecutar el archivo.
drop policy if exists "admin_read_own_profile" on public.shop_admins;
drop policy if exists "public_read_active_products" on public.shop_products;
drop policy if exists "admins_manage_products" on public.shop_products;
drop policy if exists "public_read_active_promotions" on public.shop_promotions;
drop policy if exists "admins_manage_promotions" on public.shop_promotions;
drop policy if exists "public_read_settings" on public.shop_settings;
drop policy if exists "admins_manage_settings" on public.shop_settings;

create policy "admin_read_own_profile"
on public.shop_admins for select to authenticated
using (user_id = auth.uid());

create policy "public_read_active_products"
on public.shop_products for select to anon, authenticated
using (active = true or public.is_shop_admin());

create policy "admins_manage_products"
on public.shop_products for all to authenticated
using (public.is_shop_admin())
with check (public.is_shop_admin());

create policy "public_read_active_promotions"
on public.shop_promotions for select to anon, authenticated
using (
  public.is_shop_admin()
  or (
    active = true
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at >= now())
  )
);

create policy "admins_manage_promotions"
on public.shop_promotions for all to authenticated
using (public.is_shop_admin())
with check (public.is_shop_admin());

create policy "public_read_settings"
on public.shop_settings for select to anon, authenticated
using (true);

create policy "admins_manage_settings"
on public.shop_settings for all to authenticated
using (public.is_shop_admin())
with check (public.is_shop_admin());

-- Políticas del almacenamiento de imágenes.
drop policy if exists "public_read_shop_media" on storage.objects;
drop policy if exists "admins_upload_shop_media" on storage.objects;
drop policy if exists "admins_update_shop_media" on storage.objects;
drop policy if exists "admins_delete_shop_media" on storage.objects;

create policy "public_read_shop_media"
on storage.objects for select to public
using (bucket_id = 'shop-media');

create policy "admins_upload_shop_media"
on storage.objects for insert to authenticated
with check (bucket_id = 'shop-media' and public.is_shop_admin());

create policy "admins_update_shop_media"
on storage.objects for update to authenticated
using (bucket_id = 'shop-media' and public.is_shop_admin())
with check (bucket_id = 'shop-media' and public.is_shop_admin());

create policy "admins_delete_shop_media"
on storage.objects for delete to authenticated
using (bucket_id = 'shop-media' and public.is_shop_admin());

-- ============================================================
-- DESPUÉS DE CREAR TU USUARIO EN AUTHENTICATION > USERS:
-- 1. Copia su User UID.
-- 2. Sustituye el texto de abajo y ejecuta solamente ese INSERT.
-- ============================================================
-- insert into public.shop_admins (user_id, display_name)
-- values ('PEGA_AQUI_EL_USER_UID', 'Fantasmas Biker''s Shop');

