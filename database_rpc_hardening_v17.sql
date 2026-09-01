-- Fantasmas Shop · hardening de permisos RPC · YA APLICADO 2026-08-31
revoke execute on function public.shop_analytics_summary(integer) from anon;
revoke execute on function public.reserve_shop_order_products(uuid,integer) from anon,authenticated;
revoke execute on function public.release_shop_order_products(uuid) from anon,authenticated;
revoke execute on function public.confirm_shop_order_payment(uuid,text,text) from anon,authenticated;
grant execute on function public.reserve_shop_order_products(uuid,integer) to service_role;
grant execute on function public.release_shop_order_products(uuid) to service_role;
grant execute on function public.confirm_shop_order_payment(uuid,text,text) to service_role;
