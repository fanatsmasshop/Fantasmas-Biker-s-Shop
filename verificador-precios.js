(function(){
  const $=(s)=>document.querySelector(s);
  let products=[];let cameraStream=null;let detector=null;let promotions=[];let promotionsLoadedAt=0;
  const money=(v)=>new Intl.NumberFormat("es-MX",{style:"currency",currency:"MXN",minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(v||0));
  const clean=(v)=>String(v??"").replace(/^\uFEFF/,"").trim();
  const normalizeCode=(v)=>clean(v).replace(/[\s\u200B-\u200D\uFEFF]/g,"");
  function parseCsv(text){
    const rows=[];let row=[],cell="",quoted=false;
    for(let i=0;i<text.length;i++){
      const c=text[i],n=text[i+1];
      if(c==='"'&&quoted&&n==='"'){cell+='"';i++;continue}
      if(c==='"'){quoted=!quoted;continue}
      if(c===','&&!quoted){row.push(cell);cell="";continue}
      if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&n==='\n')i++;row.push(cell);if(row.some(Boolean))rows.push(row);row=[];cell="";continue}
      cell+=c;
    }
    if(cell||row.length){row.push(cell);rows.push(row)}
    if(!rows.length)return[];
    const headers=rows.shift().map((x)=>clean(x).toLowerCase());
    return rows.map((values)=>Object.fromEntries(headers.map((h,i)=>[h,clean(values[i])]))).map((p)=>({
      name:p.name||p.nombre||"Producto",sku:normalizeCode(p.sku||p.codigo||p.codigo_interno),barcode:normalizeCode(p.barcode||p.codigo_barras),price:Number(p.price||p.precio)
    })).filter((p)=>p.name&&(p.barcode||p.sku)&&Number.isFinite(p.price));
  }
  function show(message,type=""){const el=$("#checkerStatus");el.textContent=message;el.className=`checker-status ${type}`}
  function renderCount(){$("#productCount").textContent=`${products.length} productos`}
  function activeNow(p){const now=Date.now(),start=p?.starts_at?Date.parse(p.starts_at):null,end=p?.ends_at?Date.parse(p.ends_at):null;return p?.active===true&&(!p.starts_at||Number.isFinite(start)&&start<=now)&&(!p.ends_at||Number.isFinite(end)&&end>=now)}
  function applyDiscount(price,type,value){const n=Number(value||0);if(!Number.isFinite(n)||n<=0)return price;return Math.max(0,type==="percentage"?price*(1-Math.min(100,n)/100):price-n)}
  function offerFor(product){
    const original=Number(product.price);let price=original,names=[];
    promotions.filter((p)=>activeNow(p)&&p.scope==="all"&&Number(p.minimum_purchase||0)<=original).forEach((p)=>{price=applyDiscount(price,p.discount_type,p.discount_value);names.push(p.title||"Promoción vigente")});
    price=Math.round(price*100)/100;
    const amount=Math.max(0,Math.round((original-price)*100)/100);
    const percent=original>0&&amount>0?Math.round((amount/original)*1000)/10:0;
    return{price,names,amount,percent};
  }
  function renderLookup(code){
    const value=normalizeCode(code);$("#priceResult").hidden=true;$("#notFound").hidden=true;if(!value)return;
    const found=products.find((p)=>normalizeCode(p.barcode)===value||normalizeCode(p.sku)===value);
    if(!found){$("#notFound").hidden=false;show("Código no encontrado. Verifica que esté completo.","error");return}
    const offer=offerFor(found),original=Number(found.price);
    $("#resultName").textContent=found.name;$("#resultCode").textContent=found.barcode||found.sku;$("#resultOriginalPrice").textContent=money(original);$("#resultPrice").textContent=money(offer.price);
    $("#resultDiscountRow").hidden=offer.amount<=0;$("#resultDiscount").textContent=`−${money(offer.amount)}`;$("#resultDiscountLabel").textContent=offer.percent>0?`Descuento vigente (${Number.isInteger(offer.percent)?offer.percent.toFixed(0):offer.percent.toFixed(1)}%)`:"Descuento vigente";
    $("#resultPromotionNote").hidden=!offer.names.length;$("#resultPromotionNote").textContent=offer.names.length?`✓ ${offer.names.join(" · ")}`:"";$("#priceResult").hidden=false;
    show(offer.amount>0?"Producto encontrado · descuento vigente aplicado":"Producto encontrado","ok");$("#codeInput").select();
  }
  async function lookup(code){await refreshPromotionsIfStale();renderLookup(code)}
  async function loadText(text){products=parseCsv(text);renderCount();show(products.length?`Lista cargada: ${products.length} productos.`:"El CSV no contiene productos válidos.",products.length?"ok":"error")}
  async function loadPromotions(){
    try{
      const config=window.FANTASMAS_SUPABASE;if(!config?.url||!config?.publishableKey||!window.supabase){promotions=[];return}
      const client=window.supabase.createClient(config.url,config.publishableKey);
      const {data,error}=await client.from("shop_promotions").select("title,discount_type,discount_value,scope,minimum_purchase,active,starts_at,ends_at,sort_order,created_at").eq("active",true).eq("scope","all").not("discount_value","is",null).order("sort_order").order("created_at",{ascending:false});
      if(error)throw error;promotions=(data||[]).filter(activeNow);promotionsLoadedAt=Date.now();
    }catch(_){promotions=[];promotionsLoadedAt=Date.now()}
  }
  async function refreshPromotionsIfStale(){if(Date.now()-promotionsLoadedAt>60000)await loadPromotions()}
  async function loadInitial(){
    try{await loadPromotions();const response=await fetch("products.csv",{cache:"no-store"});if(!response.ok)throw Error();await loadText(await response.text());show(`Lista cargada: ${products.length} productos${promotions.length?` · ${promotions.length} descuento(s) global(es) vigente(s)`:""}.`,"ok")}
    catch(_){show("Selecciona el CSV exportado de Aronium para cargar la lista.","error")}
  }
  async function startScan(){
    if(!("BarcodeDetector" in window)){show("Tu navegador no permite escaneo automático. Escribe el código manualmente.","error");return}
    try{detector=new BarcodeDetector({formats:["ean_13","ean_8","code_128","code_39","upc_a","upc_e"]});cameraStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"}}});$("#cameraVideo").srcObject=cameraStream;$("#cameraBox").hidden=false;await $("#cameraVideo").play();scanFrame()}
    catch(_){show("No se pudo abrir la cámara. Revisa el permiso del navegador.","error")}
  }
  async function scanFrame(){if(!cameraStream)return;try{const codes=await detector.detect($("#cameraVideo"));if(codes[0]?.rawValue){$("#codeInput").value=codes[0].rawValue;stopScan();await lookup(codes[0].rawValue);return}}catch(_){}requestAnimationFrame(scanFrame)}
  function stopScan(){cameraStream?.getTracks().forEach((track)=>track.stop());cameraStream=null;if($("#cameraVideo"))$("#cameraVideo").srcObject=null;$("#cameraBox").hidden=true}
  $("#lookupForm").addEventListener("submit",async(e)=>{e.preventDefault();const button=e.currentTarget.querySelector("button");button.disabled=true;try{await lookup($("#codeInput").value)}finally{button.disabled=false}});
  $("#scanButton").addEventListener("click",startScan);$("#stopScanButton").addEventListener("click",stopScan);$("#csvInput").addEventListener("change",async(e)=>{const file=e.target.files[0];if(file)await loadText(await file.text())});
  setInterval(loadPromotions,60000);window.addEventListener("pagehide",stopScan);loadInitial();
})();
