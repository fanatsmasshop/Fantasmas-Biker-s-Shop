-- ============================================================
-- FANTASMAS BIKER'S SHOP — EDITOR DE TIENDA (FASE 2)
-- Ejecuta este archivo completo UNA VEZ en Supabase > SQL Editor.
-- Requiere que database.sql de la Fase 1 ya esté instalado.
-- ============================================================

create table if not exists public.shop_sections (
  section_key text primary key,
  label text not null,
  title text not null default '',
  subtitle text not null default '',
  enabled boolean not null default true,
  sort_order integer not null default 0,
  layout text not null default 'grid' check (layout in ('grid','featured','compact','carousel')),
  updated_at timestamptz not null default now()
);

create table if not exists public.shop_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  icon text not null default '☠',
  description text not null default '',
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.shop_categories add column if not exists icon text not null default '☠';
alter table public.shop_categories add column if not exists description text not null default '';

create table if not exists public.shop_raffles (
  id uuid primary key default gen_random_uuid(),
  price numeric(10,2) not null check (price >= 0),
  total_numbers integer not null default 20 check (total_numbers > 0),
  icon text not null default '🎁',
  main_prize text not null,
  secondary_prizes text not null default '',
  image_url text,
  image_path text,
  button_text text not null default 'Apartar número',
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.shop_raffles add column if not exists image_url text;
alter table public.shop_raffles add column if not exists image_path text;
create unique index if not exists shop_raffles_unique_price on public.shop_raffles(price);

create table if not exists public.shop_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  event_date timestamptz not null,
  end_date timestamptz,
  location text not null default 'Fantasmas Biker''s Shop',
  image_url text,
  image_path text,
  button_text text not null default 'Más información',
  button_url text not null default 'https://wa.me/525610329215',
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.shop_sections (section_key,label,title,subtitle,enabled,sort_order,layout)
values
  ('header','Encabezado y menú','MENÚ PRINCIPAL','Navegación y acceso rápido.',true,-10,'compact'),
  ('hero','Portada','RODAMOS JUNTOS.','Accesorios biker, artículos exclusivos y personalización con carácter.',true,0,'featured'),
  ('announcement','Franja animada','ANUNCIOS DE LA TIENDA','Frases destacadas y avisos rápidos.',true,5,'compact'),
  ('promotions','Promociones','PROMOCIONES ACTIVAS','Promociones publicadas directamente por Fantasmas Biker''s Shop.',true,10,'featured'),
  ('raffles','Rifas','ELIGE TU NIVEL. CUATRO GANADORES.','Tres premios secundarios y un premio principal por rifa.',true,20,'grid'),
  ('anniversary','Aniversario','NUESTRO ANIVERSARIO SE VIVE EN LA TIENDA.','Promociones, rifas y sorpresas en nuestro evento.',true,30,'featured'),
  ('catalog_intro','Categorías','EQUIPO, ESTILO Y PERSONALIZACIÓN.','Conoce las principales categorías de nuestra tienda.',true,40,'grid'),
  ('products','Productos','PRODUCTOS DISPONIBLES.','Modelos publicados desde nuestro panel oficial.',true,50,'grid'),
  ('events','Mini eventos','PRÓXIMOS EVENTOS.','Actividades y dinámicas organizadas por la tienda.',true,60,'grid'),
  ('rewards','Fantasmas Rewards','TU LEALTAD TAMBIÉN RUEDA.','Compra, acumula sellos y recibe beneficios.',true,70,'featured'),
  ('allies','Aliados Fantasma','CONECTAMOS NEGOCIOS. CRECEMOS JUNTOS.','Una iniciativa impulsada por Fantasmas Biker''s Shop.',true,80,'featured'),
  ('contact','Contacto','ESTA ES TU CASA BIKER.','Visítanos o comunícate con nuestro equipo.',true,90,'compact'),
  ('footer','Pie de página','FANTASMAS BIKER''S SHOP','Información final del sitio.',true,100,'compact')
on conflict (section_key) do nothing;

insert into public.shop_categories (name,icon,description,sort_order)
values
  ('Equipo biker','🏍','Cascos, chalecos, guantes, protecciones, luces, candados y accesorios.',10),
  ('Accesorios','⚙','Hebillas, cadenas, anillos, gorras, mochilas y artículos para rodar.',20),
  ('Ropa','☠','Playeras, sudaderas y prendas con carácter biker.',30),
  ('Personalizados','⚡','Sublimación, DTF, vinil, diseño e impresión para tus ideas y eventos.',40),
  ('Exclusivos Fantasmas','👻','Productos creados especialmente por Fantasmas Biker''s Shop.',50)
on conflict (name) do nothing;

update public.shop_categories set icon = '🏍', description = 'Cascos, chalecos, guantes, protecciones, luces, candados y accesorios.' where name = 'Equipo biker' and description = '';
update public.shop_categories set icon = '⚙', description = 'Hebillas, cadenas, anillos, gorras, mochilas y artículos para rodar.' where name = 'Accesorios' and description = '';
update public.shop_categories set icon = '☠', description = 'Playeras, sudaderas y prendas con carácter biker.' where name = 'Ropa' and description = '';
update public.shop_categories set icon = '⚡', description = 'Sublimación, DTF, vinil, diseño e impresión para tus ideas y eventos.' where name = 'Personalizados' and description = '';
update public.shop_categories set icon = '👻', description = 'Productos creados especialmente por Fantasmas Biker''s Shop.' where name = 'Exclusivos Fantasmas' and description = '';

insert into public.shop_raffles (price,total_numbers,icon,main_prize,secondary_prizes,sort_order)
values
  (10,30,'⏰','Reloj despertador con radio y bocina Bluetooth','3 peluches exclusivos',10),
  (20,20,'🎧','Intercomunicador Bluetooth para casco','3 peluches exclusivos',20),
  (30,20,'⚙','Hebilla biker','2 peluches + mochila para tenis',30),
  (50,15,'🔑','Portallaves biker metálico #1','2 peluches + mochila para tenis',40),
  (75,12,'🏍','Portallaves biker metálico #2','Peluche + mochila + gorra',50),
  (100,10,'🎁','Muñeca Hello Kitty × Chucky','Peluche + mochila + gorra',60)
on conflict (price) do nothing;

insert into public.shop_settings (setting_key, setting_value)
values ('store_info', '{}'::jsonb)
on conflict (setting_key) do nothing;

update public.shop_settings
set setting_value = jsonb_build_object(
  'announcement','Primer aniversario · 24 de agosto · 11:00 a 19:00 h',
  'ticker_phrases','ANIVERSARIO 2026\nPREMIOS Y PROMOCIONES\nCOMUNIDAD BIKER\nFANTASMAS BIKER''S SHOP',
  'ticker_animation','scroll','ticker_speed','22','ticker_direction','left',
  'ticker_color','blue','ticker_separator','✦',
  'hero_eyebrow','SITIO OFICIAL · CD. AZTECA, ECATEPEC',
  'hero_title','RODAMOS JUNTOS.',
  'hero_highlight','CELEBRAMOS EN GRANDE.',
  'hero_intro','Accesorios biker, artículos exclusivos y personalización con carácter.',
  'main_cta_text','Ver rifas','main_cta_url','#rifas',
  'catalog_cta_text','Ver catálogo','catalog_cta_url','https://linktr.ee/FANTASMASBIKERSCDAZTECA',
  'whatsapp','5610329215','catalog_phone','5651531820','design_phone','5545579857',
  'maps_url','https://maps.app.goo.gl/NqPb7tJ6CNmK2Siq6',
  'address','Av. Gobernadora 656, Tolotzin I, Condominio T37, Mz. 003, Ecatepec de Morelos',
  'instagram_text','@fantasmashop_cdazteca','instagram_url','https://www.instagram.com/fantasmashop_cdazteca',
  'tiktok_text','@fantasmasbikershop','tiktok_url','https://www.tiktok.com/@fantasmasbikershop',
  'youtube_text','@FANTASMASBIKERSHOPCDAZTECA','youtube_url','https://www.youtube.com/@FANTASMASBIKERSHOPCDAZTECA',
  'links_url','https://linktr.ee/FANTASMASBIKERSCDAZTECA',
  'event_datetime','2026-08-24T11:00:00-06:00','countdown_enabled','true'
) || jsonb_build_object(
  'nav_raffles_text','Rifas','nav_raffles_url','#rifas',
  'nav_store_text','Tienda','nav_store_url','#tienda',
  'nav_rewards_text','Beneficios','nav_rewards_url','#beneficios',
  'nav_allies_text','Aliados','nav_allies_url','#aliados',
  'nav_contact_text','Contacto','nav_contact_url','#contacto',
  'header_cta_text','WhatsApp','header_cta_url','https://wa.me/525610329215',
  'promotions_eyebrow','PROMOCIONES ACTIVAS','raffles_eyebrow','RIFAS DE ANIVERSARIO',
  'raffles_steps_title','¿Cómo participo?','raffles_step_1','① Elige una rifa',
  'raffles_step_2','② Aparta por WhatsApp','raffles_step_3','③ Confirma tu pago',
  'raffles_step_4','④ Sigue el sorteo oficial',
  'raffles_note','Si una lista no se completa el 24 de agosto, todos los números pagados continúan vigentes hasta llenarla.',
  'anniversary_day','24','anniversary_date_label','AGOSTO 2026','anniversary_eyebrow','GUARDA LA FECHA',
  'anniversary_cta_text','Cómo llegar ↗','anniversary_cta_url','https://maps.app.goo.gl/NqPb7tJ6CNmK2Siq6',
  'catalog_eyebrow','NUESTRA TIENDA','products_eyebrow','CATÁLOGO ACTUAL','products_search_placeholder','Buscar en el catálogo...',
  'events_eyebrow','AGENDA FANTASMAS','rewards_eyebrow','FANTASMAS REWARDS',
  'rewards_count','10','rewards_title','sellos = $100 de descuento',
  'rewards_text','Obtén un sello por cada $100 de compra. Sin vigencia y canje presencial.',
  'delivery_title','ENTREGAS Y ENVÍOS','delivery_text','Tienda física, Mexibús L1 estación UNITEC y Línea B Cd. Azteca–Buenavista con compra mínima de $300. Envíos nacionales con cotización.',
  'allies_eyebrow','UN PROYECTO DE FANTASMAS BIKER''S SHOP','allies_notice','PRÓXIMAMENTE CONECTAREMOS AMBAS PLATAFORMAS',
  'contact_eyebrow','VISÍTANOS','contact_map_text','Abrir mapa','contact_whatsapp_text','Escribir ahora',
  'footer_tagline','Rodando desde Cd. Azteca.','footer_copyright','© 2026 Fantasmas Biker''s Shop · Sitio oficial'
) || setting_value,
updated_at = now()
where setting_key = 'store_info';

alter table public.shop_sections enable row level security;
alter table public.shop_categories enable row level security;
alter table public.shop_raffles enable row level security;
alter table public.shop_events enable row level security;

drop policy if exists "public_read_sections" on public.shop_sections;
drop policy if exists "admins_manage_sections" on public.shop_sections;
drop policy if exists "public_read_active_categories" on public.shop_categories;
drop policy if exists "admins_manage_categories" on public.shop_categories;
drop policy if exists "public_read_active_raffles" on public.shop_raffles;
drop policy if exists "admins_manage_raffles" on public.shop_raffles;
drop policy if exists "public_read_active_events" on public.shop_events;
drop policy if exists "admins_manage_events" on public.shop_events;

create policy "public_read_sections"
on public.shop_sections for select to anon, authenticated using (true);

create policy "admins_manage_sections"
on public.shop_sections for all to authenticated
using (public.is_shop_admin()) with check (public.is_shop_admin());

create policy "public_read_active_categories"
on public.shop_categories for select to anon, authenticated
using (active = true or public.is_shop_admin());

create policy "admins_manage_categories"
on public.shop_categories for all to authenticated
using (public.is_shop_admin()) with check (public.is_shop_admin());

create policy "public_read_active_raffles"
on public.shop_raffles for select to anon, authenticated
using (active = true or public.is_shop_admin());

create policy "admins_manage_raffles"
on public.shop_raffles for all to authenticated
using (public.is_shop_admin()) with check (public.is_shop_admin());

create policy "public_read_active_events"
on public.shop_events for select to anon, authenticated
using (active = true or public.is_shop_admin());

create policy "admins_manage_events"
on public.shop_events for all to authenticated
using (public.is_shop_admin()) with check (public.is_shop_admin());
