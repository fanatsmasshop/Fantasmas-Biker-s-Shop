-- RESPALDO / DOCUMENTACIÓN. YA APLICADO EN PRODUCCIÓN EL 02/09/2026.
-- NO EJECUTAR EN LA INSTANCIA ACTUAL.
-- Proyecto: Fantasmas-Biker-s-Shop / tyddohmyjvhqsdxircvp

-- Se endurecieron permisos de RPC: importación, stock, administración de rifas,
-- reservas y confirmación de pago. Las reservas/confirmación quedan para service_role.
-- Se agregó índice shop_analytics_events_order_idx.
-- Se limpiaron textos/event_datetime heredados del aniversario.
-- La sección legacy anniversary quedó desactivada y etiquetada como Campaña especial.

-- Estado de orden esperado en shop_sections:
-- header 10, hero 20, announcement 30, products 40, promotions 50,
-- catalog_intro 60, rewards 70, raffles 80, allies 90,
-- events 100 (off), anniversary 110 (off), contact 120, footer 130.
