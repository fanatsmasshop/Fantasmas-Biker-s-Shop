(function () {
  const config = window.FANTASMAS_SUPABASE || {};
  const configured = config.url && config.publishableKey &&
    !config.url.includes("PON_AQUI") && !config.publishableKey.includes("PON_AQUI");

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const loginView = $("#loginView");
  const adminApp = $("#adminApp");
  let client = null;
  let products = [];
  let promotions = [];

  function toast(message, error = false) {
    const element = $("#toast");
    element.textContent = message;
    element.className = `toast show${error ? " error" : ""}`;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => element.className = "toast", 3200);
  }

  function escapeHtml(text) {
    return String(text || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }

  function money(value) {
    if (value === null || value === undefined || value === "") return "Consultar";
    return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(value);
  }

  function toLocalInput(value) {
    if (!value) return "";
    const date = new Date(value);
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  }

  function showConfigurationError() {
    $("#loginMessage").innerHTML = "Falta configurar <b>supabase-config.js</b> con Project URL y Publishable key.";
    $$("#loginForm input, #loginForm button").forEach((el) => el.disabled = true);
  }

  async function verifyAdmin(user) {
    if (!user) return false;
    const { data, error } = await client.from("shop_admins").select("user_id").eq("user_id", user.id).maybeSingle();
    return !error && Boolean(data);
  }

  async function enterApp(user) {
    const allowed = await verifyAdmin(user);
    if (!allowed) {
      await client.auth.signOut();
      $("#loginMessage").textContent = "Este usuario existe, pero no tiene permiso de administrador.";
      return;
    }
    loginView.hidden = true;
    adminApp.hidden = false;
    $("#adminEmail").textContent = user.email || "Administrador";
    await loadAll();
  }

  async function initialize() {
    if (!configured || !window.supabase) return showConfigurationError();
    client = window.supabase.createClient(config.url, config.publishableKey);

    const { data } = await client.auth.getSession();
    if (data.session?.user) await enterApp(data.session.user);

    $("#loginForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      $("#loginMessage").textContent = "Comprobando acceso...";
      const { data: result, error } = await client.auth.signInWithPassword({
        email: $("#loginEmail").value.trim(),
        password: $("#loginPassword").value
      });
      if (error) {
        $("#loginMessage").textContent = "Correo o contraseña incorrectos.";
        return;
      }
      await enterApp(result.user);
    });
  }

  async function loadAll() {
    await Promise.all([loadProducts(), loadPromotions(), loadSettings()]);
    updateStats();
  }

  async function loadProducts() {
    const { data, error } = await client.from("shop_products").select("*").order("sort_order").order("created_at", { ascending: false });
    if (error) return toast(`No se pudieron cargar los productos: ${error.message}`, true);
    products = data || [];
    renderProducts();
  }

  async function loadPromotions() {
    const { data, error } = await client.from("shop_promotions").select("*").order("sort_order").order("created_at", { ascending: false });
    if (error) return toast(`No se pudieron cargar las promociones: ${error.message}`, true);
    promotions = data || [];
    renderPromotions();
  }

  async function loadSettings() {
    const { data, error } = await client.from("shop_settings").select("setting_value").eq("setting_key", "store_info").maybeSingle();
    if (error || !data) return;
    const form = $("#settingsForm");
    Object.entries(data.setting_value || {}).forEach(([key, value]) => {
      if (form.elements[key]) form.elements[key].value = value || "";
    });
  }

  function updateStats() {
    $("#totalProducts").textContent = products.length;
    $("#activeProducts").textContent = `${products.filter((p) => p.active).length} activos`;
    $("#featuredProducts").textContent = products.filter((p) => p.featured && p.active).length;
    $("#totalPromotions").textContent = promotions.length;
    $("#activePromotions").textContent = `${promotions.filter((p) => p.active).length} activas`;
  }

  function renderProducts() {
    const search = $("#productSearch").value.trim().toLowerCase();
    const filter = $("#productFilter").value;
    const visible = products.filter((product) => {
      const matchSearch = !search || `${product.name} ${product.category}`.toLowerCase().includes(search);
      const matchFilter = filter === "all" ||
        (filter === "active" && product.active) ||
        (filter === "inactive" && !product.active) ||
        (filter === "featured" && product.featured);
      return matchSearch && matchFilter;
    });

    $("#productsList").innerHTML = visible.length ? visible.map((product) => `
      <article class="list-card">
        <div class="list-image">${product.image_url ? `<img src="${escapeHtml(product.image_url)}" alt="">` : "☠"}</div>
        <div class="list-main"><h3>${escapeHtml(product.name)} · ${money(product.price)}</h3><p>${escapeHtml(product.category)} · Orden ${product.sort_order}</p><div class="badges"><span class="badge ${product.active ? "active" : "inactive"}">${product.active ? "VISIBLE" : "OCULTO"}</span>${product.featured ? '<span class="badge featured">DESTACADO</span>' : ""}</div></div>
        <div class="list-actions"><button data-edit-product="${product.id}">Editar</button><button data-toggle-product="${product.id}">${product.active ? "Ocultar" : "Mostrar"}</button><button class="delete" data-delete-product="${product.id}">Eliminar</button></div>
      </article>`).join("") : '<div class="empty">No hay productos que coincidan.</div>';
  }

  function renderPromotions() {
    $("#promotionsList").innerHTML = promotions.length ? promotions.map((promo) => `
      <article class="list-card">
        <div class="list-image">${promo.image_url ? `<img src="${escapeHtml(promo.image_url)}" alt="">` : "⚡"}</div>
        <div class="list-main"><h3>${escapeHtml(promo.title)}</h3><p>${escapeHtml(promo.badge)} · Orden ${promo.sort_order}${promo.ends_at ? ` · Termina ${new Date(promo.ends_at).toLocaleDateString("es-MX")}` : ""}</p><div class="badges"><span class="badge ${promo.active ? "active" : "inactive"}">${promo.active ? "ACTIVA" : "INACTIVA"}</span></div></div>
        <div class="list-actions"><button data-edit-promotion="${promo.id}">Editar</button><button data-toggle-promotion="${promo.id}">${promo.active ? "Desactivar" : "Activar"}</button><button class="delete" data-delete-promotion="${promo.id}">Eliminar</button></div>
      </article>`).join("") : '<div class="empty">Aún no has creado promociones.</div>';
  }

  function openProduct(product = null) {
    const form = $("#productForm");
    form.reset();
    form.elements.active.checked = true;
    form.elements.sort_order.value = 0;
    $("#productDialogTitle").textContent = product ? "Editar producto" : "Nuevo producto";
    if (product) {
      ["id","name","category","description","price","previous_price","sort_order"].forEach((key) => form.elements[key].value = product[key] ?? "");
      form.elements.current_image_url.value = product.image_url || "";
      form.elements.current_image_path.value = product.image_path || "";
      form.elements.active.checked = product.active;
      form.elements.featured.checked = product.featured;
    }
    $("#productStatus").textContent = "";
    $("#productDialog").showModal();
  }

  function openPromotion(promo = null) {
    const form = $("#promotionForm");
    form.reset();
    form.elements.active.checked = true;
    form.elements.badge.value = "PROMOCIÓN";
    form.elements.button_text.value = "Pedir por WhatsApp";
    form.elements.button_url.value = "https://wa.me/525610329215";
    form.elements.sort_order.value = 0;
    $("#promotionDialogTitle").textContent = promo ? "Editar promoción" : "Nueva promoción";
    if (promo) {
      ["id","title","subtitle","badge","button_text","button_url","sort_order"].forEach((key) => form.elements[key].value = promo[key] ?? "");
      form.elements.starts_at.value = toLocalInput(promo.starts_at);
      form.elements.ends_at.value = toLocalInput(promo.ends_at);
      form.elements.current_image_url.value = promo.image_url || "";
      form.elements.current_image_path.value = promo.image_path || "";
      form.elements.active.checked = promo.active;
    }
    $("#promotionStatus").textContent = "";
    $("#promotionDialog").showModal();
  }

  async function uploadImage(file, folder) {
    if (!file || file.size === 0) return null;
    if (file.size > 5 * 1024 * 1024) throw new Error("La imagen supera el límite de 5 MB.");
    const extension = file.name.split(".").pop().toLowerCase();
    const path = `${folder}/${crypto.randomUUID()}.${extension}`;
    const { error } = await client.storage.from("shop-media").upload(path, file, { cacheControl: "3600", upsert: false });
    if (error) throw error;
    const { data } = client.storage.from("shop-media").getPublicUrl(path);
    return { path, url: data.publicUrl };
  }

  async function removeImage(path) {
    if (!path) return;
    await client.storage.from("shop-media").remove([path]);
  }

  $("#productForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const status = $("#productStatus");
    status.textContent = "Guardando...";
    try {
      const file = form.elements.image.files[0];
      const uploaded = await uploadImage(file, "products");
      const payload = {
        name: form.elements.name.value.trim(), category: form.elements.category.value.trim(),
        description: form.elements.description.value.trim(),
        price: form.elements.price.value ? Number(form.elements.price.value) : null,
        previous_price: form.elements.previous_price.value ? Number(form.elements.previous_price.value) : null,
        sort_order: Number(form.elements.sort_order.value || 0), active: form.elements.active.checked,
        featured: form.elements.featured.checked, updated_at: new Date().toISOString(),
        image_url: uploaded?.url || form.elements.current_image_url.value || null,
        image_path: uploaded?.path || form.elements.current_image_path.value || null
      };
      const id = form.elements.id.value;
      const query = id ? client.from("shop_products").update(payload).eq("id", id) : client.from("shop_products").insert(payload);
      const { error } = await query;
      if (error) throw error;
      if (uploaded && form.elements.current_image_path.value) await removeImage(form.elements.current_image_path.value);
      $("#productDialog").close(); await loadProducts(); updateStats(); toast("Producto guardado correctamente.");
    } catch (error) { status.textContent = error.message; }
  });

  $("#promotionForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const status = $("#promotionStatus");
    status.textContent = "Guardando...";
    try {
      const file = form.elements.image.files[0];
      const uploaded = await uploadImage(file, "promotions");
      const payload = {
        title: form.elements.title.value.trim(), subtitle: form.elements.subtitle.value.trim(), badge: form.elements.badge.value.trim(),
        button_text: form.elements.button_text.value.trim(), button_url: form.elements.button_url.value.trim(),
        starts_at: form.elements.starts_at.value ? new Date(form.elements.starts_at.value).toISOString() : null,
        ends_at: form.elements.ends_at.value ? new Date(form.elements.ends_at.value).toISOString() : null,
        sort_order: Number(form.elements.sort_order.value || 0), active: form.elements.active.checked, updated_at: new Date().toISOString(),
        image_url: uploaded?.url || form.elements.current_image_url.value || null,
        image_path: uploaded?.path || form.elements.current_image_path.value || null
      };
      const id = form.elements.id.value;
      const query = id ? client.from("shop_promotions").update(payload).eq("id", id) : client.from("shop_promotions").insert(payload);
      const { error } = await query;
      if (error) throw error;
      if (uploaded && form.elements.current_image_path.value) await removeImage(form.elements.current_image_path.value);
      $("#promotionDialog").close(); await loadPromotions(); updateStats(); toast("Promoción guardada correctamente.");
    } catch (error) { status.textContent = error.message; }
  });

  $("#settingsForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const value = Object.fromEntries(new FormData(form).entries());
    $("#settingsStatus").textContent = "Guardando...";
    const { error } = await client.from("shop_settings").upsert({ setting_key: "store_info", setting_value: value, updated_at: new Date().toISOString() });
    $("#settingsStatus").textContent = error ? error.message : "Información guardada.";
    if (!error) toast("Información pública actualizada.");
  });

  document.addEventListener("click", async (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    if (button.matches("[data-edit-product]")) openProduct(products.find((p) => p.id === button.dataset.editProduct));
    if (button.matches("[data-edit-promotion]")) openPromotion(promotions.find((p) => p.id === button.dataset.editPromotion));
    if (button.matches("[data-toggle-product]")) {
      const item = products.find((p) => p.id === button.dataset.toggleProduct);
      const { error } = await client.from("shop_products").update({ active: !item.active, updated_at: new Date().toISOString() }).eq("id", item.id);
      if (!error) { await loadProducts(); updateStats(); }
    }
    if (button.matches("[data-toggle-promotion]")) {
      const item = promotions.find((p) => p.id === button.dataset.togglePromotion);
      const { error } = await client.from("shop_promotions").update({ active: !item.active, updated_at: new Date().toISOString() }).eq("id", item.id);
      if (!error) { await loadPromotions(); updateStats(); }
    }
    if (button.matches("[data-delete-product]")) {
      const item = products.find((p) => p.id === button.dataset.deleteProduct);
      if (!confirm(`¿Eliminar definitivamente “${item.name}”?`)) return;
      const { error } = await client.from("shop_products").delete().eq("id", item.id);
      if (!error) { await removeImage(item.image_path); await loadProducts(); updateStats(); toast("Producto eliminado."); }
    }
    if (button.matches("[data-delete-promotion]")) {
      const item = promotions.find((p) => p.id === button.dataset.deletePromotion);
      if (!confirm(`¿Eliminar definitivamente “${item.title}”?`)) return;
      const { error } = await client.from("shop_promotions").delete().eq("id", item.id);
      if (!error) { await removeImage(item.image_path); await loadPromotions(); updateStats(); toast("Promoción eliminada."); }
    }
  });

  $$(".nav-item").forEach((button) => button.addEventListener("click", () => {
    $$(".nav-item").forEach((item) => item.classList.remove("active")); button.classList.add("active");
    $$(".view").forEach((view) => view.classList.remove("active")); $(`#view-${button.dataset.view}`).classList.add("active");
    $("#viewTitle").textContent = button.querySelector("span").textContent; $("#sidebar").classList.remove("open");
  }));
  $$(".close-dialog").forEach((button) => button.addEventListener("click", () => button.closest("dialog").close()));
  $("#newProductButton").addEventListener("click", () => openProduct());
  $("#newPromotionButton").addEventListener("click", () => openPromotion());
  $("#productSearch").addEventListener("input", renderProducts);
  $("#productFilter").addEventListener("change", renderProducts);
  $$(".refresh-data").forEach((button) => button.addEventListener("click", loadAll));
  $("#openMenu").addEventListener("click", () => $("#sidebar").classList.add("open"));
  $("#closeMenu").addEventListener("click", () => $("#sidebar").classList.remove("open"));
  $("#logoutButton").addEventListener("click", async () => { await client.auth.signOut(); location.reload(); });

  initialize();
})();

