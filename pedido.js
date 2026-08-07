(function () {
  const $ = (selector) => document.querySelector(selector);
  const money = (value) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 2 }).format(Number(value || 0));
  const escapeHtml = (value) => String(value || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  const statusOrder = ["pending", "paid", "processing", "ready", "fulfilled"];
  const stepLabels = ["Recibido", "Pagado", "Preparando", "Listo", "Entregado"];
  const statusPosition = { pending: 0, pending_payment: 0, transfer_pending: 0, quote_requested: 0, payment_failed: 0, paid: 1, processing: 2, ready: 3, fulfilled: 4 };
  let workerUrl = "";

  async function loadWorkerUrl() {
    const config = window.FANTASMAS_SUPABASE || {};
    if (!window.supabase || !config.url || !config.publishableKey) throw new Error("La consulta de pedidos todavía no está configurada");
    const client = window.supabase.createClient(config.url, config.publishableKey);
    const { data, error } = await client.from("shop_settings").select("setting_value").eq("setting_key", "store_info").maybeSingle();
    if (error) throw error;
    workerUrl = String(data?.setting_value?.checkout_worker_url || "").trim().replace(/\/+$/, "");
    if (!/^https:\/\//i.test(workerUrl)) throw new Error("La consulta de pedidos todavía no está disponible");
  }

  function renderTimeline(order) {
    if (order.status === "cancelled") {
      $("#orderTimeline").innerHTML = '<div class="timeline-step current">Pedido cancelado</div>';
      return;
    }
    const position = statusPosition[order.status] ?? 0;
    $("#orderTimeline").innerHTML = statusOrder.map((status, index) => `<div class="timeline-step ${index <= position ? "done" : ""} ${index === position ? "current" : ""}">${stepLabels[index]}</div>`).join("");
  }

  function renderOrder(order) {
    $("#resultOrderNumber").textContent = order.order_number;
    $("#resultStatus").textContent = order.status_label;
    $("#resultStatusTitle").textContent = order.status_label;
    $("#resultStatusMessage").textContent = order.status_message;
    $("#resultItems").innerHTML = order.items.map((item) => `<p><span>${Number(item.quantity) || 1} × ${escapeHtml(item.name)}</span><b>${money(Number(item.unit_price || 0) * Number(item.quantity || 1))}</b></p>`).join("");
    $("#resultDelivery").textContent = order.delivery_method === "pickup" ? "Recoger en tienda" : "Envío por cotizar";
    $("#resultPayment").textContent = order.payment_method === "transfer" ? "Transferencia" : order.payment_method === "mercadopago" ? "Mercado Pago" : "Cotización";
    $("#resultTotal").textContent = money(order.total);
    $("#resultUpdated").textContent = `Última actualización: ${new Date(order.updated_at).toLocaleString("es-MX", { dateStyle: "long", timeStyle: "short" })}`;
    renderTimeline(order);
    $("#trackingResult").hidden = false;
    $("#trackingResult").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function submit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const message = $("#trackingMessage");
    const button = $("#trackingButton");
    message.textContent = "Consultando…";
    button.disabled = true;
    $("#trackingResult").hidden = true;
    try {
      if (!workerUrl) await loadWorkerUrl();
      const result = await fetch(`${workerUrl}/track`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order_number: form.elements.order_number.value, phone: form.elements.phone.value }) });
      const data = await result.json().catch(() => ({}));
      if (!result.ok || !data.ok) throw new Error(data.error || "No se pudo consultar el pedido");
      message.textContent = "";
      renderOrder(data.order);
    } catch (error) {
      message.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  }

  const folio = new URLSearchParams(location.search).get("folio");
  if (folio) $("#orderNumber").value = folio.toUpperCase();
  $("#trackingForm").addEventListener("submit", submit);
  loadWorkerUrl().catch((error) => { $("#trackingMessage").textContent = error.message; });
})();
