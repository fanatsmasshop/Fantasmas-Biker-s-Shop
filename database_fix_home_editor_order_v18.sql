-- RESPALDO. YA APLICADO EN SUPABASE EL 2026-09-01.
-- No ejecutar de nuevo salvo restauración manual.
insert into public.shop_sections(section_key,label,title,subtitle,enabled,sort_order,layout,section_type,content)
values('raffles','Rifas','RIFAS DISPONIBLES.','Elige una dinámica, consulta premios y participa desde la tienda.',true,80,'grid','system','{}'::jsonb)
on conflict(section_key) do update set label=excluded.label,title=excluded.title,subtitle=excluded.subtitle,enabled=true,sort_order=80,layout='grid',updated_at=now();

update public.shop_sections set enabled=true,sort_order=10 where section_key='header';
update public.shop_sections set enabled=true,sort_order=20,layout='featured' where section_key='hero';
update public.shop_sections set enabled=true,sort_order=30,layout='compact' where section_key='announcement';
update public.shop_sections set enabled=true,sort_order=40,layout='grid' where section_key='products';
update public.shop_sections set enabled=true,sort_order=50,layout='featured' where section_key='promotions';
update public.shop_sections set enabled=true,sort_order=60,layout='grid' where section_key='catalog_intro';
update public.shop_sections set enabled=true,sort_order=70,layout='featured' where section_key='rewards';
update public.shop_sections set enabled=true,sort_order=90,layout='featured' where section_key='allies';
update public.shop_sections set enabled=false,sort_order=100 where section_key='events';
update public.shop_sections set enabled=false,sort_order=110 where section_key='anniversary';
update public.shop_sections set enabled=true,sort_order=120,layout='compact' where section_key='contact';
update public.shop_sections set enabled=true,sort_order=130,layout='compact' where section_key='footer';
