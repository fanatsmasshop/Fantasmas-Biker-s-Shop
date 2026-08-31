(function () {
  const launcher=document.querySelector("#fantasmaAssistantLauncher"),panel=document.querySelector("#fantasmaAssistant");if(!launcher||!panel)return;
  const messages=document.querySelector("#assistantMessages"),input=document.querySelector("#assistantInput"),form=document.querySelector("#assistantForm"),isAdmin=panel.classList.contains("admin-assistant");
  let products=Array.isArray(window.FANTASMAS_PRODUCTS)?window.FANTASMAS_PRODUCTS:[];
  const money=(value)=>new Intl.NumberFormat("es-MX",{style:"currency",currency:"MXN",maximumFractionDigits:2}).format(Number(value||0));
  const clean=(value)=>String(value||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9ñ]+/g," ").trim();
  const escape=(value)=>String(value||"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
  const stop=new Set(["quiero","busco","buscar","producto","productos","una","uno","unos","unas","para","con","que","tienen","tienes","hay","de","del","la","el","los","las","me","puedes","ayudar","ayuda","ver","mostrar","dame"]);
  function addMessage(text,role="assistant"){const item=document.createElement("div");item.className=`assistant-message ${role}`;item.innerHTML=text;messages.appendChild(item);messages.scrollTop=messages.scrollHeight}
  function openPanel(){panel.hidden=false;launcher.hidden=true;if(!messages.children.length)addMessage(isAdmin?"Hola, jefe. Puedo abrir módulos, revisar promociones, productos y pedidos, y guiarte para actualizar la tienda.":"Hola. Soy el Asistente Fantasma. Puedo ayudarte a buscar productos, promociones, pedidos, horarios, entregas y formas de pago.");setTimeout(()=>input?.focus(),0)}
  function closePanel(){panel.hidden=true;launcher.hidden=false}
  function promos(){return Array.isArray(window.FANTASMAS_AUTOMATIC_PROMOTIONS)?window.FANTASMAS_AUTOMATIC_PROMOTIONS:[]}
  function queryTokens(query){return clean(query).split(/\s+/).filter((word)=>word.length>1&&!stop.has(word))}
  function productAnswer(query){
    const q=clean(query),tokens=queryTokens(query);
    if(!products.length)return "El catálogo todavía está cargando. Intenta de nuevo en unos segundos o usa el buscador de productos.";
    if(!tokens.length)return 'Dime qué buscas, por ejemplo: <b>casco</b>, <b>guantes</b>, <b>playera</b>, <b>rodilleras</b> o escribe un SKU.';
    const scored=products.map((p)=>{const hay=clean(`${p.name} ${p.category} ${p.description} ${p.sku}`);let score=0;tokens.forEach((t)=>{if(hay.includes(t))score+=t.length>4?3:2;if(clean(p.name).includes(t))score+=2;if(clean(p.sku)===t)score+=8});if(hay.includes(q))score+=6;return{p,score}}).filter((x)=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,5);
    if(!scored.length)return "No encontré una coincidencia clara. Prueba con el nombre, categoría o SKU del producto.";
    return `<b>Encontré esto:</b><br>${scored.map(({p})=>`☠ ${escape(p.name)} — <b>${money(p.sale_price??p.price)}</b>`).join("<br>")}<br><br>Puedes localizarlo en el catálogo y agregarlo al carrito.`;
  }
  function publicAnswer(query){
    const q=clean(query);
    if(/\b(hola|buenas|saludos)\b/.test(q))return "Hola. ¿Buscas un producto, una promoción o ayuda con tu pedido?";
    if(/promo|descuento|cupon|codigo/.test(q)){const active=promos();return active.length?`<b>Promociones vigentes:</b><br>${active.map((p)=>`⚡ ${escape(p.title)}${p.discount_value?` — ${p.discount_type==="percentage"?`${p.discount_value}%`:money(p.discount_value)}`:""}`).join("<br>")}<br><br>Los códigos promocionales se validan en el checkout con <b>Aplicar</b>.`:"No tengo una promoción automática vigente cargada ahora mismo. Si tienes un código, puedes validarlo en el checkout."}
    if(/pedido|folio|rastre|seguimiento/.test(q))return 'Entra a <a href="pedido.html">Consultar pedido</a> y escribe tu folio FBS. Ahí verás el estado y los descuentos.';
    if(/horario|abren|cierran|ubicacion|direccion|donde/.test(q))return 'Estamos en Cd. Azteca, Ecatepec. Lunes a viernes de 9:00 a 18:00 y sábado-domingo de 10:00 a 14:00. <a href="https://maps.app.goo.gl/NqPb7tJ6CNmK2Siq6" target="_blank" rel="noopener">Ver ubicación</a>.';
    if(/envio|entrega|paqueter/.test(q))return "Puedes recoger en tienda. También hacemos envíos a todo México; el costo se cotiza según destino.";
    if(/pago|transferencia|tarjeta|mercado/.test(q))return "Puedes pagar mediante Mercado Pago o transferencia, según las opciones disponibles al finalizar tu pedido.";
    if(/whatsapp|humano|persona|asesor/.test(q))return 'Escríbenos por WhatsApp al <a href="https://wa.me/525610329215" target="_blank" rel="noopener">56 1032 9215</a>.';
    return productAnswer(query)
  }
  function clickModule(name){const button=document.querySelector(`.nav-item[data-view="${name}"]`);if(button){button.click();return true}return false}
  function adminAnswer(query){
    const q=clean(query),routes=[["promociones","promotions"],["promocion","promotions"],["productos","products"],["producto","products"],["pedidos","orders"],["pedido","orders"],["editor","editor"],["categorias","categories"],["categoria","categories"],["rifas","raffles"],["rifa","raffles"],["eventos","events"],["evento","events"],["informacion","settings"]],route=routes.find(([word])=>q.includes(word));
    if((/abrir|ir|muestra|lleva|ver/.test(q)||/^promociones?$|^productos?$|^pedidos?$/.test(q))&&route)return clickModule(route[1])?`Abrí el módulo de <b>${route[0]}</b>.`:"No pude abrir ese módulo.";
    if(/nuevo producto|agregar producto|crear producto/.test(q)){clickModule("products");document.querySelector("#newProductButton")?.click();return "Abrí el formulario para crear un producto."}
    if(/nueva promocion|crear promocion|agregar promocion|codigo promocional/.test(q)){clickModule("promotions");document.querySelector("#newPromotionButton")?.click();return "Abrí el formulario de promociones. Elige oferta automática, código o anuncio y guarda."}
    if(/que puedo|ayuda|ayudame/.test(q))return "Puedo abrir <b>Productos, Pedidos, Promociones, Editor, Categorías, Rifas, Eventos e Información</b>, y guiarte en cada módulo.";
    if(/69|imagenes|fotografias|catalogo/.test(q))return "Entra a <b>Productos → Carga rápida</b>, selecciona tus imágenes, revisa nombre, precio y categoría, elimina las que no usarás y guarda el lote.";
    if(/descuento|promo/.test(q))return "Abre <b>Promociones → Nueva promoción</b>. Puedes elegir porcentaje o cantidad fija, compra mínima, vigencia, productos/categorías y límite de usos.";
    return "Prueba: <b>abrir productos</b>, <b>abrir promociones</b>, <b>abrir pedidos</b> o <b>¿qué puedo hacer?</b>"
  }
  const answer=(query)=>isAdmin?adminAnswer(query):publicAnswer(query);
  async function respond(question){addMessage(escape(question),"user");await new Promise((resolve)=>setTimeout(resolve,80));addMessage(answer(question))}
  launcher.addEventListener("click",openPanel);document.querySelector("#fantasmaAssistantClose")?.addEventListener("click",closePanel);
  document.querySelectorAll("[data-assistant-question]").forEach((button)=>button.addEventListener("click",()=>respond(button.dataset.assistantQuestion)));
  form?.addEventListener("submit",async(event)=>{event.preventDefault();const value=input.value.trim();if(!value)return;input.value="";await respond(value);input.focus()});
  window.addEventListener("fantasmas:products-ready",(event)=>{products=Array.isArray(event.detail)?event.detail:products});
})();
