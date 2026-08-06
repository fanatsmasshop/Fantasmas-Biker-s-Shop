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
  const isCustomSection = (section) => Boolean(section && (section.section_type === "custom" || section.section_key.startsWith("custom_")));
  const customContent = (section) => {
    const value = section?.content;
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  };
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
    if (!selectedSectionKey && sections.length) selectSection(sections[0].section_key);
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
      <article class="section-row${section.section_key === selectedSectionKey ? " selected" : ""}" data-section-key="${safe(section.section_key)}" draggable="${fixedSections.has(section.section_key) ? "false" : "true"}">
        <span class="drag-handle" title="${fixedSections.has(section.section_key) ? "Posición fija" : "Arrastrar"}">${fixedSections.has(section.section_key) ? "🔒" : "⠿"}</span>
        <div class="section-identity"><b>${safe(section.label)}</b><small>${safe(section.enabled ? `${section.layout}${isCustomSection(section) ? " · PERSONALIZADA" : ""}` : "OCULTA")}</small></div>
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

  function normalizeCustomContent(section) {
    const current = customContent(section);
    const anchorId = current.anchor_id || `seccion-${section.section_key.replace(/^custom_/, "").slice(0, 8)}`;
    section.content = {
      anchor_id: anchorId,
      eyebrow: current.eyebrow || "SECCIÓN PERSONALIZADA",
      body: current.body || "",
      theme: ["dark","blue","pink","gradient"].includes(current.theme) ? current.theme : "dark",
      alignment: ["left","center","right"].includes(current.alignment) ? current.alignment : "left",
      image_position: ["right","left","background","none"].includes(current.image_position) ? current.image_position : "right",
      image_url: current.image_url || "",
      image_path: current.image_path || "",
      image_alt: current.image_alt || "",
      buttons: Array.isArray(current.buttons) ? current.buttons.map((button) => ({
        id: button.id || crypto.randomUUID(),
        text: button.text || "Botón",
        url: button.url || "",
        style: ["pink","blue","dark","light"].includes(button.style) ? button.style : "pink"
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
    form.elements.custom_alignment.value = content.alignment;
    form.elements.custom_image_position.value = content.image_position;
    form.elements.custom_image_alt.value = content.image_alt;
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
        <label>Estilo<select data-custom-button-style><option value="pink"${button.style === "pink" ? " selected" : ""}>Rosa</option><option value="blue"${button.style === "blue" ? " selected" : ""}>Azul</option><option value="dark"${button.style === "dark" ? " selected" : ""}>Oscuro</option><option value="light"${button.style === "light" ? " selected" : ""}>Claro</option></select></label>
        <label>Destino<input name="custom_button_${safe(button.id)}_url" data-custom-button-url value="${safe(button.url)}" maxlength="500"></label>
      </article>`).join("") : '<div class="custom-buttons-empty">Esta sección todavía no tiene botones.</div>';
    enhanceLinkInputs($("#customButtonsEditor"));
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
    if (isCustomSection(section)) {
      const content = normalizeCustomContent(section);
      section.label = form.elements.custom_label.value.trim() || "Sección personalizada";
      content.eyebrow = form.elements.custom_eyebrow.value;
      content.body = form.elements.custom_body.value;
      content.theme = form.elements.custom_theme.value;
      content.alignment = form.elements.custom_alignment.value;
      content.image_position = form.elements.custom_image_position.value;
      content.image_alt = form.elements.custom_image_alt.value;
      content.buttons = $$("[data-custom-button]", $("#customButtonsEditor")).map((row) => ({
        id: row.dataset.customButton,
        text: $("[data-custom-button-text]", row).value.trim() || "Botón",
        url: $("[data-custom-button-url]", row).value.trim(),
        style: $("[data-custom-button-style]", row).value
      }));
      $("#inspectorSectionName").textContent = section.label;
    }
    $$('[data-setting-key]', form).forEach((input) => storeSettings[input.dataset.settingKey] = input.value);
    renderSections();
    applyPreviewSections();
    $("#sectionEditorStatus").textContent = "Cambios sin publicar";
  }

  function createCustomSection() {
    if (!customSchemaReady) return notify("Ejecuta database_custom_sections.sql en Supabase antes de crear secciones.", true);
    const id = crypto.randomUUID().replaceAll("-", "");
    const section = {
      section_key: `custom_${id}`,
      label: "Nueva sección",
      title: "NUEVA SECCIÓN",
      subtitle: "Edita este texto desde el panel.",
      enabled: true,
      sort_order: 0,
      layout: "grid",
      section_type: "custom",
      content: {
        anchor_id: `seccion-${id.slice(0, 8)}`,
        eyebrow: "SECCIÓN PERSONALIZADA",
        body: "Agrega información, una imagen y los botones que necesites.",
        theme: "dark",
        alignment: "left",
        image_position: "right",
        image_url: "",
        image_path: "",
        image_alt: "",
        buttons: []
      }
    };
    const footerIndex = sections.findIndex((item) => item.section_key === "footer");
    sections.splice(footerIndex >= 0 ? footerIndex : sections.length, 0, section);
    selectedSectionKey = section.section_key;
    renderSections();
    selectSection(section.section_key);
    applyPreviewSections();
    $("#sectionEditorStatus").textContent = "Nueva sección sin publicar";
    notify("Sección creada. Edítala y pulsa Publicar cambios.");
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
    content.buttons.push({ id: crypto.randomUUID(), text: "Nuevo botón", url: "#inicio", style: "pink" });
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

  function deleteCustomSection() {
    const section = selectedCustomSection();
    if (!section || !confirm(`¿Eliminar la sección “${section.label}”?`)) return;
    const content = normalizeCustomContent(section);
    if (content.image_path) pendingMediaRemovals.add(content.image_path);
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
    bindPreviewSectionClicks(doc);
    applyPreviewSections();
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
    const previewSections = sections.map((settings, index) => ({ ...settings, sort_order: (index + 1) * 10 }));
    const previewWindow = $("#sitePreview").contentWindow;
    if (typeof previewWindow?.FANTASMAS_APPLY_SECTIONS === "function") previewWindow.FANTASMAS_APPLY_SECTIONS(previewSections);
    else if (typeof previewWindow?.FANTASMAS_RENDER_CUSTOM_SECTIONS === "function") previewWindow.FANTASMAS_RENDER_CUSTOM_SECTIONS(previewSections);
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
    if (button.id === "newSectionButton") createCustomSection();
    if (button.id === "addCustomButton") addCustomButton();
    if (button.id === "removeCustomImage") removeCustomSectionImage();
    if (button.id === "deleteCustomSection") deleteCustomSection();
    if (button.dataset.removeCustomButton !== undefined) changeCustomButton(button.closest("[data-custom-button]")?.dataset.customButton, "remove");
    if (button.dataset.moveCustomButton) changeCustomButton(button.closest("[data-custom-button]")?.dataset.customButton, button.dataset.moveCustomButton);
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
  $("#sectionInspectorForm").addEventListener("change", (event) => { if (event.target.name === "custom_image" && event.target.files[0]) setCustomSectionImage(event.target.files[0]); });
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
