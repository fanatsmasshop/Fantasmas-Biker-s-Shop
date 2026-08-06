(function () {
  const config = window.FANTASMAS_SUPABASE;
  const configured = config && config.url && config.publishableKey && !config.url.includes("PON_AQUI") && !config.publishableKey.includes("PON_AQUI");
  if (!configured || !window.supabase) {
    window.FANTASMAS_SECTIONS_READY = Promise.resolve([]);
    return;
  }

  const client = window.supabase.createClient(config.url, config.publishableKey);
  window.FANTASMAS_SECTIONS_READY = (async function () {
    const { data, error } = await client.from("shop_sections").select("*").order("sort_order");
    if (error || !data) return [];

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
      const title = section.querySelector("[data-section-title]");
      const subtitle = section.querySelector("[data-section-subtitle]");
      if (title && settings.title) title.textContent = settings.title;
      if (subtitle && settings.subtitle) subtitle.textContent = settings.subtitle;
    });
    window.FANTASMAS_SECTION_STATE = state;
    return data;
  })();
})();

