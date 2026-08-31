(function () {
  const config = window.FANTASMAS_SUPABASE;
  const configured = config && config.url && config.publishableKey && !config.url.includes("PON_AQUI") && !config.publishableKey.includes("PON_AQUI");
  if (!configured || !window.supabase) return;

  const client = window.supabase.createClient(config.url, config.publishableKey);
  let products = [];
  let automaticPromotions = [];
  let selectedCategory = "Todas";
  let visibleProductCount = 24;
  const PRODUCTS_PER_BATCH = 24;
  const PRODUCT_FETCH_SIZE = 500;
  let catalogSearchTimer = 0;
  let storeWhatsApp = "525610329215";
  let tickerTimer = null;
  let countdownTimer = null;
  const builderPreview = new URLSearchParams(window.location.search).has("preview");
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
  const safeHref = (value) => {
    const link = String(value || "").trim();
    return /^(?:#|https?:\/\/|mailto:|tel:|\/|\.\/|\.\.\/|[\w.-]+\.html(?:[?#].*)?$)/i.test(link) && !/^(?:javascript|data):/i.test(link) ? link : "";
  };
  const applyHref = (element, value) => {
    if (!element) return;
    const link = safeHref(value);
    if (!link) {
      element.removeAttribute("href");
      element.removeAttribute("target");
      element.removeAttribute("rel");
      return;
    }
    element.setAttribute("href", link);
    if (/^https?:\/\//i.test(link)) {
      element.setAttribute("target", "_blank");
      element.setAttribute("rel", "noopener noreferrer");
    } else {
      element.removeAttribute("target");
      element.removeAttribute("rel");
    }
  };
  const linkAttributes = (value) => {
    const link = safeHref(value);
    if (!link) return "";
    return ` href="${escapeHtml(link)}"${/^https?:\/\//i.test(link) ? ' target="_blank" rel="noopener noreferrer"' : ""}`;
  };
  const setHref = (selector, value) => applyHref(document.querySelector(selector), value);
  function activeNow(item, now = Date.now()) {
    if (!item || item.active === false) return false;
    const starts = item.starts_at ? Date.parse(item.starts_at) : null;
    const ends = item.ends_at ? Date.parse(item.ends_at) : null;
    if (item.starts_at && !Number.isFinite(starts)) return false;
    if (item.ends_at && !Number.isFinite(ends)) return false;
    return (starts === null || starts <= now) && (ends === null || ends >= now);
  }
  function promotionMatchesProduct(promo, product) {
    if (!activeNow(promo) || !Number(promo.discount_value)) return false;
    if (promo.scope === "products") return (promo.product_ids || []).includes(product.id);
    if (promo.scope === "categories") return (promo.category_names || []).includes(product.category);
    return true;
  }
  function productOffer(product) {
    const original = Number(product.price);
    let price = original;
    const applied = [];
    automaticPromotions.forEach((promo) => {
      if (!promotionMatchesProduct(promo, product)) return;
      if (Number(promo.minimum_purchase || 0) > original) return;
      const value = Number(promo.discount_value || 0);
      const candidate = promo.discount_type === "percentage" ? price * (1 - Math.min(100, value) / 100) : price - value;
      price = Math.max(0, candidate);
      applied.push(promo.title || "Promoción vigente");
    });
    price = Math.round(price * 100) / 100;
    const discountPercent = original > 0 && price < original ? Math.round(((original - price) / original) * 1000) / 10 : 0;
    return { original, price, applied, discountPercent };
  }

  function renderProducts() {
    const target = document.querySelector("#productosDinamicos");
    const section = document.querySelector("#productosPublicos");
    if (!target || !section) return;
    const search = (document.querySelector("#catalogSearch")?.value || "").trim().toLowerCase();
    const filtered = products.filter((product) => {
      const matchCategory = selectedCategory === "Todas" || product.category === selectedCategory;
      const matchSearch = !search || `${product.sku || ""} ${product.name || ""} ${product.category || ""} ${product.description || ""}`.toLowerCase().includes(search);
      return matchCategory && matchSearch;
    });
    const visible = filtered.slice(0, visibleProductCount);
    target.innerHTML = visible.length ? visible.map((product) => {
      const offer = productOffer(product);
      product.sale_price = offer.price;
      const hasStock = product.stock === null || product.stock === undefined || Number(product.stock) > 0;
      const canBuy = product.price !== null && product.price !== undefined && product.online_sale !== false && hasStock;
      const stockNote = product.stock === null || product.stock === undefined ? "" : Number(product.stock) > 0 ? `${product.stock} disponible${Number(product.stock) === 1 ? "" : "s"}` : "Agotado";
      return `
      <article class="producto-publico" data-product-id="${escapeHtml(product.id)}">
        <button class="producto-imagen" type="button" data-view-product-image="${escapeHtml(product.id)}" aria-label="Ver fotografía completa de ${escapeHtml(product.name)}" ${product.image_url ? "" : "disabled"}>
          ${product.image_url ? `<img src="${escapeHtml(product.image_url)}" alt="${escapeHtml(product.name)}" loading="lazy" decoding="async">` : "<span>☠</span>"}
          ${product.featured ? "<b>DESTACADO</b>" : ""}
        </button>
        <div class="producto-info">
          <small>${escapeHtml(product.category)}</small>
          <h3>${escapeHtml(product.name)}</h3>
          <p>${escapeHtml(product.description)}</p>
          <div class="producto-precio">${offer.price < offer.original ? `<del>${money(offer.original)}</del>` : product.previous_price ? `<del>${money(product.previous_price)}</del>` : ""}<strong>${money(offer.price)}</strong>${offer.applied.length ? `<span class="product-offer-badge">−${Number.isInteger(offer.discountPercent) ? offer.discountPercent.toFixed(0) : offer.discountPercent.toFixed(1)}% DTO</span>` : ""}</div>
          ${canBuy ? `<button class="product-add-cart" type="button" data-add-to-cart="${product.id}">Agregar al carrito</button>` : `<a href="https://wa.me/${storeWhatsApp}?text=${encodeURIComponent(`Hola, quiero información del producto: ${product.name}`)}" target="_blank">Consultar disponibilidad →</a>`}
          ${stockNote ? `<small class="product-stock-note">${escapeHtml(stockNote)}</small>` : ""}
        </div>
      </article>`;
    }).join("") : '<p class="catalog-empty">No encontramos productos con ese filtro.</p>';
    const controls = document.querySelector("#catalogLoadMore");
    if (controls) controls.innerHTML = filtered.length > visible.length
      ? `<span>Viendo ${visible.length} de ${filtered.length} productos</span><button type="button" id="loadMoreProducts">Mostrar ${Math.min(PRODUCTS_PER_BATCH, filtered.length - visible.length)} más</button>`
      : filtered.length ? `<span>Mostrando los ${filtered.length} productos encontrados</span>` : "";
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
    const target = document.querySelector("#productosDinamicos");
    if (target) target.innerHTML = '<p class="catalog-empty">Cargando catálogo…</p>';
    if (builderPreview) {
      const { data, error } = await client.from("shop_products").select("*").eq("active", true)
        .order("featured", { ascending: false }).order("sort_order").order("created_at", { ascending: false }).limit(PRODUCTS_PER_BATCH);
      if (error) {
        if (target) target.innerHTML = '<p class="catalog-empty">No se pudo cargar la muestra del catálogo.</p>';
        return;
      }
      products = data || [];
      window.FANTASMAS_PRODUCTS = products;
      renderProductFilters(); renderProducts();
      window.dispatchEvent(new CustomEvent("fantasmas:products-ready", { detail: products }));
      return;
    }
    const allRows = [];
    let offset = 0;
    let total = null;
    for (let request = 0; request < 500; request += 1) {
      const { data, error, count } = await client.from("shop_products")
        .select("*", { count: request === 0 ? "exact" : undefined })
        .eq("active", true).order("featured", { ascending: false }).order("sort_order").order("created_at", { ascending: false }).order("id")
        .range(offset, offset + PRODUCT_FETCH_SIZE - 1);
      if (error) {
        if (target) target.innerHTML = `<p class="catalog-empty">No se pudo cargar el catálogo. <button type="button" id="retryProducts">Reintentar</button></p>`;
        return;
      }
      if (request === 0 && Number.isFinite(count)) total = count;
      if (!data?.length) break;
      allRows.push(...data);
      offset += data.length;
      if (total !== null && offset >= total) break;
      if (total === null && data.length < PRODUCT_FETCH_SIZE) break;
    }
    products = allRows;
    window.FANTASMAS_PRODUCTS = products;
    renderProductFilters(); renderProducts();
    window.dispatchEvent(new CustomEvent("fantasmas:products-ready", { detail: products }));
  }

  function openProductImage(productId) {
    if (builderPreview) return;
    const product = products.find((item) => String(item.id) === String(productId));
    const dialog = document.querySelector("#productImageDialog");
    const image = document.querySelector("#productImageFull");
    const title = document.querySelector("#productImageTitle");
    if (!product?.image_url || !dialog || !image || !title) return;
    image.src = product.image_url;
    image.alt = product.name || "Producto";
    title.textContent = product.name || "Producto";
    if (!dialog.open) dialog.showModal();
  }

  function closeProductImage() {
    const dialog = document.querySelector("#productImageDialog");
    if (dialog?.open) dialog.close();
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
    if (error || !data) return;
    const currentPromotions = data.filter(activeNow);
    automaticPromotions = currentPromotions.filter((promo) => Number(promo.discount_value) > 0);
    window.FANTASMAS_AUTOMATIC_PROMOTIONS = automaticPromotions;
    if (products.length) { renderProducts(); window.dispatchEvent(new CustomEvent("fantasmas:products-ready", { detail: products })); }
    if (!currentPromotions.length) { target.innerHTML = ""; section.hidden = true; return; }
    target.innerHTML = currentPromotions.map((promo) => `
      <article class="promocion-publica ${promo.image_url ? "con-imagen" : ""}" ${promo.image_url ? `style="background-image:linear-gradient(90deg,#08090dec,#08090d99),url('${escapeHtml(promo.image_url)}')"` : ""}>
        <span>${escapeHtml(promo.badge)}</span><h3>${escapeHtml(promo.title)}</h3><p>${escapeHtml(promo.subtitle)}</p><a${linkAttributes(promo.button_url)}>${escapeHtml(promo.button_text)} →</a>
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
    target.innerHTML = data.map((raffle) => `<article class="rifa"><div class="rifa-cabecera">${raffle.image_url ? `<img src="${escapeHtml(raffle.image_url)}" alt="${escapeHtml(raffle.main_prize)}" loading="lazy">` : `<span class="icono">${escapeHtml(raffle.icon)}</span>`}<span class="cantidad">${raffle.total_numbers} NÚMEROS</span></div><div class="rifa-cuerpo"><div class="precio"><small>$</small>${Number(raffle.price).toLocaleString("es-MX")}<small> MXN</small></div><p class="mini">PREMIO PRINCIPAL</p><h3>${escapeHtml(raffle.main_prize)}</h3><p class="secundarios"><b>Premios secundarios:</b> ${escapeHtml(raffle.secondary_prizes)}</p><a href="rifa.html?id=${encodeURIComponent(raffle.id)}">${escapeHtml(raffle.sales_open === false ? "Ver rifa" : raffle.button_text || "Elegir números")} <b>→</b></a></div></article>`).join("");
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
      return `<article class="evento-publico"><div class="evento-imagen">${item.image_url ? `<img src="${escapeHtml(item.image_url)}" alt="${escapeHtml(item.title)}" loading="lazy">` : "<span>◷</span>"}<time><b>${date.toLocaleDateString("es-MX", { day: "2-digit" })}</b>${date.toLocaleDateString("es-MX", { month: "short" }).toUpperCase()}</time></div><div class="evento-info"><small>${date.toLocaleString("es-MX", { dateStyle: "long", timeStyle: "short" })}</small><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.description)}</p><span>⌖ ${escapeHtml(item.location)}</span><a${linkAttributes(item.button_url)}>${escapeHtml(item.button_text)} →</a></div></article>`;
    }).join("");
    if (canReveal(section)) section.hidden = false;
  }

  function applyContentSettings(value) {
    document.querySelectorAll("[data-setting-text]").forEach((element) => {
      const key = element.dataset.settingText;
      if (Object.prototype.hasOwnProperty.call(value, key)) element.textContent = value[key] || "";
    });
    document.querySelectorAll("[data-setting-href]").forEach((element) => {
      const key = element.dataset.settingHref;
      applyHref(element, value[key]);
    });
    document.querySelectorAll("[data-setting-placeholder]").forEach((element) => {
      const key = element.dataset.settingPlaceholder;
      if (Object.prototype.hasOwnProperty.call(value, key)) element.placeholder = value[key] || "";
    });
  }

  function renderTicker(value) {
    const ticker = document.querySelector("#anuncioAdministrable");
    const track = ticker?.querySelector(".ticker-track");
    if (!ticker || !track) return;
    clearInterval(tickerTimer);
    const phrases = String(value.ticker_phrases || value.announcement || "FANTASMAS BIKER'S SHOP").split(/\r?\n|\\n|\|/).map((text) => text.trim()).filter(Boolean);
    if (!phrases.length) phrases.push("FANTASMAS BIKER'S SHOP");
    const animation = value.ticker_animation || "scroll";
    const separator = value.ticker_separator || "✦";
    const speed = Math.max(5, Math.min(60, Number(value.ticker_speed) || 22));
    ticker.classList.remove("ticker-scroll","ticker-rotate","ticker-pulse","ticker-static","ticker-left","ticker-right","ticker-blue","ticker-pink","ticker-dark","ticker-gradient");
    ticker.classList.add(`ticker-${animation}`, `ticker-${value.ticker_direction || "left"}`, `ticker-${value.ticker_color || "blue"}`);
    ticker.style.setProperty("--ticker-duration", `${speed}s`);

    const fillTrack = (items, copies = 1) => {
      track.innerHTML = "";
      for (let copy = 0; copy < copies; copy += 1) {
        const group = document.createElement("span"); group.className = "ticker-group";
        items.forEach((phrase) => { const span = document.createElement("span"); span.className = "ticker-item"; span.textContent = phrase; group.append(span); const icon = document.createElement("i"); icon.textContent = separator; group.append(icon); });
        track.append(group);
      }
    };

    if (animation === "rotate") {
      let current = 0; fillTrack([phrases[current] || "FANTASMAS BIKER'S SHOP"]);
      if (!builderPreview) tickerTimer = setInterval(() => { current = (current + 1) % phrases.length; fillTrack([phrases[current]]); }, Math.max(2000, speed * 200));
    } else if (animation === "scroll") {
      fillTrack(phrases, 1);
      const groupWidth = Math.max(1, track.firstElementChild?.getBoundingClientRect().width || 1);
      const copies = Math.max(2, Math.ceil((ticker.clientWidth * 2) / groupWidth));
      fillTrack(phrases, copies);
      ticker.style.setProperty("--ticker-shift", `${-100 / copies}%`);
    } else {
      ticker.style.removeProperty("--ticker-shift");
      fillTrack(phrases, 1);
    }
  }

  function startCountdown(value) {
    const countdown = document.querySelector("#countdown");
    if (!countdown) return;
    clearInterval(countdownTimer);
    countdown.hidden = String(value.countdown_enabled ?? "true") === "false";
    let source = value.event_datetime || "2026-08-24T11:00:00-06:00";
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(source)) source += ":00-06:00";
    const target = new Date(source).getTime();
    const update = () => {
      const difference = Math.max(0, target - Date.now());
      const values = { countdownDays: Math.floor(difference / 86400000), countdownHours: Math.floor(difference / 3600000) % 24, countdownMinutes: Math.floor(difference / 60000) % 60, countdownSeconds: Math.floor(difference / 1000) % 60 };
      Object.entries(values).forEach(([id, number]) => { const element = document.getElementById(id); if (element) element.textContent = String(number).padStart(2, "0"); });
      if (difference === 0) clearInterval(countdownTimer);
    };
    update();
    if (!builderPreview) countdownTimer = setInterval(update, 1000);
  }

  function applyPublicSettings(value) {
    window.FANTASMAS_STORE_SETTINGS = value || {};
    if (value.whatsapp) storeWhatsApp = whatsappNumber(value.whatsapp);
    applyContentSettings(value);
    renderTicker(value);
    startCountdown(value);
    setText("#storeAddress", value.address); setText("#storeWhatsapp", displayPhone(value.whatsapp)); setText("#storeCatalogPhone", displayPhone(value.catalog_phone)); setText("#storeDesignPhone", displayPhone(value.design_phone)); setHref("#mapsLink", value.maps_url);
    document.querySelectorAll(".whatsapp-link").forEach((link) => applyHref(link, `https://wa.me/${storeWhatsApp}`));
    const social = [["#instagramLink", value.instagram_url, value.instagram_text], ["#tiktokLink", value.tiktok_url, value.tiktok_text], ["#youtubeLink", value.youtube_url, value.youtube_text]];
    social.forEach(([selector, url, text]) => { const link = document.querySelector(selector); if (!link) return; applyHref(link, url); if (text) link.querySelector("b").textContent = text; });
    setHref("#allLinks", value.links_url);
    if (builderPreview && products.length) renderProducts();
  }
  window.FANTASMAS_APPLY_PUBLIC_SETTINGS = applyPublicSettings;

  async function loadSettings() {
    const { data } = await client.from("shop_settings").select("setting_value").eq("setting_key", "store_info").maybeSingle();
    const value = data?.setting_value || {};
    applyPublicSettings(value);
    window.FANTASMAS_SETTINGS_LOADED = true;
    window.dispatchEvent(new CustomEvent("fantasmas:settings-ready"));
  }

  document.querySelector("#catalogSearch")?.addEventListener("input", () => {
    clearTimeout(catalogSearchTimer);
    catalogSearchTimer = setTimeout(() => { visibleProductCount = PRODUCTS_PER_BATCH; renderProducts(); }, 160);
  });
  document.querySelector("#categoryFilters")?.addEventListener("click", (event) => { const button = event.target.closest("[data-public-category]"); if (!button) return; selectedCategory = button.dataset.publicCategory; visibleProductCount = PRODUCTS_PER_BATCH; renderProductFilters(); renderProducts(); });
  document.querySelector("#catalogLoadMore")?.addEventListener("click", (event) => {
    if (!event.target.closest("#loadMoreProducts")) return;
    visibleProductCount += PRODUCTS_PER_BATCH;
    renderProducts();
  });
  document.querySelector("#productosDinamicos")?.addEventListener("click", (event) => {
    if (event.target.closest("#retryProducts")) {
      loadProducts();
      return;
    }
    const button = event.target.closest("[data-view-product-image]");
    if (button) openProductImage(button.dataset.viewProductImage);
  });
  document.querySelector("#productImageClose")?.addEventListener("click", closeProductImage);
  document.querySelector("#productImageDialog")?.addEventListener("click", (event) => {
    if (event.target === event.currentTarget) closeProductImage();
  });

  (async function initializePublicStore() {
    await loadSettings();
    await Promise.allSettled([loadProducts(), loadCategories(), loadPromotions(), loadRaffles(), loadEvents()]);
  })();
})();
