(async function(){
  const config=window.FANTASMAS_SUPABASE||{};const $=s=>document.querySelector(s);const id=new URLSearchParams(location.search).get("id");const client=window.supabase?.createClient(config.url,config.publishableKey);let lastRevision=-1,countdownTimer=null;
  if(!client||!/^[0-9a-f-]{36}$/i.test(id||"")){ $("#liveMessage").textContent="Enlace de transmisión inválido.";return; }
  const {data:raffle}=await client.from("shop_raffles").select("main_prize").eq("id",id).maybeSingle();if(raffle)$("#liveRaffle").textContent=raffle.main_prize;
  function apply(state){if(!state||state.revision===lastRevision)return;lastRevision=state.revision;clearInterval(countdownTimer);$("#wheel").classList.toggle("spinning",state.phase==="spinning");$("#livePrize").textContent=state.current_prize||"Esperando el inicio…";$("#winnerName").textContent="";
    if(state.phase==="idle"){$("#wheelNumber").textContent="☠";$("#liveMessage").textContent="El sorteo comenzará en breve.";}
    if(state.phase==="countdown"){let n=5;$("#wheelNumber").textContent=n;$("#liveMessage").textContent="Prepárate…";countdownTimer=setInterval(()=>{$("#wheelNumber").textContent=--n>0?n:"¡YA!";if(n<=0)clearInterval(countdownTimer)},1000);}
    if(state.phase==="spinning"){$("#wheelNumber").textContent="?";$("#liveMessage").textContent="Buscando entre los números pagados…";}
    if(state.phase==="winner"){$("#wheelNumber").textContent=String(state.winning_number).padStart(2,"0");$("#winnerName").textContent=state.public_winner?`GANADOR: ${state.public_winner}`:"¡TENEMOS GANADOR!";$("#liveMessage").textContent="Resultado registrado oficialmente.";}
    if(state.phase==="finished"){$("#liveMessage").textContent="Sorteo finalizado · Gracias por participar";}
  }
  async function refresh(){const {data}=await client.from("shop_raffle_live_state").select("*").eq("raffle_id",id).maybeSingle();apply(data);}
  await refresh();client.channel(`raffle-live-${id}`).on("postgres_changes",{event:"UPDATE",schema:"public",table:"shop_raffle_live_state",filter:`raffle_id=eq.${id}`},p=>apply(p.new)).subscribe();setInterval(refresh,5000);
})();
