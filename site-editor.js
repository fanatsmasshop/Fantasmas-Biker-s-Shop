(function () {
  const config = window.FANTASMAS_SUPABASE;
  const configured = config && config.url && config.publishableKey && !config.url.includes("PON_AQUI") && !config.publishableKey.includes("PON_AQUI");
  const escapeHtml = (text) => String(text || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  const isCustom = (section) => Boolean(section && (section.section_type === "custom" || String(section.section_key || "").startsWith("custom_")));
  const sectionContent = (section) => section?.content && typeof section.content === "object" && !Array.isArray(section.content) ? section.content : {};
  const safeId = (value, fallback) => /^[A-Za-z][\w:.-]*$/.test(String(value || "")) ? String(value) : fallback;
  const safeMedia = (value) => /^https?:\/\/[^\s]+$/i.test(String(value || "").trim()) ? String(value).trim() : "";
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
    const theme = ["dark","blue","pink","gradient"].includes(content.theme) ? content.theme : "dark";
    const alignment = ["left","center","right"].includes(content.alignment) ? content.alignment : "left";
    const imagePosition = ["right","left","background","none"].includes(content.image_position) ? content.image_position : "right";
    const imageUrl = imagePosition === "none" ? "" : safeMedia(content.image_url);
    const buttons = Array.isArray(content.buttons) ? content.buttons : [];
    section.id = anchorId;
    section.dataset.sectionKey = settings.section_key;
    section.dataset.customSection = "true";
    section.className = `custom-section editable-section custom-theme-${theme} custom-align-${alignment} custom-image-${imagePosition} layout-${settings.layout || "grid"}`;
    section.innerHTML = `
      <div class="custom-section-shell${imageUrl ? "" : " custom-without-image"}">
        <div class="custom-section-copy">
          ${content.eyebrow ? `<p class="custom-section-eyebrow">${escapeHtml(content.eyebrow)}</p>` : ""}
          <h2 data-section-title>${escapeHtml(settings.title)}</h2>
          ${settings.subtitle ? `<p class="custom-section-subtitle" data-section-subtitle>${escapeHtml(settings.subtitle)}</p>` : '<p class="custom-section-subtitle" data-section-subtitle></p>'}
          ${content.body ? `<div class="custom-section-body">${escapeHtml(content.body).replace(/\r?\n/g, "<br>")}</div>` : ""}
          ${buttons.length ? `<div class="custom-section-buttons">${buttons.map((button) => `<a class="custom-section-button custom-button-${["pink","blue","dark","light"].includes(button.style) ? button.style : "pink"}"${linkAttributes(button.url)}>${escapeHtml(button.text || "Ver más")}</a>`).join("")}</div>` : ""}
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
    renderCustomSections(data);
    const state = {};
    data.forEach((settings) => {
      state[settings.section_key] = settings;
      const section = document.querySelector(`[data-section-key="${settings.section_key}"]`);
      if (!section) return;
      section.style.order = String(settings.sort_order);
      section.dataset.editorDisabled = settings.enabled ? "false" : "true";
      section.classList.remove("layout-grid", "layout-featured", "layout-compact", "layout-carousel");
      section.classList.add(`layout-${settings.layout}`);
      if (!settings.enabled) section.hidden = true;
      if (isCustom(settings) && settings.enabled) section.hidden = false;
      const title = section.querySelector("[data-section-title]");
      const subtitle = section.querySelector("[data-section-subtitle]");
      if (title && Object.prototype.hasOwnProperty.call(settings, "title")) title.textContent = settings.title || "";
      if (subtitle && Object.prototype.hasOwnProperty.call(settings, "subtitle")) subtitle.textContent = settings.subtitle || "";
    });
    window.FANTASMAS_SECTION_STATE = state;
    return data;
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
