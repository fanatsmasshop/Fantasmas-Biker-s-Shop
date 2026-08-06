(function () {
  const config = window.FANTASMAS_SUPABASE || {};
  const configured = config.url && config.publishableKey && !config.url.includes("PON_AQUI") && !config.publishableKey.includes("PON_AQUI");
  if (!configured || !window.supabase) return;

  const client = window.supabase.createClient(config.url, config.publishableKey);
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const safe = (text) => String(text || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  let sections = [];
  let categories = [];
  let raffles = [];
  let events = [];
  let storeSettings = {};
  let selectedSectionKey = "";
  let initialized = false;
  let draggedKey = "";
  const fixedSections = new Set(["header", "footer"]);
  const specialSections = new Set(["header", "hero", "announcement", "footer"]);
  const sectionAnchors = {
    hero: "#inicio",
    announcement: "#anuncioAdministrable",
    promotions: "#promocionesPublicas",
    raffles: "#rifas",
    anniversary: "#aniversario",
    catalog_intro: "#tienda",
    products: "#productosPublicos",
    events: "#eventosPublicos",
    rewards: "#beneficios",
    allies: "#aliados",
    contact: "#contacto",
    footer: "#pie"
  };
  const defaultSectionLabels = {
    hero: "Portada / Inicio",
    announcement: "Franja de anuncios",
    promotions: "Promociones",
    raffles: "Rifas",
    anniversary: "Aniversario",
    catalog_intro: "Presentación de la tienda",
    products: "Productos",
    events: "Mini eventos",
    rewards: "Fantasmas Rewards",
    allies: "Aliados Fantasma",
    contact: "Contacto",
    footer: "Pie de página"
  };
  const sectionFields = {
    header: [
      ["nav_raffles_text","Texto: Rifas"],["nav_raffles_url","Enlace: Rifas","url"],
      ["nav_store_text","Texto: Tienda"],["nav_store_url","Enlace: Tienda","url"],
      ["nav_rewards_text","Texto: Beneficios"],["nav_rewards_url","Enlace: Beneficios","url"],
      ["nav_allies_text","Texto: Aliados"],["nav_allies_url","Enlace: Aliados","url"],
      ["nav_contact_text","Texto: Contacto"],["nav_contact_url","Enlace: Contacto","url"],
      ["header_cta_text","Texto del botón"],["header_cta_url","Enlace del botón","url"]
    ],
    promotions: [["promotions_eyebrow","Etiqueta superior"]],
    raffles: [
      ["raffles_eyebrow","Etiqueta superior"],["raffles_steps_title","Título de instrucciones"],
      ["raffles_step_1","Paso 1"],["raffles_step_2","Paso 2"],["raffles_step_3","Paso 3"],["raffles_step_4","Paso 4"],
      ["raffles_note","Nota inferior","textarea"]
    ],
    anniversary: [
      ["anniversary_day","Día"],["anniversary_date_label","Mes y año"],["anniversary_eyebrow","Etiqueta superior"],
      ["anniversary_cta_text","Texto del botón"],["anniversary_cta_url","Enlace del botón","url"]
    ],
    catalog_intro: [["catalog_eyebrow","Etiqueta superior"]],
    products: [["products_eyebrow","Etiqueta superior"],["products_search_placeholder","Texto del buscador"]],
    events: [["events_eyebrow","Etiqueta superior"]],
    rewards: [
      ["rewards_eyebrow","Etiqueta superior"],["rewards_count","Cantidad de sellos"],["rewards_title","Premio de sellos"],
      ["rewards_text","Descripción del premio","textarea"],["delivery_title","Título de entregas"],["delivery_text","Información de entregas","textarea"]
    ],
    allies: [["allies_eyebrow","Etiqueta superior"],["allies_notice","Aviso inferior"]],
    contact: [
      ["contact_eyebrow","Etiqueta superior"],["address","Dirección","textarea"],
      ["whatsapp","WhatsApp principal","tel"],["catalog_phone","Teléfono de catálogo","tel"],["design_phone","Diseño e impresión","tel"],
      ["contact_map_text","Texto del botón de mapa"],["maps_url","Enlace de Google Maps","url"],
      ["contact_whatsapp_text","Texto del botón de WhatsApp"],
      ["instagram_text","Usuario de Instagram"],["instagram_url","Enlace de Instagram","url"],
      ["tiktok_text","Usuario de TikTok"],["tiktok_url","Enlace de TikTok","url"],
      ["youtube_text","Canal de YouTube"],["youtube_url","Enlace de YouTube","url"],
      ["links_url","Enlace general / Linktree","url"]
    ],
    footer: [["footer_tagline","Frase del pie"],["footer_copyright","Texto legal"]]
  };

  function notify(message, error = false) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.className = `toast show${error ? " error" : ""}`;
    clearTimeout(notify.timer);
    notify.timer = setTimeout(() => toast.className = "toast", 3200);
  }

  function localDate(value) {
    if (!value) return "";
    const date = new Date(value);
    const adjusted = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return adjusted.toISOString().slice(0, 16);
  }

  function linkMode(value) {
    const link = String(value || "").trim();
    if (!link) return "none";
    if (link.startsWith("#")) return "section";
    if (/^https?:\/\/(?:www\.)?(?:wa\.me|api\.whatsapp\.com)\b/i.test(link)) return "whatsapp";
    if (/^tel:/i.test(link)) return "phone";
    if (/^mailto:/i.test(link)) return "email";
    if (/^https?:\/\//i.test(link)) return "external";
    return "custom";
  }

  function linkEditorValue(mode, value) {
    const link = String(value || "").trim();
    if (mode === "whatsapp") {
      const match = link.match(/(?:wa\.me\/|phone=)(\d+)/i);
      return match?.[1]?.replace(/^52(?=\d{10}$)/, "") || link.replace(/\D/g, "").replace(/^52(?=\d{10}$)/, "");
    }
    if (mode === "phone") return link.replace(/^tel:/i, "");
    if (mode === "email") return link.replace(/^mailto:/i, "");
    return link;
  }

  function buildLink(mode, rawValue) {
    const raw = String(rawValue || "").trim();
    if (mode === "none") return { value: "", valid: true };
    if (mode === "section") return { value: raw, valid: /^#[A-Za-z][\w:.-]*$/.test(raw) };
    if (mode === "external") {
      if (!raw) return { value: "", valid: false };
      const value = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
      return { value, valid: /^https?:\/\/[^\s]+$/i.test(value) };
    }
    if (mode === "whatsapp") {
      let number = raw.replace(/\D/g, "");
      if (number.length === 10) number = `52${number}`;
      return { value: number ? `https://wa.me/${number}` : "", valid: number.length >= 10 };
    }
    if (mode === "phone") {
      const number = raw.replace(/[^\d+]/g, "");
      return { value: number ? `tel:${number}` : "", valid: number.replace(/\D/g, "").length >= 10 };
    }
    if (mode === "email") {
      const email = raw.replace(/^mailto:/i, "");
      return { value: email ? `mailto:${email}` : "", valid: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) };
    }
    const safeCustom = /^(?:#|https?:\/\/|mailto:|tel:|\/|\.\/|\.\.\/|[\w.-]+\.html(?:[?#].*)?$)/i.test(raw) && !/^(?:javascript|data):/i.test(raw);
    return { value: safeCustom ? raw : "", valid: safeCustom };
  }

  function linkSectionOptions(currentValue = "") {
    const options = sections.length
      ? sections.filter((section) => sectionAnchors[section.section_key]).map((section) => ({
          value: sectionAnchors[section.section_key],
          label: `${section.label}${section.enabled ? "" : " · oculta"}`
        }))
      : Object.entries(sectionAnchors).map(([key, value]) => ({ value, label: defaultSectionLabels[key] || key }));
    if (currentValue.startsWith("#") && !options.some((option) => option.value === currentValue)) {
      options.push({ value: currentValue, label: `Sección personalizada (${currentValue})` });
    }
    return options;
  }

  function refreshLinkWidget(source) {
    const widget = source._linkWidget;
    if (!widget) return;
    const mode = linkMode(source.value);
    const options = linkSectionOptions(source.value);
    widget.mode.value = mode;
    widget.section.innerHTML = options.map((option) => `<option value="${safe(option.value)}">${safe(option.label)}</option>`).join("");
    widget.section.value = mode === "section" ? source.value : (options[0]?.value || "#inicio");
    widget.value.value = linkEditorValue(mode, source.value);
    updateLinkWidgetVisibility(source);
    updateLinkSummary(source, true);
  }

  function updateLinkWidgetVisibility(source) {
    const widget = source._linkWidget;
    if (!widget) return;
    const mode = widget.mode.value;
    widget.sectionRow.hidden = mode !== "section";
    widget.valueRow.hidden = !["external", "whatsapp", "phone", "email", "custom"].includes(mode);
    const labels = {
      external: ["Dirección externa", "https://sitio.com o sitio.com"],
      whatsapp: ["Número de WhatsApp", "Ej. 5610329215"],
      phone: ["Número telefónico", "Ej. 5610329215"],
      email: ["Correo electrónico", "Ej. contacto@tienda.com"],
      custom: ["Ruta manual", "Ej. /pagina o archivo.html"]
    };
    const [label, placeholder] = labels[mode] || ["Destino", ""];
    widget.valueLabel.textContent = label;
    widget.value.placeholder = placeholder;
  }

  function updateLinkSummary(source, preserveValue = false) {
    const widget = source._linkWidget;
    if (!widget) return;
    const mode = widget.mode.value;
    const rawValue = mode === "section" ? widget.section.value : widget.value.value;
    const result = preserveValue ? { value: source.value, valid: true } : buildLink(mode, rawValue);
    if (!preserveValue) source.value = result.value;
    widget.summary.textContent = result.valid
      ? (result.value ? `Destino guardado: ${result.value}` : "El botón quedará sin enlace.")
      : "Completa un destino válido.";
    widget.summary.classList.toggle("invalid", !result.valid);
    if (!preserveValue) source.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function enhanceLinkInputs(root) {
    if (!root) return;
    $$('input[name$="_url"]', root).forEach((source) => {
      if (source._linkWidget) return refreshLinkWidget(source);
      source.type = "hidden";
      source.dataset.linkSource = "true";
      const widgetElement = document.createElement("div");
      widgetElement.className = "link-builder";
      widgetElement.innerHTML = `
        <div class="link-control"><span>Tipo de destino</span>
          <select data-link-mode aria-label="Tipo de destino">
            <option value="section">Sección de esta página</option>
            <option value="external">Enlace externo</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="phone">Llamada telefónica</option>
            <option value="email">Correo electrónico</option>
            <option value="none">Sin enlace</option>
            <option value="custom">Ruta manual avanzada</option>
          </select>
        </div>
        <div class="link-control" data-link-section-row><span>Sección de destino</span><select data-link-section aria-label="Sección de destino"></select></div>
        <div class="link-control" data-link-value-row><span data-link-value-label>Dirección externa</span><input type="text" data-link-value autocomplete="off" aria-label="Dirección del enlace"></div>
        <small class="link-summary" data-link-summary></small>`;
      source.insertAdjacentElement("afterend", widgetElement);
      source._linkWidget = {
        element: widgetElement,
        mode: $("[data-link-mode]", widgetElement),
        section: $("[data-link-section]", widgetElement),
        sectionRow: $("[data-link-section-row]", widgetElement),
        value: $("[data-link-value]", widgetElement),
        valueRow: $("[data-link-value-row]", widgetElement),
        valueLabel: $("[data-link-value-label]", widgetElement),
        summary: $("[data-link-summary]", widgetElement)
      };
      const widget = source._linkWidget;
      widget.mode.addEventListener("change", () => {
        if (widget.mode.value === "section" && !widget.section.value) widget.section.value = linkSectionOptions()[0]?.value || "#inicio";
        widget.value.value = "";
        updateLinkWidgetVisibility(source);
        updateLinkSummary(source);
      });
      widget.section.addEventListener("change", () => updateLinkSummary(source));
      widget.value.addEventListener("input", () => updateLinkSummary(source));
      refreshLinkWidget(source);
    });
  }

  async function loadEditorData() {
    const { data: sessionData } = await client.auth.getSession();
    if (!sessionData.session) return;
    const results = await Promise.all([
      client.from("shop_sections").select("*").order("sort_order"),
      client.from("shop_categories").select("*").order("sort_order").order("name"),
      client.from("shop_raffles").select("*").order("sort_order").order("price"),
      client.from("shop_events").select("*").order("event_date", { ascending: true }),
      client.from("shop_settings").select("setting_value").eq("setting_key", "store_info").maybeSingle()
    ]);
    const missing = results.find((result) => result.error);
    if (missing) {
      $("#sectionEditor").innerHTML = '<div class="empty">Ejecuta <b>database_editor.sql</b> en Supabase para activar el constructor visual.</div>';
      $("#sectionEditorStatus").textContent = "Falta instalar la base del editor";
      return;
    }
    sections = results[0].data || [];
    categories = results[1].data || [];
    raffles = results[2].data || [];
    events = results[3].data || [];
    storeSettings = results[4].data?.setting_value || {};
    renderSections();
    renderCategories();
    renderRaffles();
    renderEvents();
    fillCategoryOptions();
    if (!selectedSectionKey && sections.length) selectSection(sections[0].section_key);
    applyPreviewSections();
    $("#sectionEditorStatus").textContent = "Editor listo";
    initialized = true;
  }

  function renderSections() {
    const container = $("#sectionEditor");
    if (!sections.length) {
      container.innerHTML = '<div class="empty">No hay secciones configuradas.</div>';
      return;
    }
    container.innerHTML = sections.map((section) => `
      <article class="section-row${section.section_key === selectedSectionKey ? " selected" : ""}" data-section-key="${safe(section.section_key)}" draggable="${fixedSections.has(section.section_key) ? "false" : "true"}">
        <span class="drag-handle" title="${fixedSections.has(section.section_key) ? "Posición fija" : "Arrastrar"}">${fixedSections.has(section.section_key) ? "🔒" : "⠿"}</span>
        <div class="section-identity"><b>${safe(section.label)}</b><small>${safe(section.enabled ? section.layout : "OCULTA")}</small></div>
        <button class="section-visible${section.enabled ? "" : " off"}" type="button" data-toggle-section="${safe(section.section_key)}" title="${section.enabled ? "Ocultar" : "Mostrar"}">${section.enabled ? "●" : "○"}</button>
      </article>`).join("");
    bindSectionDrag();
  }

  function selectSection(key, scrollPreview = true) {
    const section = sections.find((item) => item.section_key === key);
    if (!section) return;
    selectedSectionKey = key;
    $$(".section-row", $("#sectionEditor")).forEach((row) => row.classList.toggle("selected", row.dataset.sectionKey === key));
    $("#inspectorEmpty").hidden = true;
    const form = $("#sectionInspectorForm");
    form.hidden = false;
    form.elements.section_key.value = section.section_key;
    form.elements.title.value = section.title || "";
    form.elements.subtitle.value = section.subtitle || "";
    form.elements.layout.value = section.layout || "grid";
    form.elements.enabled.checked = section.enabled;
    $("#genericSectionControls").hidden = specialSections.has(key);
    $("#heroSectionControls").hidden = key !== "hero";
    $("#tickerSectionControls").hidden = key !== "announcement";
    renderExtraControls(key);
    if (key === "hero") {
      ["hero_eyebrow","hero_title","hero_highlight","hero_intro","main_cta_text","main_cta_url","catalog_cta_text","catalog_cta_url"].forEach((name) => form.elements[name].value = storeSettings[name] || "");
      form.elements.event_datetime.value = localDate(storeSettings.event_datetime);
      form.elements.countdown_enabled.checked = String(storeSettings.countdown_enabled ?? "true") !== "false";
    }
    if (key === "announcement") {
      ["ticker_phrases","ticker_animation","ticker_direction","ticker_color","ticker_separator"].forEach((name) => form.elements[name].value = storeSettings[name] || form.elements[name].value);
      form.elements.ticker_speed.value = storeSettings.ticker_speed || 22;
      $("#tickerSpeedValue").textContent = `${form.elements.ticker_speed.value} segundos`;
    }
    enhanceLinkInputs(form);
    $("#inspectorSectionName").textContent = section.label;
    $("#sectionInspector").classList.add("open");
    markPreviewSelection(scrollPreview);
  }

  function renderExtraControls(key) {
    const target = $("#extraSectionControls");
    const fields = sectionFields[key] || [];
    target.hidden = fields.length === 0;
    target.innerHTML = fields.length ? `<p class="control-heading">Más contenido editable</p>${fields.map(([name, label, type = "text"]) => {
      const value = safe(storeSettings[name] || "");
      if (type === "textarea") return `<label>${safe(label)}<textarea name="${safe(name)}" data-setting-key="${safe(name)}" rows="4" maxlength="800">${value}</textarea></label>`;
      return `<label>${safe(label)}<input name="${safe(name)}" data-setting-key="${safe(name)}" type="${type}" value="${value}" maxlength="400"></label>`;
    }).join("")}` : "";
  }

  function updateSectionFromInspector() {
    const form = $("#sectionInspectorForm");
    const section = sections.find((item) => item.section_key === form.elements.section_key.value);
    if (!section) return;
    if (!specialSections.has(section.section_key)) {
      section.title = form.elements.title.value;
      section.subtitle = form.elements.subtitle.value;
      section.layout = form.elements.layout.value;
    }
    section.enabled = form.elements.enabled.checked;
    if (section.section_key === "hero") {
      ["hero_eyebrow","hero_title","hero_highlight","hero_intro","main_cta_text","main_cta_url","catalog_cta_text","catalog_cta_url"].forEach((name) => storeSettings[name] = form.elements[name].value);
      storeSettings.event_datetime = form.elements.event_datetime.value;
      storeSettings.countdown_enabled = String(form.elements.countdown_enabled.checked);
    }
    if (section.section_key === "announcement") {
      ["ticker_phrases","ticker_animation","ticker_speed","ticker_direction","ticker_color","ticker_separator"].forEach((name) => storeSettings[name] = form.elements[name].value);
      $("#tickerSpeedValue").textContent = `${form.elements.ticker_speed.value} segundos`;
    }
    $$('[data-setting-key]', form).forEach((input) => storeSettings[input.dataset.settingKey] = input.value);
    renderSections();
    applyPreviewSections();
    $("#sectionEditorStatus").textContent = "Cambios sin publicar";
  }

  function bindSectionDrag() {
    $$(".section-row", $("#sectionEditor")).forEach((row) => {
      row.addEventListener("dragstart", (event) => { if (fixedSections.has(row.dataset.sectionKey)) { event.preventDefault(); return; } draggedKey = row.dataset.sectionKey; row.classList.add("dragging"); });
      row.addEventListener("dragend", () => { draggedKey = ""; row.classList.remove("dragging"); $$(".section-row").forEach((item) => item.classList.remove("drop-target")); });
      row.addEventListener("dragover", (event) => { if (fixedSections.has(row.dataset.sectionKey)) return; event.preventDefault(); if (draggedKey !== row.dataset.sectionKey) row.classList.add("drop-target"); });
      row.addEventListener("dragleave", () => row.classList.remove("drop-target"));
      row.addEventListener("drop", (event) => {
        event.preventDefault();
        if (fixedSections.has(row.dataset.sectionKey)) return;
        const from = sections.findIndex((item) => item.section_key === draggedKey);
        const originalTarget = sections.findIndex((item) => item.section_key === row.dataset.sectionKey);
        if (from < 0 || originalTarget < 0 || from === originalTarget) return;
        const [moved] = sections.splice(from, 1);
        const target = sections.findIndex((item) => item.section_key === row.dataset.sectionKey);
        const after = event.clientY > row.getBoundingClientRect().top + row.getBoundingClientRect().height / 2;
        sections.splice(target + (after ? 1 : 0), 0, moved);
        renderSections(); applyPreviewSections();
        $("#sectionEditorStatus").textContent = "Nuevo orden sin publicar";
      });
    });
  }

  function previewDocument() {
    try { return $("#sitePreview").contentDocument; } catch (_) { return null; }
  }

  function preparePreview() {
    const doc = previewDocument();
    if (!doc) return;
    const previewWindow = $("#sitePreview").contentWindow;
    if (!previewWindow.FANTASMAS_SETTINGS_LOADED) previewWindow.addEventListener("fantasmas:settings-ready", () => applyPreviewSections(), { once: true });
    if (previewWindow.FANTASMAS_SECTIONS_READY?.then) previewWindow.FANTASMAS_SECTIONS_READY.then(() => applyPreviewSections());
    if (!doc.querySelector("#fantasmasBuilderStyle")) {
      const style = doc.createElement("style");
      style.id = "fantasmasBuilderStyle";
      style.textContent = '[data-section-key]{cursor:pointer;transition:outline .15s}[data-section-key].builder-selected{outline:4px solid #28a8ff!important;outline-offset:-4px;position:relative}';
      doc.head.append(style);
    }
    doc.querySelectorAll("[data-section-key]").forEach((element) => {
      element.addEventListener("click", (event) => {
        event.preventDefault(); event.stopPropagation();
        selectSection(element.dataset.sectionKey, false);
      });
    });
    applyPreviewSections();
  }

  function applyPreviewSections() {
    const doc = previewDocument();
    if (!doc) return;
    sections.forEach((settings, index) => {
      const section = doc.querySelector(`[data-section-key="${settings.section_key}"]`);
      if (!section) return;
      section.style.order = String((index + 1) * 10);
      section.hidden = !settings.enabled;
      section.classList.remove("layout-grid", "layout-featured", "layout-compact", "layout-carousel");
      section.classList.add(`layout-${settings.layout}`);
      const title = section.querySelector("[data-section-title]");
      const subtitle = section.querySelector("[data-section-subtitle]");
      if (title) title.textContent = settings.title || "";
      if (subtitle) subtitle.textContent = settings.subtitle || "";
    });
    applyPreviewSettings(doc);
    markPreviewSelection(false);
  }

  function applyPreviewSettings(doc) {
    if (!doc) return;
    const previewWindow = $("#sitePreview").contentWindow;
    if (typeof previewWindow?.FANTASMAS_APPLY_PUBLIC_SETTINGS === "function") {
      previewWindow.FANTASMAS_APPLY_PUBLIC_SETTINGS(storeSettings);
      return;
    }
    doc.querySelectorAll("[data-setting-text]").forEach((element) => {
      const key = element.dataset.settingText;
      if (Object.prototype.hasOwnProperty.call(storeSettings, key)) element.textContent = storeSettings[key] || "";
    });
    doc.querySelectorAll("[data-setting-href]").forEach((element) => {
      const key = element.dataset.settingHref;
      const link = String(storeSettings[key] || "").trim();
      if (link) {
        element.href = link;
        if (/^https?:\/\//i.test(link)) {
          element.target = "_blank";
          element.rel = "noopener noreferrer";
        } else {
          element.removeAttribute("target");
          element.removeAttribute("rel");
        }
      } else {
        element.removeAttribute("href");
        element.removeAttribute("target");
        element.removeAttribute("rel");
      }
    });
    doc.querySelectorAll("[data-setting-placeholder]").forEach((element) => {
      const key = element.dataset.settingPlaceholder;
      if (Object.prototype.hasOwnProperty.call(storeSettings, key)) element.placeholder = storeSettings[key] || "";
    });
    const phoneValues = [["#storeWhatsapp","whatsapp"],["#storeCatalogPhone","catalog_phone"],["#storeDesignPhone","design_phone"]];
    phoneValues.forEach(([selector, key]) => { const element = doc.querySelector(selector); if (element && storeSettings[key]) element.textContent = storeSettings[key]; });
    renderTickerPreview(doc);
    updateCountdownPreview(doc);
  }

  function renderTickerPreview(doc) {
    const ticker = doc.querySelector("#anuncioAdministrable");
    const track = ticker?.querySelector(".ticker-track");
    if (!ticker || !track) return;
    const phrases = String(storeSettings.ticker_phrases || storeSettings.announcement || "FANTASMAS BIKER'S SHOP").split(/\r?\n|\\n|\|/).map((text) => text.trim()).filter(Boolean);
    if (!phrases.length) phrases.push("FANTASMAS BIKER'S SHOP");
    const animation = storeSettings.ticker_animation || "scroll";
    const separator = storeSettings.ticker_separator || "✦";
    ticker.classList.remove("ticker-scroll","ticker-rotate","ticker-pulse","ticker-static","ticker-left","ticker-right","ticker-blue","ticker-pink","ticker-dark","ticker-gradient");
    ticker.classList.add(`ticker-${animation}`, `ticker-${storeSettings.ticker_direction || "left"}`, `ticker-${storeSettings.ticker_color || "blue"}`);
    ticker.style.setProperty("--ticker-duration", `${storeSettings.ticker_speed || 22}s`);
    const fillTrack = (copies) => {
      track.innerHTML = "";
      for (let copy = 0; copy < copies; copy += 1) {
        const group = doc.createElement("span"); group.className = "ticker-group";
        phrases.forEach((phrase) => { const span = doc.createElement("span"); span.className = "ticker-item"; span.textContent = phrase; group.append(span); const icon = doc.createElement("i"); icon.textContent = separator; group.append(icon); });
        track.append(group);
      }
    };
    if (animation === "scroll") {
      fillTrack(1);
      const groupWidth = Math.max(1, track.firstElementChild?.getBoundingClientRect().width || 1);
      const copies = Math.max(2, Math.ceil((ticker.clientWidth * 2) / groupWidth));
      fillTrack(copies);
      ticker.style.setProperty("--ticker-shift", `${-100 / copies}%`);
    } else {
      ticker.style.removeProperty("--ticker-shift");
      fillTrack(1);
    }
  }

  function updateCountdownPreview(doc) {
    const countdown = doc.querySelector("#countdown");
    if (!countdown) return;
    countdown.hidden = String(storeSettings.countdown_enabled ?? "true") === "false";
    let source = storeSettings.event_datetime || "2026-08-24T11:00:00-06:00";
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(source)) source += ":00-06:00";
    const difference = Math.max(0, new Date(source).getTime() - Date.now());
    const values = { countdownDays: Math.floor(difference / 86400000), countdownHours: Math.floor(difference / 3600000) % 24, countdownMinutes: Math.floor(difference / 60000) % 60, countdownSeconds: Math.floor(difference / 1000) % 60 };
    Object.entries(values).forEach(([id, value]) => { const element = doc.getElementById(id); if (element) element.textContent = String(value).padStart(2, "0"); });
  }

  function markPreviewSelection(scroll = false) {
    const doc = previewDocument();
    if (!doc) return;
    doc.querySelectorAll(".builder-selected").forEach((element) => element.classList.remove("builder-selected"));
    const selected = doc.querySelector(`[data-section-key="${selectedSectionKey}"]`);
    if (selected) {
      selected.classList.add("builder-selected");
      if (scroll) selected.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  async function saveSections() {
    const payload = sections.map((section, index) => ({
      section_key: section.section_key,
      label: section.label,
      title: section.title || "",
      subtitle: section.subtitle || "",
      layout: section.layout || "grid",
      enabled: Boolean(section.enabled),
      sort_order: (index + 1) * 10,
      updated_at: new Date().toISOString()
    }));
    $("#sectionEditorStatus").textContent = "Publicando…";
    const [sectionResult, settingsResult] = await Promise.all([
      client.from("shop_sections").upsert(payload),
      client.from("shop_settings").upsert({ setting_key: "store_info", setting_value: storeSettings, updated_at: new Date().toISOString() })
    ]);
    const error = sectionResult.error || settingsResult.error;
    if (error) { $("#sectionEditorStatus").textContent = error.message; return notify(error.message, true); }
    sections = payload;
    $("#sectionEditorStatus").textContent = "Cambios publicados";
    notify("La página pública fue actualizada.");
  }

  function fillCategoryOptions() {
    $("#categoryOptions").innerHTML = categories.filter((category) => category.active).map((category) => `<option value="${safe(category.name)}"></option>`).join("");
  }

  function renderCategories() {
    $("#categoriesList").innerHTML = categories.length ? categories.map((category) => `
      <article class="list-card">
        <div class="list-image">${safe(category.icon || "☷")}</div>
        <div class="list-main"><h3>${safe(category.name)}</h3><p>${safe(category.description)} · Orden ${category.sort_order}</p><div class="badges"><span class="badge ${category.active ? "active" : "inactive"}">${category.active ? "VISIBLE" : "OCULTA"}</span></div></div>
        <div class="list-actions"><button data-edit-category="${category.id}">Editar</button><button data-toggle-category="${category.id}">${category.active ? "Ocultar" : "Mostrar"}</button><button class="delete" data-delete-category="${category.id}">Eliminar</button></div>
      </article>`).join("") : '<div class="empty">No hay categorías.</div>';
  }

  async function saveCategory(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = { name: form.elements.name.value.trim(), icon: form.elements.icon.value.trim() || "☠", description: form.elements.description.value.trim(), sort_order: Number(form.elements.sort_order.value || 0), active: form.elements.active.checked, updated_at: new Date().toISOString() };
    const id = form.elements.id.value;
    const query = id ? client.from("shop_categories").update(payload).eq("id", id) : client.from("shop_categories").insert(payload);
    const { error } = await query;
    if (error) return notify(error.message, true);
    resetCategoryForm();
    const { data } = await client.from("shop_categories").select("*").order("sort_order").order("name");
    categories = data || []; renderCategories(); fillCategoryOptions(); notify("Categoría guardada.");
  }

  function resetCategoryForm() {
    const form = $("#categoryForm"); form.reset(); form.elements.id.value = ""; form.elements.icon.value = "☠"; form.elements.sort_order.value = 0; form.elements.active.checked = true;
  }

  function renderRaffles() {
    $("#rafflesList").innerHTML = raffles.length ? raffles.map((item) => `
      <article class="list-card">
        <div class="list-image">${item.image_url ? `<img src="${safe(item.image_url)}" alt="">` : safe(item.icon || "🎁")}</div>
        <div class="list-main"><h3>$${Number(item.price).toLocaleString("es-MX")} · ${safe(item.main_prize)}</h3><p>${item.total_numbers} números · ${safe(item.secondary_prizes)} · Orden ${item.sort_order}</p><div class="badges"><span class="badge ${item.active ? "active" : "inactive"}">${item.active ? "VISIBLE" : "OCULTA"}</span></div></div>
        <div class="list-actions"><button data-edit-raffle="${item.id}">Editar</button><button data-toggle-raffle="${item.id}">${item.active ? "Ocultar" : "Mostrar"}</button><button class="delete" data-delete-raffle="${item.id}">Eliminar</button></div>
      </article>`).join("") : '<div class="empty">No hay rifas publicadas.</div>';
  }

  function openRaffle(item = null) {
    const form = $("#raffleForm"); form.reset(); form.elements.active.checked = true; form.elements.icon.value = "🎁"; form.elements.total_numbers.value = 20; form.elements.sort_order.value = 0; form.elements.button_text.value = "Apartar número";
    $("#raffleDialogTitle").textContent = item ? "Editar rifa" : "Nueva rifa";
    if (item) { ["id","price","total_numbers","icon","main_prize","secondary_prizes","button_text","sort_order"].forEach((key) => form.elements[key].value = item[key] ?? ""); form.elements.current_image_url.value = item.image_url || ""; form.elements.current_image_path.value = item.image_path || ""; form.elements.active.checked = item.active; }
    $("#raffleStatus").textContent = ""; $("#raffleDialog").showModal();
  }

  async function saveRaffle(event) {
    event.preventDefault();
    const form = event.currentTarget; const status = $("#raffleStatus"); status.textContent = "Guardando…";
    try {
      const uploaded = await uploadImage(form.elements.image.files[0], "raffles");
      const payload = { price: Number(form.elements.price.value), total_numbers: Number(form.elements.total_numbers.value), icon: form.elements.icon.value.trim() || "🎁", main_prize: form.elements.main_prize.value.trim(), secondary_prizes: form.elements.secondary_prizes.value.trim(), button_text: form.elements.button_text.value.trim() || "Apartar número", sort_order: Number(form.elements.sort_order.value || 0), active: form.elements.active.checked, image_url: uploaded?.url || form.elements.current_image_url.value || null, image_path: uploaded?.path || form.elements.current_image_path.value || null, updated_at: new Date().toISOString() };
      const id = form.elements.id.value;
      const query = id ? client.from("shop_raffles").update(payload).eq("id", id) : client.from("shop_raffles").insert(payload);
      const { error } = await query; if (error) throw error;
      if (uploaded && form.elements.current_image_path.value) await client.storage.from("shop-media").remove([form.elements.current_image_path.value]);
      $("#raffleDialog").close(); const { data } = await client.from("shop_raffles").select("*").order("sort_order").order("price"); raffles = data || []; renderRaffles(); notify("Rifa guardada.");
    } catch (error) { status.textContent = error.message; }
  }

  function renderEvents() {
    $("#eventsList").innerHTML = events.length ? events.map((item) => `
      <article class="list-card">
        <div class="list-image">${item.image_url ? `<img src="${safe(item.image_url)}" alt="">` : "◷"}</div>
        <div class="list-main"><h3>${safe(item.title)}</h3><p class="event-date">${new Date(item.event_date).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })}</p><p>${safe(item.location)}</p><div class="badges"><span class="badge ${item.active ? "active" : "inactive"}">${item.active ? "VISIBLE" : "OCULTO"}</span></div></div>
        <div class="list-actions"><button data-edit-event="${item.id}">Editar</button><button data-toggle-event="${item.id}">${item.active ? "Ocultar" : "Mostrar"}</button><button class="delete" data-delete-event="${item.id}">Eliminar</button></div>
      </article>`).join("") : '<div class="empty">No hay mini eventos publicados.</div>';
  }

  function openEvent(item = null) {
    const form = $("#eventForm"); form.reset(); form.elements.active.checked = true; form.elements.sort_order.value = 0; form.elements.location.value = "Fantasmas Biker's Shop"; form.elements.button_text.value = "Más información"; form.elements.button_url.value = "https://wa.me/525610329215";
    $("#eventDialogTitle").textContent = item ? "Editar evento" : "Nuevo evento";
    if (item) { ["id","title","description","location","button_text","button_url","sort_order"].forEach((key) => form.elements[key].value = item[key] ?? ""); form.elements.event_date.value = localDate(item.event_date); form.elements.end_date.value = localDate(item.end_date); form.elements.active.checked = item.active; form.elements.current_image_url.value = item.image_url || ""; form.elements.current_image_path.value = item.image_path || ""; }
    enhanceLinkInputs(form);
    $("#eventStatus").textContent = ""; $("#eventDialog").showModal();
  }

  async function uploadImage(file, folder = "events") {
    if (!file || !file.size) return null;
    if (file.size > 5 * 1024 * 1024) throw new Error("La imagen supera 5 MB.");
    const extension = file.name.split(".").pop().toLowerCase();
    const path = `${folder}/${crypto.randomUUID()}.${extension}`;
    const { error } = await client.storage.from("shop-media").upload(path, file, { cacheControl: "3600" });
    if (error) throw error;
    return { path, url: client.storage.from("shop-media").getPublicUrl(path).data.publicUrl };
  }

  async function saveEvent(event) {
    event.preventDefault();
    const form = event.currentTarget; const status = $("#eventStatus"); status.textContent = "Guardando…";
    try {
      const uploaded = await uploadImage(form.elements.image.files[0], "events");
      const payload = { title: form.elements.title.value.trim(), description: form.elements.description.value.trim(), event_date: new Date(form.elements.event_date.value).toISOString(), end_date: form.elements.end_date.value ? new Date(form.elements.end_date.value).toISOString() : null, location: form.elements.location.value.trim(), button_text: form.elements.button_text.value.trim(), button_url: form.elements.button_url.value.trim(), sort_order: Number(form.elements.sort_order.value || 0), active: form.elements.active.checked, image_url: uploaded?.url || form.elements.current_image_url.value || null, image_path: uploaded?.path || form.elements.current_image_path.value || null, updated_at: new Date().toISOString() };
      const id = form.elements.id.value;
      const query = id ? client.from("shop_events").update(payload).eq("id", id) : client.from("shop_events").insert(payload);
      const { error } = await query; if (error) throw error;
      if (uploaded && form.elements.current_image_path.value) await client.storage.from("shop-media").remove([form.elements.current_image_path.value]);
      $("#eventDialog").close(); const { data } = await client.from("shop_events").select("*").order("event_date"); events = data || []; renderEvents(); notify("Mini evento guardado.");
    } catch (error) { status.textContent = error.message; }
  }

  document.addEventListener("click", async (event) => {
    const button = event.target.closest("button");
    const row = event.target.closest(".section-row");
    if (row && !button) selectSection(row.dataset.sectionKey);
    if (!button) return;
    if (button.dataset.toggleSection) { const section = sections.find((item) => item.section_key === button.dataset.toggleSection); section.enabled = !section.enabled; renderSections(); selectSection(section.section_key, false); applyPreviewSections(); $("#sectionEditorStatus").textContent = "Cambios sin publicar"; }
    if (button.dataset.device) { $$(".device-button").forEach((item) => item.classList.toggle("active", item === button)); $("#builderCanvas").classList.toggle("mobile", button.dataset.device === "mobile"); }
    if (button.dataset.editCategory) { const item = categories.find((x) => x.id === button.dataset.editCategory); const form = $("#categoryForm"); form.elements.id.value = item.id; form.elements.icon.value = item.icon || "☠"; form.elements.name.value = item.name; form.elements.description.value = item.description || ""; form.elements.sort_order.value = item.sort_order; form.elements.active.checked = item.active; }
    if (button.dataset.toggleCategory) { const item = categories.find((x) => x.id === button.dataset.toggleCategory); await client.from("shop_categories").update({ active: !item.active, updated_at: new Date().toISOString() }).eq("id", item.id); await loadEditorData(); }
    if (button.dataset.deleteCategory) { const item = categories.find((x) => x.id === button.dataset.deleteCategory); if (confirm(`¿Eliminar la categoría “${item.name}”?`)) { await client.from("shop_categories").delete().eq("id", item.id); await loadEditorData(); } }
    if (button.dataset.editRaffle) openRaffle(raffles.find((x) => x.id === button.dataset.editRaffle));
    if (button.dataset.toggleRaffle) { const item = raffles.find((x) => x.id === button.dataset.toggleRaffle); await client.from("shop_raffles").update({ active: !item.active, updated_at: new Date().toISOString() }).eq("id", item.id); await loadEditorData(); }
    if (button.dataset.deleteRaffle) { const item = raffles.find((x) => x.id === button.dataset.deleteRaffle); if (confirm(`¿Eliminar la rifa de $${item.price}?`)) { await client.from("shop_raffles").delete().eq("id", item.id); if (item.image_path) await client.storage.from("shop-media").remove([item.image_path]); await loadEditorData(); } }
    if (button.dataset.editEvent) openEvent(events.find((x) => x.id === button.dataset.editEvent));
    if (button.dataset.toggleEvent) { const item = events.find((x) => x.id === button.dataset.toggleEvent); await client.from("shop_events").update({ active: !item.active, updated_at: new Date().toISOString() }).eq("id", item.id); await loadEditorData(); }
    if (button.dataset.deleteEvent) { const item = events.find((x) => x.id === button.dataset.deleteEvent); if (confirm(`¿Eliminar el evento “${item.title}”?`)) { await client.from("shop_events").delete().eq("id", item.id); if (item.image_path) await client.storage.from("shop-media").remove([item.image_path]); await loadEditorData(); } }
    if (button.id === "newPromotionButton" || button.dataset.editPromotion) setTimeout(() => enhanceLinkInputs($("#promotionForm")), 0);
    if (button.dataset.view === "settings") setTimeout(() => enhanceLinkInputs($("#settingsForm")), 0);
  });

  $("#sitePreview").addEventListener("load", preparePreview);
  $("#closeInspector").addEventListener("click", () => $("#sectionInspector").classList.remove("open"));
  $("#sectionInspectorForm").addEventListener("input", updateSectionFromInspector);
  $("#sectionInspectorForm").addEventListener("change", updateSectionFromInspector);
  $("#saveSectionsButton").addEventListener("click", saveSections);
  $("#categoryForm").addEventListener("submit", saveCategory);
  $("#cancelCategory").addEventListener("click", resetCategoryForm);
  $("#newRaffleButton").addEventListener("click", () => openRaffle());
  $("#raffleForm").addEventListener("submit", saveRaffle);
  $$(".close-raffle-dialog").forEach((button) => button.addEventListener("click", () => $("#raffleDialog").close()));
  $("#newEventButton").addEventListener("click", () => openEvent());
  $("#eventForm").addEventListener("submit", saveEvent);
  $$(".close-event-dialog").forEach((button) => button.addEventListener("click", () => $("#eventDialog").close()));
  $$('[data-view="editor"],[data-view="categories"],[data-view="raffles"],[data-view="events"]').forEach((button) => button.addEventListener("click", () => { if (!initialized) loadEditorData(); }));
  client.auth.onAuthStateChange((type, session) => { if (session && !initialized) setTimeout(loadEditorData, 0); });
  loadEditorData();
})();
