(function(){
  const SESSION_KEY='fantasmas_shop_analytics_session_v1';
  const CART_KEY='fantasmas_shop_cart_v1';
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>[...r.querySelectorAll(s)];
  let sessionId='';
  try{
    sessionId=localStorage.getItem(SESSION_KEY)||crypto.randomUUID();
    localStorage.setItem(SESSION_KEY,sessionId);
  }catch(_){ sessionId=crypto.randomUUID(); }

  let analyticsClient=null;
  function client(){
    if(window.FANTASMAS_DB?.rpc)return window.FANTASMAS_DB;
    if(analyticsClient?.rpc)return analyticsClient;
    const cfg=window.FANTASMAS_SUPABASE;
    if(window.supabase?.createClient&&cfg?.url&&cfg?.publishableKey){analyticsClient=window.supabase.createClient(cfg.url,cfg.publishableKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});return analyticsClient;}
    return null;
  }
  async function track(eventType,{productId=null,orderId=null,query=null,metadata={}}={}){
    const db=client(); if(!db?.rpc)return;
    try{await db.rpc('track_shop_event',{p_event_type:eventType,p_session_id:sessionId,p_product_id:productId,p_order_id:orderId,p_query:query,p_metadata:metadata||{}});}catch(_){}
  }
  window.FANTASMAS_TRACK=track;

  function addTrustStrip(){
    if($('#shopTrustStrip'))return;
    const hero=$('#inicio'); if(!hero)return;
    const strip=document.createElement('section');
    strip.id='shopTrustStrip'; strip.className='shop-trust-strip'; strip.setAttribute('aria-label','Ventajas de comprar en Fantasmas Biker\'s Shop');
    strip.innerHTML='<div><span>🔒</span><b>Pago seguro</b><small>Mercado Pago</small></div><div><span>🏪</span><b>Recoge en tienda</b><small>Cd. Azteca</small></div><div><span>📦</span><b>Envíos</b><small>A todo México</small></div><div><span>🏷️</span><b>Precio vigente</b><small>Promos automáticas</small></div>';
    hero.insertAdjacentElement('afterend',strip);
    const syncTrustStrip = () => {
      const order = hero.style.order || '0';
      strip.style.order = order;
      strip.hidden = hero.hidden || hero.dataset.editorDisabled === 'true';
    };
    syncTrustStrip();
    new MutationObserver(syncTrustStrip).observe(hero,{attributes:true,attributeFilter:['style','hidden','data-editor-disabled']});
    document.addEventListener('fantasmas:sections-applied',syncTrustStrip);
  }

  function detailUrl(product){return `producto.html?id=${encodeURIComponent(product.id)}`;}
  function enhanceCards(){
    const products=Array.isArray(window.FANTASMAS_PRODUCTS)?window.FANTASMAS_PRODUCTS:[];
    $$('.producto-publico').forEach(card=>{
      if(card.dataset.growthReady==='1')return;
      const id=card.dataset.productId; const product=products.find(p=>String(p.id)===String(id)); if(!product)return;
      card.dataset.growthReady='1';
      const info=$('.producto-info',card); if(!info)return;
      const actions=document.createElement('div'); actions.className='product-secondary-actions';
      actions.innerHTML=`<a class="product-detail-link" href="${detailUrl(product)}" data-detail-product="${id}">Ver detalles</a><button class="product-share-link" type="button" data-share-product="${id}">Compartir</button>`;
      info.appendChild(actions);
    });
  }

  async function shareProduct(id){
    const product=(window.FANTASMAS_PRODUCTS||[]).find(p=>String(p.id)===String(id)); if(!product)return;
    const url=new URL(detailUrl(product),location.href).href;
    const data={title:product.name,text:`${product.name} · Fantasmas Biker's Shop`,url};
    try{if(navigator.share)await navigator.share(data);else{await navigator.clipboard.writeText(url);alert('Enlace del producto copiado.');} track('share_product',{productId:product.id});}catch(_){}
  }

  function bindCatalog(){
    const target=$('#productosDinamicos');
    if(target){new MutationObserver(()=>enhanceCards()).observe(target,{childList:true,subtree:true});enhanceCards();}
    document.addEventListener('click',e=>{
      const detail=e.target.closest('[data-detail-product]'); if(detail)track('product_view',{productId:detail.dataset.detailProduct,metadata:{source:'catalog_detail_click'}});
      const share=e.target.closest('[data-share-product]'); if(share){e.preventDefault();shareProduct(share.dataset.shareProduct);}
      const wa=e.target.closest('a[href*="wa.me"]'); if(wa)track('whatsapp_click',{metadata:{source:wa.closest('.producto-publico')?'catalog':'site'}});
    });
    const search=$('#catalogSearch');
    if(search){let timer;search.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(()=>{const q=search.value.trim();if(q.length>=2)track('catalog_search',{query:q,metadata:{results:$$('.producto-publico').length}});},650);});}
  }

  function openCartFromQuery(){
    if(new URLSearchParams(location.search).get('openCart')!=='1')return;
    let tries=0;const timer=setInterval(()=>{tries++;const btn=$('#cartOpenButton');if(btn){clearInterval(timer);btn.click();history.replaceState({},'',location.pathname+location.hash);}else if(tries>30)clearInterval(timer);},150);
  }

  function registerSW(){if('serviceWorker' in navigator && location.protocol==='https:')navigator.serviceWorker.register('./sw.js').catch(()=>{});}

  document.addEventListener('DOMContentLoaded',()=>{addTrustStrip();bindCatalog();openCartFromQuery();registerSW();track('page_view',{metadata:{page:'home'}});});
  window.addEventListener('fantasmas:products-ready',enhanceCards);
})();
