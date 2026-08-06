(function () {
  const config = window.FANTASMAS_SUPABASE;
  const configured = config && config.url && config.publishableKey && !config.url.includes("PON_AQUI") && !config.publishableKey.includes("PON_AQUI");
  if (!configured || !window.supabase) return;

  const client = window.supabase.createClient(config.url, config.publishableKey);
  let products = [];
  let selectedCategory = "Todas";
  let storeWhatsApp = "525610329215";
  const sectionsReady = window.FANTASMAS_SECTIONS_READY || Promise.resolve([]);

  const money = (value) => value === null || value === undefined
    ? "Consultar"
    : new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(value);
  const escapeHtml = (text) => String(text || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  const canReveal = (section) => section && section.dataset.editorDisabled !== "true";
  const digits = (value) => String(value || "").replace(/\D/g, "");
  const whatsappNumber = (value) => { const number = digits(value); return number.length === 10 ? `52${number}` : number || "525610329215"; };
  const displayPhone = (value) => { const number = digits(value).replace(/^52(?=\d{10}$)/, ""); return number.length === 10 ? `${number.slice(0,2)} ${number.slice(2,6)} ${number.slice(6)}` : value; };
  const setText = (selector, value) => { const element = document.querySelector(selector); if (element && value) element.textContent = value; };
  const setHref = (selector, value) => { const element = document.querySelector(selector); if (element && value) element.href = value; };

  function renderProducts() {
    const target = document.querySelector("#productosDinamicos");
    const section = document.querySelector("#productosPublicos");
    if (!target || !section) return;
    const search = (document.querySelector("#catalogSearch")?.value || "").trim().toLowerCase();
    const filtered = products.filter((product) => {
      const matchCategory = selectedCategory === "Todas" || product.category === selectedCategory;
      const matchSearch = !search || `${product.name} ${product.category} ${product.description}`.toLowerCase().includes(search);
      return matchCategory && matchSearch;
    });
    target.innerHTML = filtered.length ? filtered.map((product) => `
      <article class="producto-publico">
        <div class="producto-imagen">
          ${product.image_url ? `<img src="${escapeHtml(product.image_url)}" alt="${escapeHtml(product.name)}" loading="lazy">` : "<span>☠</span>"}
          ${product.featured ? "<b>DESTACADO</b>" : ""}
        </div>
        <div class="producto-info">
          <small>${escapeHtml(product.category)}</small>
          <h3>${escapeHtml(product.name)}</h3>
          <p>${escapeHtml(product.description)}</p>
          <div class="producto-precio">${product.previous_price ? `<del>${money(product.previous_price)}</del>` : ""}<strong>${money(product.price)}</strong></div>
          <a href="https://wa.me/${storeWhatsApp}?text=${encodeURIComponent(`Hola, quiero información del producto: ${product.name}`)}" target="_blank">Pedir información →</a>
        </div>
      </article>`).join("") : '<p class="catalog-empty">No encontramos productos con ese filtro.</p>';
    if (products.length && canReveal(section)) section.hidden = false;
  }

  function renderProductFilters() {
    const target = document.querySelector("#categoryFilters");
    if (!target) return;
    const names = ["Todas", ...new Set(products.map((product) => product.category).filter(Boolean))];
    target.innerHTML = names.map((name) => `<button type="button" class="${name === selectedCategory ? "active" : ""}" data-public-category="${escapeHtml(name)}">${escapeHtml(name)}</button>`).join("");
  }

  async function loadProducts() {
    await sectionsReady;
    const { data, error } = await client.from("shop_products").select("*").eq("active", true).order("featured", { ascending: false }).order("sort_order").order("created_at", { ascending: false });
    if (error) return;
    products = data || [];
    renderProductFilters(); renderProducts();
  }

  async function loadCategories() {
    await sectionsReady;
    const target = document.querySelector("#categoriasDinamicas");
    if (!target) return;
    const { data, error } = await client.from("shop_categories").select("*").eq("active", true).order("sort_order").order("name");
    if (error) return;
    target.innerHTML = (data || []).map((category) => `<article><span>${escapeHtml(category.icon || "☠")}</span><h3>${escapeHtml(category.name)}</h3><p>${escapeHtml(category.description)}</p></article>`).join("");
  }

  async function loadPromotions() {
    await sectionsReady;
    const target = document.querySelector("#promocionesDinamicas");
    const section = document.querySelector("#promocionesPublicas");
    if (!target || !section) return;
    const { data, error } = await client.from("shop_promotions").select("*").eq("active", true).order("sort_order").order("created_at", { ascending: false });
    if (error || !data || data.length === 0) return;
    target.innerHTML = data.map((promo) => `
      <article class="promocion-publica ${promo.image_url ? "con-imagen" : ""}" ${promo.image_url ? `style="background-image:linear-gradient(90deg,#08090dec,#08090d99),url('${escapeHtml(promo.image_url)}')"` : ""}>
        <span>${escapeHtml(promo.badge)}</span><h3>${escapeHtml(promo.title)}</h3><p>${escapeHtml(promo.subtitle)}</p><a href="${escapeHtml(promo.button_url)}" target="_blank">${escapeHtml(promo.button_text)} →</a>
      </article>`).join("");
    if (canReveal(section)) section.hidden = false;
  }

  async function loadRaffles() {
    await sectionsReady;
    const target = document.querySelector("#listaRifas");
    const section = document.querySelector("#rifas");
    if (!target || !section) return;
    const { data, error } = await client.from("shop_raffles").select("*").eq("active", true).order("sort_order").order("price");
    if (error) return;
    if (!data || data.length === 0) { target.innerHTML = ""; section.hidden = true; return; }
    target.innerHTML = data.map((raffle) => {
      const message = encodeURIComponent(`Hola, quiero apartar un número de la rifa de $${raffle.price} de Fantasmas Biker's Shop.`);
      return `<article class="rifa"><div class="rifa-cabecera">${raffle.image_url ? `<img src="${escapeHtml(raffle.image_url)}" alt="${escapeHtml(raffle.main_prize)}" loading="lazy">` : `<span class="icono">${escapeHtml(raffle.icon)}</span>`}<span class="cantidad">${raffle.total_numbers} NÚMEROS</span></div><div class="rifa-cuerpo"><div class="precio"><small>$</small>${Number(raffle.price).toLocaleString("es-MX")}<small> MXN</small></div><p class="mini">PREMIO PRINCIPAL</p><h3>${escapeHtml(raffle.main_prize)}</h3><p class="secundarios"><b>Premios secundarios:</b> ${escapeHtml(raffle.secondary_prizes)}</p><a href="https://wa.me/${storeWhatsApp}?text=${message}" target="_blank">${escapeHtml(raffle.button_text)} <b>→</b></a></div></article>`;
    }).join("");
    if (canReveal(section)) section.hidden = false;
  }

  async function loadEvents() {
    await sectionsReady;
    const target = document.querySelector("#eventosDinamicos");
    const section = document.querySelector("#eventosPublicos");
    if (!target || !section) return;
    const { data, error } = await client.from("shop_events").select("*").eq("active", true).order("sort_order").order("event_date");
    if (error || !data || data.length === 0) return;
    target.innerHTML = data.map((item) => {
      const date = new Date(item.event_date);
      return `<article class="evento-publico"><div class="evento-imagen">${item.image_url ? `<img src="${escapeHtml(item.image_url)}" alt="${escapeHtml(item.title)}" loading="lazy">` : "<span>◷</span>"}<time><b>${date.toLocaleDateString("es-MX", { day: "2-digit" })}</b>${date.toLocaleDateString("es-MX", { month: "short" }).toUpperCase()}</time></div><div class="evento-info"><small>${date.toLocaleString("es-MX", { dateStyle: "long", timeStyle: "short" })}</small><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.description)}</p><span>⌖ ${escapeHtml(item.location)}</span><a href="${escapeHtml(item.button_url)}" target="_blank">${escapeHtml(item.button_text)} →</a></div></article>`;
    }).join("");
    if (canReveal(section)) section.hidden = false;
  }

  async function loadSettings() {
    const { data } = await client.from("shop_settings").select("setting_value").eq("setting_key", "store_info").maybeSingle();
    const value = data?.setting_value || {};
    if (value.whatsapp) storeWhatsApp = whatsappNumber(value.whatsapp);
    setText("#anuncioAdministrable", value.announcement ? `⚡ ${value.announcement} ⚡` : "");
    setText("#heroEyebrow", value.hero_eyebrow); setText("#heroTitle", value.hero_title); setText("#heroHighlight", value.hero_highlight); setText("#heroIntro", value.hero_intro);
    setText("#mainCta", value.main_cta_text); setHref("#mainCta", value.main_cta_url); setText("#catalogCta", value.catalog_cta_text); setHref("#catalogCta", value.catalog_cta_url);
    setText("#storeAddress", value.address); setText("#storeWhatsapp", displayPhone(value.whatsapp)); setText("#storeCatalogPhone", displayPhone(value.catalog_phone)); setText("#storeDesignPhone", displayPhone(value.design_phone)); setHref("#mapsLink", value.maps_url);
    document.querySelectorAll(".whatsapp-link").forEach((link) => link.href = `https://wa.me/${storeWhatsApp}`);
    const social = [["#instagramLink", value.instagram_url, value.instagram_text], ["#tiktokLink", value.tiktok_url, value.tiktok_text], ["#youtubeLink", value.youtube_url, value.youtube_text]];
    social.forEach(([selector, url, text]) => { const link = document.querySelector(selector); if (!link) return; if (url) link.href = url; if (text) link.querySelector("b").textContent = text; });
    setHref("#allLinks", value.links_url);
  }

  document.querySelector("#catalogSearch")?.addEventListener("input", renderProducts);
  document.querySelector("#categoryFilters")?.addEventListener("click", (event) => { const button = event.target.closest("[data-public-category]"); if (!button) return; selectedCategory = button.dataset.publicCategory; renderProductFilters(); renderProducts(); });

  (async function initializePublicStore() {
    await loadSettings();
    await Promise.allSettled([loadProducts(), loadCategories(), loadPromotions(), loadRaffles(), loadEvents()]);
  })();
})();
