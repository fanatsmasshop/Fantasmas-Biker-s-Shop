(function () {
  const config = window.FANTASMAS_SUPABASE;
  const configured = config &&
    config.url &&
    config.publishableKey &&
    !config.url.includes("PON_AQUI") &&
    !config.publishableKey.includes("PON_AQUI");

  if (!configured || !window.supabase) return;

  const client = window.supabase.createClient(config.url, config.publishableKey);

  const money = (value) => value === null || value === undefined
    ? "Consultar"
    : new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(value);

  const escapeHtml = (text) => String(text || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  async function loadProducts() {
    const target = document.querySelector("#productosDinamicos");
    const section = document.querySelector("#productosPublicos");
    if (!target || !section) return;

    const { data, error } = await client
      .from("shop_products")
      .select("*")
      .eq("active", true)
      .order("featured", { ascending: false })
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });

    if (error || !data || data.length === 0) return;

    target.innerHTML = data.map((product) => `
      <article class="producto-publico">
        <div class="producto-imagen">
          ${product.image_url
            ? `<img src="${escapeHtml(product.image_url)}" alt="${escapeHtml(product.name)}" loading="lazy">`
            : `<span>☠</span>`}
          ${product.featured ? '<b>DESTACADO</b>' : ''}
        </div>
        <div class="producto-info">
          <small>${escapeHtml(product.category)}</small>
          <h3>${escapeHtml(product.name)}</h3>
          <p>${escapeHtml(product.description)}</p>
          <div class="producto-precio">
            ${product.previous_price ? `<del>${money(product.previous_price)}</del>` : ''}
            <strong>${money(product.price)}</strong>
          </div>
          <a href="https://wa.me/525610329215?text=${encodeURIComponent(`Hola, quiero información del producto: ${product.name}`)}" target="_blank">Pedir información →</a>
        </div>
      </article>
    `).join("");

    section.hidden = false;
  }

  async function loadPromotions() {
    const target = document.querySelector("#promocionesDinamicas");
    const section = document.querySelector("#promocionesPublicas");
    if (!target || !section) return;

    const { data, error } = await client
      .from("shop_promotions")
      .select("*")
      .eq("active", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });

    if (error || !data || data.length === 0) return;

    target.innerHTML = data.map((promo) => `
      <article class="promocion-publica ${promo.image_url ? "con-imagen" : ""}" ${promo.image_url ? `style="background-image:linear-gradient(90deg,#08090dec,#08090d99),url('${escapeHtml(promo.image_url)}')"` : ""}>
        <span>${escapeHtml(promo.badge)}</span>
        <h3>${escapeHtml(promo.title)}</h3>
        <p>${escapeHtml(promo.subtitle)}</p>
        <a href="${escapeHtml(promo.button_url)}" target="_blank">${escapeHtml(promo.button_text)} →</a>
      </article>
    `).join("");

    section.hidden = false;
  }

  async function loadSettings() {
    const { data } = await client
      .from("shop_settings")
      .select("setting_value")
      .eq("setting_key", "store_info")
      .maybeSingle();

    const announcement = document.querySelector("#anuncioAdministrable");
    if (announcement && data?.setting_value?.announcement) {
      announcement.textContent = `⚡ ${data.setting_value.announcement} ⚡`;
    }
  }

  Promise.allSettled([loadProducts(), loadPromotions(), loadSettings()]);
})();

