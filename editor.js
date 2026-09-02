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
  let customSchemaReady = false;
  let previewUpdateTimer = 0;
  let previewPrepared = false;
  let previewResizeObserver = null;
  let previewHeightTimer = 0;
  let previewRepairAttempts = 0;
  let editorDirty = false;
  const deletedSectionKeys = new Set();
  const pendingMediaRemovals = new Set();
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
  const sectionTemplates = {
    blank: {
      label: "Sección en blanco", title: "NUEVA SECCIÓN", subtitle: "Escribe aquí el contenido principal.", layout: "grid",
      content: { eyebrow: "", body: "", theme: "custom", alignment: "left", image_position: "none", section_height: "auto", content_width: "normal", buttons: [] }
    },
    text: {
      label: "Bloque de texto", title: "CUENTA TU HISTORIA.", subtitle: "Agrega una explicación clara para tus clientes.", layout: "carousel",
      content: { eyebrow: "INFORMACIÓN", body: "Este espacio puede contener avisos, condiciones, horarios o cualquier información importante.", theme: "dark", alignment: "center", image_position: "none", section_height: "normal", content_width: "narrow", buttons: [] }
    },
    image: {
      label: "Texto e imagen", title: "PRESENTA ALGO NUEVO.", subtitle: "Combina una fotografía con información y una acción.", layout: "grid",
      content: { eyebrow: "DESTACADO", body: "Sube tu imagen, cambia los textos y decide si aparece a la izquierda o a la derecha.", theme: "dark", alignment: "left", image_position: "right", section_height: "normal", content_width: "normal", buttons: [{ text: "Ver más", url: "#contacto", style: "pink", size: "medium" }] }
    },
    cta: {
      label: "Llamada a la acción", title: "¿LISTO PARA RODAR?", subtitle: "Invita a tus visitantes a realizar una acción concreta.", layout: "featured",
      content: { eyebrow: "FANTASMAS BIKER'S SHOP", body: "Usa uno, dos o más botones. El bloque se ajustará automáticamente.", theme: "gradient", alignment: "center", image_position: "none", section_height: "normal", content_width: "normal", button_alignment: "center", buttons: [{ text: "Escribir por WhatsApp", url: "https://wa.me/525610329215", style: "pink", size: "large" }, { text: "Ver productos", url: "#productosPublicos", style: "light", size: "large" }] }
    },
    banner: {
      label: "Banner con fondo", title: "HAZ QUE ESTE MENSAJE DESTAQUE.", subtitle: "Usa una imagen de fondo para promociones, lanzamientos o eventos.", layout: "featured",
      content: { eyebrow: "ANUNCIO ESPECIAL", body: "Reemplaza la imagen y personaliza todos los colores desde el editor.", theme: "custom", background_mode: "gradient", background_color: "#07101a", background_secondary: "#3a0b32", text_color: "#ffffff", accent_color: "#ff3da1", alignment: "left", image_position: "background", section_height: "large", content_width: "wide", buttons: [{ text: "Más información", url: "#contacto", style: "custom", size: "large", background_color: "#ff3da1", text_color: "#ffffff" }] }
    },
    buttons: {
      label: "Menú de botones", title: "ELIGE A DÓNDE IR.", subtitle: "Crea accesos rápidos a productos, promociones, contacto o enlaces externos.", layout: "carousel",
      content: { eyebrow: "ACCESOS RÁPIDOS", body: "Puedes agregar, borrar, ordenar y cambiar el tamaño de cada botón.", theme: "custom", background_mode: "solid", background_color: "#10131a", background_secondary: "#251136", text_color: "#ffffff", accent_color: "#28a8ff", alignment: "center", image_position: "none", section_height: "normal", content_width: "normal", button_layout: "grid", button_alignment: "stretch", buttons: [{ text: "Productos", url: "#productosPublicos", style: "blue", size: "medium" }, { text: "Promociones", url: "#promocionesPublicas", style: "pink", size: "medium" }, { text: "Contacto", url: "#contacto", style: "dark", size: "medium" }] }
    }
  };
  const isCustomSection = (section) => Boolean(section && (section.section_type === "custom" || section.section_key.startsWith("custom_")));
  const customContent = (section) => {
    const value = section?.content;
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  };
  function sectionStickers(section) {
    if (!section) return [];
    if (!section.content || typeof section.content !== "object" || Array.isArray(section.content)) section.content = {};
    if (!Array.isArray(section.content.stickers)) section.content.stickers = [];
    section.content.stickers = section.content.stickers.map((item) => ({
      id: item.id || crypto.randomUUID(), url: String(item.url || ""), path: String(item.path || ""),
      x: Math.max(0, Math.min(100, Number(item.x ?? 80))), y: Math.max(0, Math.min(100, Number(item.y ?? 20))),
      size: Math.max(36, Math.min(360, Number(item.size ?? 110))), rotate: Math.max(-180, Math.min(180, Number(item.rotate ?? 0))),
      layer: Math.max(1, Math.min(20, Number(item.layer ?? 5))), hide_mobile: Boolean(item.hide_mobile)
    })).filter((item) => /^https?:\/\//i.test(item.url));
    return section.content.stickers;
  }
  function renderStickerControls(section) {
    const target = $("#stickerEditorList");
    const stickers = sectionStickers(section);
    target.innerHTML = stickers.length ? stickers.map((item, index) => `
      <article class="sticker-editor-card" data-sticker-editor="${index}">
        <div class="sticker-editor-head"><img src="${safe(item.url)}" alt=""><b>Sticker ${index + 1}</b><button type="button" data-remove-sticker="${index}">Eliminar</button></div>
        <div class="sticker-editor-grid">
          <label>Horizontal %<input type="number" min="0" max="100" value="${item.x}" data-sticker-field="x"></label>
          <label>Vertical %<input type="number" min="0" max="100" value="${item.y}" data-sticker-field="y"></label>
          <label>Tamaño px<input type="number" min="36" max="360" value="${item.size}" data-sticker-field="size"></label>
          <label>Giro °<input type="number" min="-180" max="180" value="${item.rotate}" data-sticker-field="rotate"></label>
          <label>Capa<input type="number" min="1" max="20" value="${item.layer}" data-sticker-field="layer"></label>
          <label class="inspector-toggle"><input type="checkbox" data-sticker-field="hide_mobile" ${item.hide_mobile ? "checked" : ""}> Ocultar en celular</label>
        </div>
      </article>`).join("") : '<div class="custom-buttons-empty">Todavía no hay stickers en esta sección.</div>';
  }
  const sectionAnchor = (section) => {
    if (!section) return "";
    if (sectionAnchors[section.section_key]) return sectionAnchors[section.section_key];
    if (isCustomSection(section)) return `#${customContent(section).anchor_id || `seccion-${section.section_key.replace(/^custom_/, "").slice(0, 8)}`}`;
    return "";
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

  function setEditorDirty(value) {
    editorDirty = Boolean(value);
    const button = $("#saveSectionsButton");
    if (!button) return;
    button.classList.toggle("has-unsaved", editorDirty);
    button.textContent = editorDirty ? "Publicar cambios •" : "Publicar cambios";
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
      ? sections.filter((section) => sectionAnchor(section)).map((section) => ({
          value: sectionAnchor(section),
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
    const sectionRows = results[0].data || [];
    deletedSectionKeys.clear();
    pendingMediaRemovals.clear();
    customSchemaReady = Boolean(sectionRows[0] && Object.prototype.hasOwnProperty.call(sectionRows[0], "content") && Object.prototype.hasOwnProperty.call(sectionRows[0], "section_type"));
    sections = sectionRows.map((section) => ({
      ...section,
      section_type: section.section_type || (section.section_key.startsWith("custom_") ? "custom" : "system"),
      content: customContent(section)
    }));
    $("#newSectionButton").disabled = !customSchemaReady;
    $("#newSectionButton").title = customSchemaReady ? "Crear una sección" : "Ejecuta database_custom_sections.sql en Supabase";
    categories = results[1].data || [];
    raffles = results[2].data || [];
    events = results[3].data || [];
    storeSettings = results[4].data?.setting_value || {};
    renderSections();
    renderCategories();
    renderRaffles();
    renderEvents();
    fillCategoryOptions();
    if (!selectedSectionKey && sections.length) { const preferred = sections.find((item) => item.section_key === "hero" && item.enabled) || sections.find((item) => item.enabled && !fixedSections.has(item.section_key)) || sections[0]; selectSection(preferred.section_key, false); }
    applyPreviewSections();
    $("#sectionEditorStatus").textContent = customSchemaReady ? "Editor total listo" : "Falta activar secciones nuevas en Supabase";
    initialized = true;
  }

  function renderSections() {
    const container = $("#sectionEditor");
    if (!sections.length) {
      container.innerHTML = '<div class="empty">No hay secciones configuradas.</div>';
      return;
    }
    container.innerHTML = sections.map((section) => `
      <article class="section-row${section.section_key === selectedSectionKey ? " selected" : ""}" data-section-key="${safe(section.section_key)}" draggable="false">
        <span class="drag-handle" draggable="${fixedSections.has(section.section_key) ? "false" : "true"}" title="${fixedSections.has(section.section_key) ? "Posición fija" : "Arrastrar"}">${fixedSections.has(section.section_key) ? "🔒" : "⠿"}</span>
        <div class="section-identity"><b>${safe(section.label)}</b><small>${safe(section.enabled ? `${section.layout}${isCustomSection(section) ? " · PERSONALIZADA" : ""}` : "OCULTA")}</small></div>
        <button class="section-visible${section.enabled ? "" : " off"}" type="button" data-toggle-section="${safe(section.section_key)}" title="${section.enabled ? "Ocultar" : "Mostrar"}">${section.enabled ? "●" : "○"}</button>
        <button class="section-delete" type="button" data-delete-section="${safe(section.section_key)}" title="Eliminar definitivamente" aria-label="Eliminar ${safe(section.label)}">×</button>
      </article>`).join("");
    bindSectionDrag();
  }

  function selectSection(key, scrollPreview = true, preserveCurrent = true) {
    const section = sections.find((item) => item.section_key === key);
    if (!section) return;
    if (preserveCurrent && selectedSectionKey && selectedSectionKey !== key) {
      try { updateSectionFromInspector(); } catch (error) { console.warn("No se pudo conservar el bloque anterior", error); }
    }
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
    setLayoutLabels(isCustomSection(section));
    $("#genericSectionControls").hidden = specialSections.has(key);
    $("#heroSectionControls").hidden = key !== "hero";
    $("#tickerSectionControls").hidden = key !== "announcement";
    $("#customSectionControls").hidden = !isCustomSection(section);
    $("#sectionInspectorHint").textContent = isCustomSection(section)
      ? "Esta sección y sus botones se publican juntos al guardar los cambios."
      : "Los productos, promociones, rifas y eventos se editan desde sus apartados del menú.";
    renderExtraControls(key);
    if (isCustomSection(section)) renderCustomSectionControls(section);
    renderStickerControls(section);
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
    requestAnimationFrame(() => { $("#sectionInspector").scrollTop = 0; });
    markPreviewSelection(scrollPreview);
  }

  function markStickerChange() {
    editorDirty = true;
    $("#sectionEditorStatus").textContent = "Cambios sin publicar";
  }

  async function addSticker(file) {
    const section = sections.find((item) => item.section_key === selectedSectionKey);
    if (!section || !file) return;
    const status = $("#stickerUploadStatus");
    status.textContent = "Subiendo sticker…";
    try {
      const uploaded = await uploadImage(file, "stickers");
      sectionStickers(section).push({ id: crypto.randomUUID(), url: uploaded.url, path: uploaded.path, x: 82, y: 18, size: 110, rotate: 0, layer: 5, hide_mobile: false });
      renderStickerControls(section);
      applyPreviewSections();
      markStickerChange();
      status.textContent = "Listo. También puedes arrastrarlo en la vista previa.";
    } catch (error) { status.textContent = error.message; }
  }

  function updateStickerFromControl(target) {
    const section = sections.find((item) => item.section_key === selectedSectionKey);
    const card = target.closest("[data-sticker-editor]");
    if (!section || !card) return;
    const sticker = sectionStickers(section)[Number(card.dataset.stickerEditor)];
    if (!sticker) return;
    const field = target.dataset.stickerField;
    sticker[field] = field === "hide_mobile" ? target.checked : Number(target.value);
    applyPreviewSections();
    markStickerChange();
  }

  async function removeSticker(index) {
    const section = sections.find((item) => item.section_key === selectedSectionKey);
    if (!section) return;
    const removed = sectionStickers(section).splice(index, 1)[0];
    if (removed?.path) await client.storage.from("shop-media").remove([removed.path]);
    renderStickerControls(section);
    applyPreviewSections();
    markStickerChange();
  }

  function bindPreviewStickerDragging(doc) {
    doc.querySelectorAll(".section-sticker").forEach((sticker) => {
      sticker.onpointerdown = (event) => {
        event.preventDefault(); event.stopPropagation();
        const sectionElement = sticker.closest("[data-section-key]");
        const section = sections.find((item) => item.section_key === sectionElement?.dataset.sectionKey);
        const item = sectionStickers(section)[Number(sticker.dataset.stickerIndex)];
        if (!section || !item) return;
        selectSection(section.section_key, false);
        sticker.setPointerCapture?.(event.pointerId);
        const move = (pointer) => {
          const rect = sectionElement.getBoundingClientRect();
          item.x = Math.max(0, Math.min(100, ((pointer.clientX - rect.left) / rect.width) * 100));
          item.y = Math.max(0, Math.min(100, ((pointer.clientY - rect.top) / rect.height) * 100));
          sticker.style.setProperty("--sticker-x", `${item.x}%`);
          sticker.style.setProperty("--sticker-y", `${item.y}%`);
        };
        const stop = () => {
          sticker.removeEventListener("pointermove", move);
          sticker.removeEventListener("pointerup", stop);
          renderStickerControls(section);
          markStickerChange();
        };
        sticker.addEventListener("pointermove", move);
        sticker.addEventListener("pointerup", stop);
      };
    });
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

  function normalizeCustomContent(section) {
    const current = customContent(section);
    const anchorId = current.anchor_id || `seccion-${section.section_key.replace(/^custom_/, "").slice(0, 8)}`;
    section.content = {
      anchor_id: anchorId,
      eyebrow: current.eyebrow ?? "SECCIÓN PERSONALIZADA",
      body: current.body ?? "",
      theme: ["dark","blue","pink","gradient","custom"].includes(current.theme) ? current.theme : "dark",
      background_mode: ["solid","gradient"].includes(current.background_mode) ? current.background_mode : "solid",
      background_color: /^#[0-9a-f]{6}$/i.test(current.background_color || "") ? current.background_color : "#0d1015",
      background_secondary: /^#[0-9a-f]{6}$/i.test(current.background_secondary || "") ? current.background_secondary : "#251136",
      text_color: /^#[0-9a-f]{6}$/i.test(current.text_color || "") ? current.text_color : "#ffffff",
      accent_color: /^#[0-9a-f]{6}$/i.test(current.accent_color || "") ? current.accent_color : "#28a8ff",
      alignment: ["left","center","right"].includes(current.alignment) ? current.alignment : "left",
      section_height: ["auto","compact","normal","large","screen"].includes(current.section_height) ? current.section_height : "auto",
      content_width: ["narrow","normal","wide","full"].includes(current.content_width) ? current.content_width : "normal",
      image_position: ["right","left","background","none"].includes(current.image_position) ? current.image_position : "right",
      image_url: current.image_url || "",
      image_path: current.image_path || "",
      image_alt: current.image_alt || "",
      button_layout: ["auto","row","stack","grid"].includes(current.button_layout) ? current.button_layout : "auto",
      button_alignment: ["left","center","right","stretch"].includes(current.button_alignment) ? current.button_alignment : (["left","center","right"].includes(current.alignment) ? current.alignment : "left"),
      button_gap: ["small","normal","large"].includes(current.button_gap) ? current.button_gap : "normal",
      buttons: Array.isArray(current.buttons) ? current.buttons.map((button) => ({
        id: button.id || crypto.randomUUID(),
        text: button.text || "Botón",
        url: button.url || "",
        style: ["pink","blue","dark","light","custom"].includes(button.style) ? button.style : "pink",
        size: ["small","medium","large","full"].includes(button.size) ? button.size : "medium",
        background_color: /^#[0-9a-f]{6}$/i.test(button.background_color || "") ? button.background_color : "#ff3da1",
        text_color: /^#[0-9a-f]{6}$/i.test(button.text_color || "") ? button.text_color : "#ffffff"
      })) : []
    };
    return section.content;
  }

  function setLayoutLabels(custom = false) {
    const select = $("#sectionInspectorForm").elements.layout;
    const labels = custom
      ? { grid: "Dos columnas", featured: "Destacada", compact: "Compacta", carousel: "Centrada" }
      : { grid: "Cuadrícula", featured: "Destacado", compact: "Compacto", carousel: "Carrusel" };
    [...select.options].forEach((option) => { option.textContent = labels[option.value] || option.textContent; });
  }

  function renderCustomSectionControls(section) {
    const form = $("#sectionInspectorForm");
    const content = normalizeCustomContent(section);
    setLayoutLabels(true);
    form.elements.custom_label.value = section.label || "Sección personalizada";
    form.elements.custom_eyebrow.value = content.eyebrow;
    form.elements.custom_body.value = content.body;
    form.elements.custom_theme.value = content.theme;
    form.elements.custom_background_mode.value = content.background_mode;
    form.elements.custom_background_color.value = content.background_color;
    form.elements.custom_background_secondary.value = content.background_secondary;
    form.elements.custom_text_color.value = content.text_color;
    form.elements.custom_accent_color.value = content.accent_color;
    form.elements.custom_alignment.value = content.alignment;
    form.elements.custom_section_height.value = content.section_height;
    form.elements.custom_content_width.value = content.content_width;
    form.elements.custom_image_position.value = content.image_position;
    form.elements.custom_image_alt.value = content.image_alt;
    form.elements.custom_button_layout.value = content.button_layout;
    form.elements.custom_button_alignment.value = content.button_alignment;
    form.elements.custom_button_gap.value = content.button_gap;
    $("#customColorControls").hidden = content.theme !== "custom";
    form.elements.custom_image.value = "";
    $("#customUploadStatus").textContent = "";
    $("#customImagePreview").innerHTML = content.image_url
      ? `<img src="${safe(content.image_url)}" alt=""><span>Imagen actual</span>`
      : '<span class="no-custom-image">Sin imagen</span>';
    $("#removeCustomImage").hidden = !content.image_url;
    $("#customButtonsEditor").innerHTML = content.buttons.length ? content.buttons.map((button, index) => `
      <article class="custom-button-row" data-custom-button="${safe(button.id)}">
        <div class="custom-button-row-head"><b>Botón ${index + 1}</b><div><button type="button" data-move-custom-button="up" title="Subir">↑</button><button type="button" data-move-custom-button="down" title="Bajar">↓</button><button type="button" data-remove-custom-button title="Eliminar">×</button></div></div>
        <label>Texto<input data-custom-button-text maxlength="60" value="${safe(button.text)}"></label>
        <div class="custom-button-options">
          <label>Estilo<select data-custom-button-style><option value="pink"${button.style === "pink" ? " selected" : ""}>Rosa</option><option value="blue"${button.style === "blue" ? " selected" : ""}>Azul</option><option value="dark"${button.style === "dark" ? " selected" : ""}>Oscuro</option><option value="light"${button.style === "light" ? " selected" : ""}>Claro</option><option value="custom"${button.style === "custom" ? " selected" : ""}>Personalizado</option></select></label>
          <label>Tamaño<select data-custom-button-size><option value="small"${button.size === "small" ? " selected" : ""}>Pequeño</option><option value="medium"${button.size === "medium" ? " selected" : ""}>Mediano</option><option value="large"${button.size === "large" ? " selected" : ""}>Grande</option><option value="full"${button.size === "full" ? " selected" : ""}>Ancho completo</option></select></label>
        </div>
        <div class="custom-button-colors"><label>Fondo personalizado<input data-custom-button-background type="color" value="${safe(button.background_color)}"></label><label>Texto personalizado<input data-custom-button-text-color type="color" value="${safe(button.text_color)}"></label></div>
        <label>Destino<input name="custom_button_${safe(button.id)}_url" data-custom-button-url value="${safe(button.url)}" maxlength="500"></label>
      </article>`).join("") : '<div class="custom-buttons-empty">Esta sección todavía no tiene botones.</div>';
    enhanceLinkInputs($("#customButtonsEditor"));
  }

  function updateSectionFromInspector(event) {
    const form = $("#sectionInspectorForm");
    const section = sections.find((item) => item.section_key === form.elements.section_key.value);
    if (!section) return;
    const customColorNames = new Set(["custom_background_color","custom_background_secondary","custom_text_color","custom_accent_color","custom_background_mode"]);
    if (event?.target?.name && customColorNames.has(event.target.name)) form.elements.custom_theme.value = "custom";
    const buttonRow = event?.target?.closest?.("[data-custom-button]");
    if (buttonRow && (event.target.matches("[data-custom-button-background]") || event.target.matches("[data-custom-button-text-color]"))) {
      $("[data-custom-button-style]", buttonRow).value = "custom";
    }
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
    if (isCustomSection(section)) {
      const content = normalizeCustomContent(section);
      section.label = form.elements.custom_label.value.trim() || "Sección personalizada";
      content.eyebrow = form.elements.custom_eyebrow.value;
      content.body = form.elements.custom_body.value;
      content.theme = form.elements.custom_theme.value;
      content.background_mode = form.elements.custom_background_mode.value;
      content.background_color = form.elements.custom_background_color.value;
      content.background_secondary = form.elements.custom_background_secondary.value;
      content.text_color = form.elements.custom_text_color.value;
      content.accent_color = form.elements.custom_accent_color.value;
      content.alignment = form.elements.custom_alignment.value;
      content.section_height = form.elements.custom_section_height.value;
      content.content_width = form.elements.custom_content_width.value;
      content.image_position = form.elements.custom_image_position.value;
      content.image_alt = form.elements.custom_image_alt.value;
      content.button_layout = form.elements.custom_button_layout.value;
      content.button_alignment = form.elements.custom_button_alignment.value;
      content.button_gap = form.elements.custom_button_gap.value;
      $("#customColorControls").hidden = content.theme !== "custom";
      content.buttons = $$("[data-custom-button]", $("#customButtonsEditor")).map((row) => ({
        id: row.dataset.customButton,
        text: $("[data-custom-button-text]", row).value.trim() || "Botón",
        url: $("[data-custom-button-url]", row).value.trim(),
        style: $("[data-custom-button-style]", row).value,
        size: $("[data-custom-button-size]", row).value,
        background_color: $("[data-custom-button-background]", row).value,
        text_color: $("[data-custom-button-text-color]", row).value
      }));
      $("#inspectorSectionName").textContent = section.label;
    }
    $$('[data-setting-key]', form).forEach((input) => storeSettings[input.dataset.settingKey] = input.value);
    const selectedRow = $(`.section-row[data-section-key="${section.section_key}"]`, $("#sectionEditor"));
    if (selectedRow) {
      const name = $(".section-identity b", selectedRow);
      const detail = $(".section-identity small", selectedRow);
      const visibility = $(".section-visible", selectedRow);
      if (name) name.textContent = section.label;
      if (detail) detail.textContent = section.enabled ? `${section.layout}${isCustomSection(section) ? " · PERSONALIZADA" : ""}` : "OCULTA";
      if (visibility) { visibility.classList.toggle("off", !section.enabled); visibility.textContent = section.enabled ? "●" : "○"; }
    }
    clearTimeout(previewUpdateTimer);
    previewUpdateTimer = setTimeout(applyPreviewSections, 220);
    $("#sectionEditorStatus").textContent = "Cambios sin publicar";
  }

  function createCustomSection(templateKey = "blank") {
    if (!customSchemaReady) return notify("Ejecuta database_custom_sections.sql en Supabase antes de crear secciones.", true);
    const id = crypto.randomUUID().replaceAll("-", "");
    const template = sectionTemplates[templateKey] || sectionTemplates.blank;
    const templateContent = template.content || {};
    const section = {
      section_key: `custom_${id}`,
      label: template.label,
      title: template.title,
      subtitle: template.subtitle,
      enabled: true,
      sort_order: 0,
      layout: template.layout || "grid",
      section_type: "custom",
      content: {
        anchor_id: `seccion-${id.slice(0, 8)}`,
        ...templateContent,
        image_url: "",
        image_path: "",
        image_alt: "",
        buttons: Array.isArray(templateContent.buttons) ? templateContent.buttons.map((button) => ({ ...button, id: crypto.randomUUID() })) : []
      }
    };
    const footerIndex = sections.findIndex((item) => item.section_key === "footer");
    sections.splice(footerIndex >= 0 ? footerIndex : sections.length, 0, section);
    selectedSectionKey = section.section_key;
    renderSections();
    selectSection(section.section_key);
    applyPreviewSections();
    $("#sectionEditorStatus").textContent = "Nueva sección sin publicar";
    $("#sectionTemplateDialog")?.close();
    notify(`Plantilla “${template.label}” creada. Edítala y pulsa Publicar cambios.`);
  }

  function selectedCustomSection() {
    const section = sections.find((item) => item.section_key === selectedSectionKey);
    return isCustomSection(section) ? section : null;
  }

  function addCustomButton() {
    const section = selectedCustomSection();
    if (!section) return;
    updateSectionFromInspector();
    const content = normalizeCustomContent(section);
    content.buttons.push({ id: crypto.randomUUID(), text: "Nuevo botón", url: "#inicio", style: "pink", size: "medium", background_color: "#ff3da1", text_color: "#ffffff" });
    renderCustomSectionControls(section);
    applyPreviewSections();
    $("#sectionEditorStatus").textContent = "Botón nuevo sin publicar";
  }

  function changeCustomButton(buttonId, action) {
    const section = selectedCustomSection();
    if (!section) return;
    updateSectionFromInspector();
    const buttons = normalizeCustomContent(section).buttons;
    const index = buttons.findIndex((button) => button.id === buttonId);
    if (index < 0) return;
    if (action === "remove") buttons.splice(index, 1);
    if (action === "up" && index > 0) [buttons[index - 1], buttons[index]] = [buttons[index], buttons[index - 1]];
    if (action === "down" && index < buttons.length - 1) [buttons[index + 1], buttons[index]] = [buttons[index], buttons[index + 1]];
    renderCustomSectionControls(section);
    applyPreviewSections();
    $("#sectionEditorStatus").textContent = "Botones modificados sin publicar";
  }

  async function setCustomSectionImage(file) {
    const section = selectedCustomSection();
    if (!section || !file) return;
    const status = $("#customUploadStatus");
    status.textContent = "Subiendo imagen…";
    try {
      updateSectionFromInspector();
      const content = normalizeCustomContent(section);
      const previousPath = content.image_path;
      const uploaded = await uploadImage(file, "sections");
      if (previousPath) pendingMediaRemovals.add(previousPath);
      content.image_url = uploaded.url;
      content.image_path = uploaded.path;
      if (content.image_position === "none") content.image_position = "right";
      if (!content.image_alt) content.image_alt = section.title || "Imagen de Fantasmas Biker's Shop";
      renderCustomSectionControls(section);
      applyPreviewSections();
      $("#customUploadStatus").textContent = "Imagen lista. Publica los cambios.";
      $("#sectionEditorStatus").textContent = "Imagen nueva sin publicar";
    } catch (error) {
      status.textContent = error.message;
    }
  }

  function removeCustomSectionImage() {
    const section = selectedCustomSection();
    if (!section) return;
    updateSectionFromInspector();
    const content = normalizeCustomContent(section);
    if (content.image_path) pendingMediaRemovals.add(content.image_path);
    content.image_url = "";
    content.image_path = "";
    content.image_position = "none";
    renderCustomSectionControls(section);
    applyPreviewSections();
    $("#sectionEditorStatus").textContent = "Imagen retirada sin publicar";
  }

  function deleteSection(sectionKey = selectedSectionKey) {
    const section = sections.find((item) => item.section_key === sectionKey);
    if (!section || !confirm(`¿Eliminar la sección “${section.label}”?`)) return;
    if (!confirm("Esta acción la quitará definitivamente de la página cuando publiques los cambios. ¿Deseas continuar?")) return;
    if (isCustomSection(section)) {
      const content = normalizeCustomContent(section);
      if (content.image_path) pendingMediaRemovals.add(content.image_path);
    }
    deletedSectionKeys.add(section.section_key);
    const index = sections.findIndex((item) => item.section_key === section.section_key);
    sections.splice(index, 1);
    selectedSectionKey = sections[Math.max(0, index - 1)]?.section_key || "";
    renderSections();
    applyPreviewSections();
    if (selectedSectionKey) selectSection(selectedSectionKey, false);
    else {
      $("#sectionInspectorForm").hidden = true;
      $("#inspectorEmpty").hidden = false;
    }
    $("#sectionEditorStatus").textContent = "Sección eliminada sin publicar";
  }

  function bindSectionDrag() {
    $$(".section-row", $("#sectionEditor")).forEach((row) => {
      row.addEventListener("dragstart", (event) => { if (!event.target.closest(".drag-handle") || fixedSections.has(row.dataset.sectionKey)) { event.preventDefault(); return; } draggedKey = row.dataset.sectionKey; row.classList.add("dragging"); });
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

  function syncPreviewHeight(doc = previewDocument()) {
    if (!doc?.body) return;
    const frame = $("#sitePreview");
    const bodyTop = doc.body.getBoundingClientRect().top;
    const contentBottom = [...doc.body.children].reduce((maximum, element) => {
      if (doc.defaultView.getComputedStyle(element).display === "none" || element.hidden) return maximum;
      return Math.max(maximum, element.getBoundingClientRect().bottom - bodyTop);
    }, 0);
    const height = Math.max(560, Math.ceil(contentBottom));
    if (Math.abs((parseFloat(frame.style.height) || 0) - height) > 2) frame.style.height = `${height}px`;
  }

  function schedulePreviewHeight(doc = previewDocument()) {
    clearTimeout(previewHeightTimer);
    requestAnimationFrame(() => syncPreviewHeight(doc));
    previewHeightTimer = setTimeout(() => syncPreviewHeight(doc), 350);
  }

  function observePreviewHeight(doc) {
    previewResizeObserver?.disconnect();
    const PreviewResizeObserver = $("#sitePreview").contentWindow?.ResizeObserver;
    if (!PreviewResizeObserver || !doc?.body) return;
    previewResizeObserver = new PreviewResizeObserver(() => schedulePreviewHeight(doc));
    previewResizeObserver.observe(doc.body);
    doc.querySelectorAll("img").forEach((image) => image.addEventListener("load", () => schedulePreviewHeight(doc), { once: true }));
  }

  function scrollPreviewSectionIntoView(section, smooth = true) {
    const doc = previewDocument();
    const canvas = $("#builderCanvas");
    const frame = $("#sitePreview");
    if (!doc || !canvas || !section) return;
    const viewport = doc.scrollingElement || doc.documentElement;
    viewport.scrollTop = 0;
    const viewportRect = canvas.getBoundingClientRect();
    const frameTop = frame.getBoundingClientRect().top - viewportRect.top + canvas.scrollTop;
    const rect = section.getBoundingClientRect();
    const target = frameTop + rect.top - Math.max(20, (canvas.clientHeight - Math.min(rect.height, canvas.clientHeight)) / 2);
    canvas.scrollTo({ top: Math.max(0, target), behavior: smooth ? "smooth" : "auto" });
  }

  function preparePreview() {
    const doc = previewDocument();
    if (!doc) return;
    previewPrepared = false;
    const previewWindow = $("#sitePreview").contentWindow;
    if (!previewWindow.FANTASMAS_SETTINGS_LOADED) previewWindow.addEventListener("fantasmas:settings-ready", () => applyPreviewSections(), { once: true });
    if (previewWindow.FANTASMAS_SECTIONS_READY?.then) previewWindow.FANTASMAS_SECTIONS_READY.then(() => applyPreviewSections());
    if (!doc.querySelector("#fantasmasBuilderStyle")) {
      const style = doc.createElement("style");
      style.id = "fantasmasBuilderStyle";
      style.textContent = 'html,body{height:auto!important;min-height:0!important;scroll-behavior:auto!important;overflow:visible!important}html.fantasmas-builder-preview *,html.fantasmas-builder-preview *:before,html.fantasmas-builder-preview *:after{animation:none!important;transition:none!important;scroll-behavior:auto!important}html.fantasmas-builder-preview .custom-height-screen{min-height:560px!important}html.fantasmas-builder-preview .whatsapp-flotante,html.fantasmas-builder-preview .cart-floating-button,html.fantasmas-builder-preview .cart-overlay,html.fantasmas-builder-preview .cart-drawer,html.fantasmas-builder-preview .payment-return-notice{display:none!important}[data-section-key]{cursor:pointer;transition:outline .15s}[data-section-key].builder-selected{outline:4px solid #28a8ff!important;outline-offset:-4px;position:relative}.ticker-track{transform:none!important;will-change:auto!important}';
      doc.head.append(style);
    }
    doc.documentElement.classList.add("fantasmas-builder-preview");
    const viewport = doc.scrollingElement || doc.documentElement;
    viewport.scrollTop = 0;
    bindPreviewSectionClicks(doc);
    applyPreviewSections();
    observePreviewHeight(doc);
    schedulePreviewHeight(doc);
    requestAnimationFrame(() => {
      $("#builderCanvas").scrollTop = 0;
      previewPrepared = true;
    });
  }

  function bindPreviewSectionClicks(doc) {
    doc.querySelectorAll("[data-section-key]").forEach((element) => {
      if (element.dataset.builderClickBound === "true") return;
      element.dataset.builderClickBound = "true";
      element.addEventListener("click", (event) => {
        event.preventDefault(); event.stopPropagation();
        selectSection(element.dataset.sectionKey, false);
      });
    });
  }

  function applyPreviewSections() {
    const doc = previewDocument();
    if (!doc) return;
    const canvas = $("#builderCanvas");
    const previousScroll = previewPrepared ? canvas.scrollTop : 0;
    const previewSections = sections.map((settings, index) => ({ ...settings, sort_order: (index + 1) * 10 }));
    const previewWindow = $("#sitePreview").contentWindow;
    if (typeof previewWindow?.FANTASMAS_APPLY_SECTIONS === "function") previewWindow.FANTASMAS_APPLY_SECTIONS(previewSections);
    else if (typeof previewWindow?.FANTASMAS_RENDER_CUSTOM_SECTIONS === "function") previewWindow.FANTASMAS_RENDER_CUSTOM_SECTIONS(previewSections);

    // Versiones anteriores eliminaban nodos completos durante una carga parcial.
    // Si detectamos uno de esos documentos dañados, reconstruimos el iframe desde
    // el HTML base una sola vez. El nuevo site-editor solo oculta, nunca elimina.
    const missingSystemSections = previewSections
      .filter((settings) => !isCustomSection(settings))
      .filter((settings) => !doc.querySelector(`[data-section-key="${settings.section_key}"]`));
    if (missingSystemSections.length && previewRepairAttempts < 1) {
      previewRepairAttempts += 1;
      previewPrepared = false;
      previewResizeObserver?.disconnect();
      $("#sectionEditorStatus").textContent = "Reconstruyendo la página completa…";
      $("#sitePreview").src = `index.html?preview=1&builder=15&repair=${Date.now()}`;
      return;
    }
    if (!missingSystemSections.length) previewRepairAttempts = 0;
    previewSections.forEach((settings, index) => {
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
    bindPreviewSectionClicks(doc);
    bindPreviewStickerDragging(doc);
    applyPreviewSettings(doc);
    markPreviewSelection(false);
    schedulePreviewHeight(doc);
    if (previewPrepared) requestAnimationFrame(() => { canvas.scrollTop = previousScroll; });
  }

  function showPreviewFromTop() {
    const doc = previewDocument();
    if (!doc) return;
    const viewport = doc.scrollingElement || doc.documentElement;
    viewport.scrollTop = 0;
    $("#builderCanvas").scrollTo({ top: 0, behavior: "smooth" });
    $("#sectionEditorStatus").textContent = "Vista completa desde la portada";
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
      if (scroll) scrollPreviewSectionIntoView(selected, true);
    }
  }

  async function saveSections() {
    updateSectionFromInspector();
    const payload = sections.map((section, index) => {
      const base = {
        section_key: section.section_key,
        label: section.label,
        title: section.title || "",
        subtitle: section.subtitle || "",
        layout: section.layout || "grid",
        enabled: Boolean(section.enabled),
        sort_order: (index + 1) * 10,
        updated_at: new Date().toISOString()
      };
      return customSchemaReady ? {
        ...base,
        section_type: isCustomSection(section) ? "custom" : "system",
        content: isCustomSection(section) ? normalizeCustomContent(section) : customContent(section)
      } : base;
    });
    $("#sectionEditorStatus").textContent = "Publicando…";
    const requests = [
      client.from("shop_sections").upsert(payload),
      client.from("shop_settings").upsert({ setting_key: "store_info", setting_value: storeSettings, updated_at: new Date().toISOString() })
    ];
    if (deletedSectionKeys.size) requests.push(client.from("shop_sections").delete().in("section_key", [...deletedSectionKeys]));
    const results = await Promise.all(requests);
    const error = results.find((result) => result.error)?.error;
    if (error) { $("#sectionEditorStatus").textContent = error.message; return notify(error.message, true); }
    sections = payload;
    deletedSectionKeys.clear();
    if (pendingMediaRemovals.size) {
      await client.storage.from("shop-media").remove([...pendingMediaRemovals]);
      pendingMediaRemovals.clear();
    }
    $("#sectionEditorStatus").textContent = "Cambios publicados";
    setEditorDirty(false);
    notify("La página pública y sus secciones fueron actualizadas.");
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
        <div class="list-actions"><button data-manage-raffle="${item.id}">Números y sorteo</button><button data-edit-raffle="${item.id}">Editar</button><button data-toggle-raffle="${item.id}">${item.active ? "Ocultar" : "Mostrar"}</button><button class="delete" data-delete-raffle="${item.id}">Eliminar</button></div>
      </article>`).join("") : '<div class="empty">No hay rifas publicadas.</div>';
  }

  function openRaffle(item = null) {
    const form = $("#raffleForm"); form.reset(); form.elements.active.checked = true; form.elements.sales_open.checked = true; form.elements.icon.value = "🎁"; form.elements.total_numbers.value = 20; form.elements.reservation_minutes.value = 120; form.elements.max_numbers_per_order.value = 5; form.elements.sort_order.value = 0; form.elements.button_text.value = "Elegir números";
    $("#raffleDialogTitle").textContent = item ? "Editar rifa" : "Nueva rifa";
    if (item) { ["id","price","total_numbers","reservation_minutes","max_numbers_per_order","icon","main_prize","secondary_prizes","button_text","sort_order"].forEach((key) => form.elements[key].value = item[key] ?? ""); form.elements.current_image_url.value = item.image_url || ""; form.elements.current_image_path.value = item.image_path || ""; form.elements.active.checked = item.active; form.elements.sales_open.checked = item.sales_open !== false; }
    $("#raffleStatus").textContent = ""; $("#raffleDialog").showModal();
  }

  async function saveRaffle(event) {
    event.preventDefault();
    const form = event.currentTarget; const status = $("#raffleStatus"); status.textContent = "Guardando…";
    try {
      const uploaded = await uploadImage(form.elements.image.files[0], "raffles");
      const payload = { price: Number(form.elements.price.value), total_numbers: Number(form.elements.total_numbers.value), reservation_minutes: Number(form.elements.reservation_minutes.value || 120), max_numbers_per_order: Number(form.elements.max_numbers_per_order.value || 5), icon: form.elements.icon.value.trim() || "🎁", main_prize: form.elements.main_prize.value.trim(), secondary_prizes: form.elements.secondary_prizes.value.trim(), button_text: form.elements.button_text.value.trim() || "Elegir números", sort_order: Number(form.elements.sort_order.value || 0), active: form.elements.active.checked, sales_open: form.elements.sales_open.checked, image_url: uploaded?.url || form.elements.current_image_url.value || null, image_path: uploaded?.path || form.elements.current_image_path.value || null, updated_at: new Date().toISOString() };
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
    if (button.id === "newSectionButton") $("#sectionTemplateDialog").showModal();
    if (button.dataset.sectionTemplate) createCustomSection(button.dataset.sectionTemplate);
    if (button.classList.contains("close-template-dialog")) $("#sectionTemplateDialog").close();
    if (button.id === "addCustomButton") addCustomButton();
    if (button.id === "removeCustomImage") removeCustomSectionImage();
    if (button.dataset.removeSticker !== undefined) removeSticker(Number(button.dataset.removeSticker));
    if (button.id === "deleteSectionButton") deleteSection();
    if (button.dataset.deleteSection) deleteSection(button.dataset.deleteSection);
    if (button.dataset.removeCustomButton !== undefined) changeCustomButton(button.closest("[data-custom-button]")?.dataset.customButton, "remove");
    if (button.dataset.moveCustomButton) changeCustomButton(button.closest("[data-custom-button]")?.dataset.customButton, button.dataset.moveCustomButton);
    if (button.dataset.toggleSection) { const section = sections.find((item) => item.section_key === button.dataset.toggleSection); section.enabled = !section.enabled; renderSections(); selectSection(section.section_key, false); applyPreviewSections(); $("#sectionEditorStatus").textContent = "Cambios sin publicar"; }
    if (button.dataset.device) { $$(".device-button").forEach((item) => item.classList.toggle("active", item === button)); $("#builderCanvas").classList.toggle("mobile", button.dataset.device === "mobile"); }
    if (button.id === "previewHomeButton") showPreviewFromTop();
    if (button.dataset.editCategory) { const item = categories.find((x) => x.id === button.dataset.editCategory); const form = $("#categoryForm"); form.elements.id.value = item.id; form.elements.icon.value = item.icon || "☠"; form.elements.name.value = item.name; form.elements.description.value = item.description || ""; form.elements.sort_order.value = item.sort_order; form.elements.active.checked = item.active; }
    if (button.dataset.toggleCategory) { const item = categories.find((x) => x.id === button.dataset.toggleCategory); await client.from("shop_categories").update({ active: !item.active, updated_at: new Date().toISOString() }).eq("id", item.id); await loadEditorData(); }
    if (button.dataset.deleteCategory) { const item = categories.find((x) => x.id === button.dataset.deleteCategory); if (confirm(`¿Eliminar la categoría “${item.name}”?`)) { await client.from("shop_categories").delete().eq("id", item.id); await loadEditorData(); } }
    if (button.dataset.editRaffle) openRaffle(raffles.find((x) => x.id === button.dataset.editRaffle));
    if (button.dataset.manageRaffle) location.href = `sorteo-control.html?id=${encodeURIComponent(button.dataset.manageRaffle)}`;
    if (button.dataset.toggleRaffle) { const item = raffles.find((x) => x.id === button.dataset.toggleRaffle); await client.from("shop_raffles").update({ active: !item.active, updated_at: new Date().toISOString() }).eq("id", item.id); await loadEditorData(); }
    if (button.dataset.deleteRaffle) { const item = raffles.find((x) => x.id === button.dataset.deleteRaffle); if (confirm(`¿Eliminar la rifa de $${item.price}?`)) { await client.from("shop_raffles").delete().eq("id", item.id); if (item.image_path) await client.storage.from("shop-media").remove([item.image_path]); await loadEditorData(); } }
    if (button.dataset.editEvent) openEvent(events.find((x) => x.id === button.dataset.editEvent));
    if (button.dataset.toggleEvent) { const item = events.find((x) => x.id === button.dataset.toggleEvent); await client.from("shop_events").update({ active: !item.active, updated_at: new Date().toISOString() }).eq("id", item.id); await loadEditorData(); }
    if (button.dataset.deleteEvent) { const item = events.find((x) => x.id === button.dataset.deleteEvent); if (confirm(`¿Eliminar el evento “${item.title}”?`)) { await client.from("shop_events").delete().eq("id", item.id); if (item.image_path) await client.storage.from("shop-media").remove([item.image_path]); await loadEditorData(); } }
    if (button.id === "newPromotionButton" || button.dataset.editPromotion) setTimeout(() => enhanceLinkInputs($("#promotionForm")), 0);
    if (button.dataset.view === "settings") setTimeout(() => enhanceLinkInputs($("#settingsForm")), 0);
  });

  // Selección dedicada del constructor. Se ejecuta antes que los manejadores
  // generales para que arrastrar, la vista previa u otros botones no bloqueen
  // el cambio del bloque mostrado en el inspector derecho.
  $("#sectionEditor").addEventListener("click", (event) => {
    const row = event.target.closest(".section-row");
    if (!row || event.target.closest("[data-toggle-section],[data-delete-section]")) return;
    event.preventDefault();
    event.stopPropagation();
    selectSection(row.dataset.sectionKey);
  }, true);

  $("#sitePreview").addEventListener("load", preparePreview);
  new MutationObserver(() => {
    const message = $("#sectionEditorStatus")?.textContent || "";
    if (/sin publicar|nuevo orden/i.test(message)) setEditorDirty(true);
  }).observe($("#sectionEditorStatus"), { childList: true, characterData: true, subtree: true });
  window.addEventListener("beforeunload", (event) => {
    if (!editorDirty) return;
    event.preventDefault();
    event.returnValue = "";
  });
  $("#closeInspector").addEventListener("click", () => $("#sectionInspector").classList.remove("open"));
  $("#sectionInspectorForm").addEventListener("input", updateSectionFromInspector);
  $("#sectionInspectorForm").addEventListener("change", updateSectionFromInspector);
  $("#sectionInspectorForm").addEventListener("change", (event) => { if (event.target.name === "custom_image" && event.target.files[0]) setCustomSectionImage(event.target.files[0]); });
  $("#sectionInspectorForm").addEventListener("change", (event) => { if (event.target.name === "sticker_image" && event.target.files[0]) addSticker(event.target.files[0]); });
  $("#stickerEditorList").addEventListener("input", (event) => { if (event.target.dataset.stickerField) updateStickerFromControl(event.target); });
  $("#stickerEditorList").addEventListener("change", (event) => { if (event.target.dataset.stickerField) updateStickerFromControl(event.target); });
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
