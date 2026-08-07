(async function () {
  const config = window.FANTASMAS_SUPABASE || {};
  const $ = (selector) => document.querySelector(selector);
  const raffleId = new URLSearchParams(location.search).get("id");
  const client = window.supabase?.createClient(config.url, config.publishableKey);
  let lastRevision = -1;
  let countdownTimer = null;
  let rollingTimer = null;
  let totalNumbers = 20;
  let lastPhase = "";

  function stopTimers() {
    clearInterval(countdownTimer);
    clearInterval(rollingTimer);
    countdownTimer = null;
    rollingTimer = null;
  }

  function renderWheelNumbers(total) {
    const visibleTotal = Math.max(1, Math.min(40, Number(total) || 20));
    $("#wheelNumbers").innerHTML = Array.from({ length: visibleTotal }, (_, index) => {
      const number = index + 1;
      const angle = (360 / visibleTotal) * index;
      return `<span style="--angle:${angle}deg">${String(number).padStart(2, "0")}</span>`;
    }).join("");
  }

  function rollNumbers() {
    clearInterval(rollingTimer);
    rollingTimer = setInterval(() => {
      const number = Math.floor(Math.random() * totalNumbers) + 1;
      $("#wheelNumber").textContent = String(number).padStart(2, "0");
    }, 72);
  }

  function celebrate() {
    const layer = $("#celebration");
    const colors = ["#159cff", "#ff2d9d", "#ffffff", "#aab1bc"];
    layer.className = "celebration flash";
    layer.innerHTML = Array.from({ length: 70 }, (_, index) => {
      const angle = (Math.PI * 2 * index) / 70;
      const distance = 180 + Math.random() * 620;
      const x = Math.cos(angle) * distance;
      const y = Math.sin(angle) * distance;
      return `<i style="--x:${x}px;--y:${y}px;--rotation:${Math.random() * 360}deg;--particle:${colors[index % colors.length]}"></i>`;
    }).join("");
    setTimeout(() => { layer.className = "celebration"; layer.innerHTML = ""; }, 2100);
  }

  function showWinner(state) {
    const wheel = $("#wheel");
    wheel.classList.remove("spinning");
    void wheel.offsetWidth;
    wheel.classList.add("winner-hit");
    setTimeout(() => wheel.classList.remove("winner-hit"), 2100);
    $("#wheelNumber").textContent = String(state.winning_number).padStart(2, "0");
    $("#winnerName").textContent = state.public_winner
      ? `GANADOR: ${state.public_winner}`
      : "¡TENEMOS GANADOR!";
    $("#liveMessage").textContent = "Resultado registrado oficialmente entre los números pagados.";
    $("#winnerCard").classList.add("winner-reveal");
    celebrate();
  }

  function applyState(state) {
    if (!state || state.revision === lastRevision) return;
    const phaseChanged = state.phase !== lastPhase;
    lastRevision = state.revision;
    lastPhase = state.phase;
    stopTimers();
    $("#wheel").classList.remove("spinning", "winner-hit");
    $("#winnerCard").classList.remove("winner-reveal");
    $("#livePrize").textContent = state.current_prize || "Esperando el inicio…";
    $("#winnerName").textContent = "La rodada está por comenzar";

    if (state.phase === "idle") {
      $("#wheelNumber").textContent = "☠";
      $("#liveMessage").textContent = "El sorteo oficial comenzará en breve.";
    }

    if (state.phase === "countdown") {
      let count = 5;
      $("#wheelNumber").textContent = count;
      $("#winnerName").textContent = "PREPÁRATE";
      $("#liveMessage").textContent = "Verificando participantes pagados…";
      countdownTimer = setInterval(() => {
        count -= 1;
        $("#wheelNumber").textContent = count > 0 ? count : "¡YA!";
        if (count <= 0) clearInterval(countdownTimer);
      }, 1000);
    }

    if (state.phase === "spinning") {
      $("#wheel").classList.add("spinning");
      $("#winnerName").textContent = "LA SUERTE ESTÁ RODANDO";
      $("#liveMessage").textContent = "Seleccionando de forma segura entre los números pagados…";
      rollNumbers();
    }

    if (state.phase === "winner") showWinner(state);

    if (state.phase === "finished") {
      $("#wheelNumber").textContent = state.winning_number
        ? String(state.winning_number).padStart(2, "0")
        : "☠";
      $("#winnerName").textContent = "SORTEO FINALIZADO";
      $("#liveMessage").textContent = "Gracias por rodar y celebrar con Fantasmas Biker's Shop.";
    }

    if (!phaseChanged && state.phase === "winner") {
      $("#winnerCard").classList.add("winner-reveal");
    }
  }

  async function refresh() {
    const { data } = await client
      .from("shop_raffle_live_state")
      .select("*")
      .eq("raffle_id", raffleId)
      .maybeSingle();
    applyState(data);
  }

  if (!client || !/^[0-9a-f-]{36}$/i.test(raffleId || "")) {
    $("#liveMessage").textContent = "Enlace de transmisión inválido.";
    return;
  }

  const { data: raffle } = await client
    .from("shop_raffles")
    .select("main_prize,total_numbers")
    .eq("id", raffleId)
    .maybeSingle();

  if (raffle) {
    totalNumbers = Number(raffle.total_numbers) || 20;
    $("#liveRaffle").textContent = raffle.main_prize;
  }
  renderWheelNumbers(totalNumbers);

  const clock = () => {
    $("#liveClock").textContent = new Intl.DateTimeFormat("es-MX", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    }).format(new Date());
  };
  clock();
  setInterval(clock, 1000);

  await refresh();
  client
    .channel(`raffle-live-${raffleId}`)
    .on("postgres_changes", {
      event: "UPDATE",
      schema: "public",
      table: "shop_raffle_live_state",
      filter: `raffle_id=eq.${raffleId}`
    }, (payload) => applyState(payload.new))
    .subscribe();

  setInterval(refresh, 5000);
})();
