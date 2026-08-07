(function () {
  const config = window.FANTASMAS_SUPABASE;
  const configured = config && config.url && config.publishableKey && !config.url.includes("PON_AQUI") && !config.publishableKey.includes("PON_AQUI");
  const escapeHtml = (text) => String(text || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  const isCustom = (section) => Boolean(section && (section.section_type === "custom" || String(section.section_key || "").startsWith("custom_")));
  const sectionContent = (section) => section?.content && typeof section.content === "object" && !Array.isArray(section.content) ? section.content : {};
  const systemSectionKeys = ["header","hero","announcement","promotions","raffles","anniversary","catalog_intro","products","events","rewards","allies","contact","footer"];
  const safeId = (value, fallback) => /^[A-Za-z][\w:.-]*$/.test(String(value || "")) ? String(value) : fallback;
  const safeMedia = (value) => /^https?:\/\/[^\s]+$/i.test(String(value || "").trim()) ? String(value).trim() : "";
  const safeColor = (value, fallback) => /^#[0-9a-f]{6}$/i.test(String(value || "")) ? String(value) : fallback;
  const safeHref = (value) => {
    const link = String(value || "").trim();
    return /^(?:#[A-Za-z][\w:.-]*|https?:\/\/[^\s]+|mailto:[^\s]+|tel:[+\d]+|\/(?!\/)[^\s]*|\.\.?\/[^\s]+|[\w.-]+\.html(?:[?#].*)?)$/i.test(link) && !/^(?:javascript|data):/i.test(link) ? link : "";
  };
  const linkAttributes = (value) => {
    const link = safeHref(value);
    if (!link) return "";
    return ` href="${escapeHtml(link)}"${/^https?:\/\//i.test(link) ? ' target="_blank" rel="noopener noreferrer"' : ""}`;
  };

  function renderCustomSection(settings) {
    const main = document.querySelector("main");
    if (!main || !isCustom(settings)) return null;
    const content = sectionContent(settings);
    const fallbackId = `seccion-${String(settings.section_key).replace(/^custom_/, "").slice(0, 8)}`;
    const anchorId = safeId(content.anchor_id, fallbackId);
    let section = document.querySelector(`[data-section-key="${settings.section_key}"]`);
    if (!section) {
      section = document.createElement("section");
      main.append(section);
    }
    const theme = ["dark","blue","pink","gradient","custom"].includes(content.theme) ? content.theme : "dark";
    const alignment = ["left","center","right"].includes(content.alignment) ? content.alignment : "left";
    const imagePosition = ["right","left","background","none"].includes(content.image_position) ? content.image_position : "right";
    const sectionHeight = ["auto","compact","normal","large","screen"].includes(content.section_height) ? content.section_height : "auto";
    const contentWidth = ["narrow","normal","wide","full"].includes(content.content_width) ? content.content_width : "normal";
    const backgroundMode = ["solid","gradient"].includes(content.background_mode) ? content.background_mode : "solid";
    const buttonLayout = ["auto","row","stack","grid"].includes(content.button_layout) ? content.button_layout : "auto";
    const buttonAlignment = ["left","center","right","stretch"].includes(content.button_alignment) ? content.button_alignment : alignment;
    const buttonGap = ["small","normal","large"].includes(content.button_gap) ? content.button_gap : "normal";
    const layout = ["grid","featured","compact","carousel"].includes(settings.layout) ? settings.layout : "grid";
    const imageUrl = imagePosition === "none" ? "" : safeMedia(content.image_url);
    const buttons = Array.isArray(content.buttons) ? content.buttons : [];
    section.id = anchorId;
    section.dataset.sectionKey = settings.section_key;
    section.dataset.customSection = "true";
    section.className = `custom-section editable-section custom-theme-${theme} custom-align-${alignment} custom-image-${imagePosition} custom-height-${sectionHeight} custom-width-${contentWidth} custom-bg-${backgroundMode} custom-buttons-${buttonLayout} custom-buttons-align-${buttonAlignment} custom-buttons-gap-${buttonGap} layout-${layout}`;
    section.style.setProperty("--custom-bg", safeColor(content.background_color, "#0d1015"));
    section.style.setProperty("--custom-bg-alt", safeColor(content.background_secondary, "#251136"));
    section.style.setProperty("--custom-text", safeColor(content.text_color, "#ffffff"));
    section.style.setProperty("--custom-accent", safeColor(content.accent_color, "#28a8ff"));
    section.innerHTML = `
      <div class="custom-section-shell${imageUrl ? "" : " custom-without-image"}">
        <div class="custom-section-copy">
          ${content.eyebrow ? `<p class="custom-section-eyebrow">${escapeHtml(content.eyebrow)}</p>` : ""}
          <h2 data-section-title>${escapeHtml(settings.title)}</h2>
          ${settings.subtitle ? `<p class="custom-section-subtitle" data-section-subtitle>${escapeHtml(settings.subtitle)}</p>` : '<p class="custom-section-subtitle" data-section-subtitle></p>'}
          ${content.body ? `<div class="custom-section-body">${escapeHtml(content.body).replace(/\r?\n/g, "<br>")}</div>` : ""}
          ${buttons.length ? `<div class="custom-section-buttons">${buttons.map((button) => {
            const style = ["pink","blue","dark","light","custom"].includes(button.style) ? button.style : "pink";
            const size = ["small","medium","large","full"].includes(button.size) ? button.size : "medium";
            const customStyle = style === "custom" ? ` style="--button-bg:${safeColor(button.background_color, "#ff3da1")};--button-text:${safeColor(button.text_color, "#ffffff")}"` : "";
            return `<a class="custom-section-button custom-button-${style} custom-button-size-${size}"${customStyle}${linkAttributes(button.url)}>${escapeHtml(button.text || "Ver más")}</a>`;
          }).join("")}</div>` : ""}
        </div>
        ${imageUrl ? `<div class="custom-section-media"><img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(content.image_alt || settings.title)}" loading="lazy"></div>` : ""}
      </div>`;
    section.style.order = String(settings.sort_order || 0);
    section.dataset.editorDisabled = settings.enabled ? "false" : "true";
    section.hidden = !settings.enabled;
    return section;
  }

  function renderCustomSections(sectionList) {
    const list = Array.isArray(sectionList) ? sectionList : [];
    const activeKeys = new Set(list.filter(isCustom).map((section) => section.section_key));
    document.querySelectorAll('[data-custom-section="true"]').forEach((section) => {
      if (!activeKeys.has(section.dataset.sectionKey)) section.remove();
    });
    list.filter(isCustom).forEach(renderCustomSection);
  }

  function applySections(data) {
    const list = Array.isArray(data) ? data : [];
    const currentKeys = new Set(list.map((settings) => settings.section_key));
    systemSectionKeys.forEach((sectionKey) => {
      const section = document.querySelector(`[data-section-key="${sectionKey}"]`);
      if (!section || currentKeys.has(sectionKey)) return;
      // Las secciones del sistema forman parte del HTML base y son la copia de
      // recuperación del editor. Nunca deben eliminarse físicamente: si una fila
      // falta en Supabase (por borrado o por una respuesta parcial), se ocultan.
      // Así una actualización posterior puede volver a mostrarlas sin recargar.
      section.dataset.editorDisabled = "true";
      section.hidden = true;
    });
    renderCustomSections(list);
    const state = {};
    list.forEach((settings) => {
      state[settings.section_key] = settings;
      const section = document.querySelector(`[data-section-key="${settings.section_key}"]`);
      if (!section) return;
      section.style.order = String(settings.sort_order);
      section.dataset.editorDisabled = settings.enabled ? "false" : "true";
      section.classList.remove("layout-grid", "layout-featured", "layout-compact", "layout-carousel");
      section.classList.add(`layout-${settings.layout}`);
      section.hidden = !settings.enabled;
      const title = section.querySelector("[data-section-title]");
      const subtitle = section.querySelector("[data-section-subtitle]");
      if (title && Object.prototype.hasOwnProperty.call(settings, "title")) title.textContent = settings.title || "";
      if (subtitle && Object.prototype.hasOwnProperty.call(settings, "subtitle")) subtitle.textContent = settings.subtitle || "";
    });
    window.FANTASMAS_SECTION_STATE = state;
    document.dispatchEvent(new CustomEvent("fantasmas:sections-applied", { detail: { count: list.length } }));
    return list;
  }

  window.FANTASMAS_RENDER_CUSTOM_SECTIONS = renderCustomSections;
  window.FANTASMAS_APPLY_SECTIONS = applySections;

  if (!configured || !window.supabase) {
    window.FANTASMAS_SECTIONS_READY = Promise.resolve([]);
    return;
  }

  const client = window.supabase.createClient(config.url, config.publishableKey);
  window.FANTASMAS_SECTIONS_READY = (async function () {
    const { data, error } = await client.from("shop_sections").select("*").order("sort_order");
    if (error || !data) return [];
    return applySections(data);
  })();
})();
