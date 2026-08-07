(async function(){
  const config=window.FANTASMAS_SUPABASE||{}; const $=s=>document.querySelector(s); const params=new URLSearchParams(location.search); const raffleId=params.get("id");
  const CART_KEY="fantasmas_shop_cart_v1"; let raffle=null; let map=[]; let existingNumbers=new Set(); const selected=new Set();
  const money=v=>new Intl.NumberFormat("es-MX",{style:"currency",currency:"MXN"}).format(Number(v||0));
  const client=window.supabase?.createClient(config.url,config.publishableKey);
  function render(){
    $("#numberMap").innerHTML=map.map(row=>{const status=selected.has(row.number)?"selected":row.status;const disabled=status!=="available"&&status!=="selected";return `<button type="button" data-number="${row.number}" class="${status}" ${disabled?"disabled":""} aria-label="Número ${row.number}, ${status}">${String(row.number).padStart(2,"0")}</button>`}).join("");
    const values=[...selected].sort((a,b)=>a-b); $("#selectedNumbers").textContent=values.length?values.map(n=>String(n).padStart(2,"0")).join(", "):"Ninguno"; $("#selectedTotal").textContent=`${money(values.length*Number(raffle?.price||0))} MXN`; $("#addRaffleCart").disabled=!values.length;
  }
  async function loadMap(){
    $("#mapStatus").textContent="Actualizando disponibilidad…";
    const {data,error}=await client.rpc("get_shop_raffle_number_map",{p_raffle_id:raffleId}); if(error)throw error; map=data||[];
    for(const n of [...selected])if(map.find(x=>x.number===n)?.status!=="available")selected.delete(n); render(); $("#mapStatus").textContent="La disponibilidad se confirma al finalizar el pedido.";
  }
  if(!client||!/^[0-9a-f-]{36}$/i.test(raffleId||"")){ $("#mapStatus").textContent="No pudimos abrir esta rifa."; return; }
  const {data,error}=await client.from("shop_raffles").select("*").eq("id",raffleId).eq("active",true).maybeSingle(); if(error||!data){$("#mapStatus").textContent="Esta rifa no está disponible.";return;} raffle=data;
  try{const stored=JSON.parse(localStorage.getItem(CART_KEY))||[];existingNumbers=new Set(stored.filter(i=>i.kind==="raffle_number"&&i.raffle_id===raffle.id).map(i=>Number(i.number)));}catch(_){}
  $("#raffleTitle").textContent=raffle.main_prize; $("#rafflePrice").textContent=`${money(raffle.price)} por número`; $("#raffleLimit").textContent=`Máximo ${raffle.max_numbers_per_order||5} por pedido · ${existingNumbers.size} ya en tu carrito`;
  if(raffle.image_url){$("#raffleImage").src=raffle.image_url;$("#raffleImage").hidden=false;} if(!raffle.sales_open)$("#mapStatus").textContent="La venta de esta rifa está cerrada.";
  await loadMap().catch(e=>$("#mapStatus").textContent=e.message);
  $("#numberMap").addEventListener("click",e=>{const b=e.target.closest("[data-number]");if(!b||b.disabled||!raffle.sales_open)return;const n=Number(b.dataset.number);if(selected.has(n))selected.delete(n);else if(existingNumbers.has(n))$("#mapStatus").textContent="Ese número ya está en tu carrito.";else if(selected.size+existingNumbers.size<Number(raffle.max_numbers_per_order||5))selected.add(n);else $("#mapStatus").textContent=`Puedes llevar máximo ${raffle.max_numbers_per_order||5} números de esta rifa por pedido.`;render();});
  $("#refreshMap").addEventListener("click",()=>loadMap().catch(e=>$("#mapStatus").textContent=e.message));
  $("#addRaffleCart").addEventListener("click",()=>{let cart=[];try{cart=JSON.parse(localStorage.getItem(CART_KEY))||[]}catch(_){} const chosen=[...selected];cart=cart.filter(i=>!(i.kind==="raffle_number"&&i.raffle_id===raffle.id&&chosen.includes(Number(i.number))));chosen.forEach(number=>cart.push({id:raffle.id,kind:"raffle_number",cart_key:`raffle:${raffle.id}:${number}`,raffle_id:raffle.id,number,name:`Rifa ${raffle.main_prize} · Número ${String(number).padStart(2,"0")}`,price:Number(raffle.price),image_url:raffle.image_url||"",quantity:1}));localStorage.setItem(CART_KEY,JSON.stringify(cart));location.href="index.html?cart=open#rifas";});
})();
