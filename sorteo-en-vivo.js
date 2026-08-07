(async function () {
  const config = window.FANTASMAS_SUPABASE || {};
  const $ = (selector) => document.querySelector(selector);
  const query = new URLSearchParams(location.search);
  const raffleId = query.get("id");
  const isDemo = query.get("demo") === "1";
  const client = window.supabase?.createClient(config.url, config.publishableKey);
  let lastRevision = -1;
  let countdownTimer = null;
  let rollingTimer = null;
  let totalNumbers = 20;
  let lastPhase = "";
  let wheelStep = 18;
  let wheelStopAnimation = null;
  let winnerRevealTimer = null;

  function stopTimers() {
    clearInterval(countdownTimer);
    clearInterval(rollingTimer);
    clearTimeout(winnerRevealTimer);
    countdownTimer = null;
    rollingTimer = null;
    winnerRevealTimer = null;
    if (wheelStopAnimation) {
      wheelStopAnimation.cancel();
      wheelStopAnimation = null;
    }
  }

  function renderWheelNumbers(total) {
    const visibleTotal = Math.max(1, Math.floor(Number(total) || 20));
    wheelStep = 360 / visibleTotal;
    const wheel = $("#wheel");
    wheel.style.setProperty("--segment-angle", `${wheelStep}deg`);
    wheel.style.setProperty("--label-size", `${Math.max(7, Math.min(18, 370 / visibleTotal))}px`);
    wheel.style.background = buildWheelGradient(visibleTotal);
    $("#wheelNumbers").innerHTML = Array.from({ length: visibleTotal }, (_, index) => {
      const number = index + 1;
      const angle = wheelStep * index;
      return `<span data-number="${number}" style="--angle:${angle}deg">${String(number).padStart(2, "0")}</span>`;
    }).join("");
  }

  function buildWheelGradient(total) {
    const colors = ["#147ee8", "#090b10", "#f12c91", "#090b10"];
    const stops = [];
    for (let index = 0; index < total; index += 1) {
      const start = index * 360 / total;
      const end = (index + 1) * 360 / total;
      const color = colors[index % colors.length];
      stops.push(`${color} ${start}deg ${end}deg`);
    }
    return `conic-gradient(from ${-(180 / total)}deg, ${stops.join(",")})`;
  }

  function normalizeAngle(angle) {
    return ((angle % 360) + 360) % 360;
  }

  function readWheelAngle(wheel) {
    const transform = getComputedStyle(wheel).transform;
    if (!transform || transform === "none") return 0;
    const values = transform.match(/matrix(?:3d)?\(([^)]+)\)/)?.[1].split(",").map(Number);
    if (!values) return 0;
    const a = values.length === 6 ? values[0] : values[0];
    const b = values.length === 6 ? values[1] : values[1];
    return normalizeAngle(Math.atan2(b, a) * (180 / Math.PI));
  }

  function markWinningSegment(number, finalAngle) {
    document.querySelectorAll("#wheelNumbers span").forEach((label) => {
      const labelNumber = Number(label.dataset.number);
      const labelAngle = wheelStep * (labelNumber - 1);
      label.classList.toggle("is-winner", labelNumber === number);
      label.style.setProperty("--counter-angle", `${-(labelAngle + finalAngle)}deg`);
    });
  }

  function resetWheelLabels() {
    document.querySelectorAll("#wheelNumbers span").forEach((label) => {
      label.classList.remove("is-winner");
      label.style.removeProperty("--counter-angle");
    });
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
    const winningNumber = Math.max(1, Math.min(totalNumbers, Number(state.winning_number) || 1));
    const winningAngle = wheelStep * (winningNumber - 1);
    const finalAngle = normalizeAngle(-winningAngle);
    const currentAngle = readWheelAngle(wheel);
    const remainingAngle = normalizeAngle(finalAngle - currentAngle);
    const targetAngle = currentAngle + (360 * 5) + remainingAngle;

    wheel.classList.remove("spinning");
    resetWheelLabels();
    wheel.style.transform = `rotate(${currentAngle}deg)`;
    void wheel.offsetWidth;
    wheel.classList.add("stopping");
    rollNumbers();
    $("#winnerName").textContent = "LA RULETA ESTÁ DECIDIENDO";
    $("#liveMessage").textContent = "La pluma se detendrá exactamente en el número ganador…";

    wheelStopAnimation = wheel.animate([
      { transform: `rotate(${currentAngle}deg)` },
      { transform: `rotate(${targetAngle}deg)` }
    ], {
      duration: 3900,
      easing: "cubic-bezier(.08,.72,.12,1)",
      fill: "forwards"
    });

    winnerRevealTimer = setTimeout(() => {
      clearInterval(rollingTimer);
      rollingTimer = null;
      wheelStopAnimation?.cancel();
      wheelStopAnimation = null;
      wheel.classList.remove("stopping");
      wheel.style.transform = `rotate(${finalAngle}deg)`;
      markWinningSegment(winningNumber, finalAngle);
      void wheel.offsetWidth;
      wheel.classList.add("winner-hit");
      setTimeout(() => wheel.classList.remove("winner-hit"), 2100);
      $("#wheelNumber").textContent = String(winningNumber).padStart(2, "0");
      $("#winnerName").textContent = state.public_winner
        ? `GANADOR: ${state.public_winner}`
        : "¡TENEMOS GANADOR!";
      $("#liveMessage").textContent = `La pluma confirma el número ${String(winningNumber).padStart(2, "0")}, registrado oficialmente.`;
      $("#winnerCard").classList.add("winner-reveal");
      celebrate();
    }, 3900);
  }

  function alignWheelInstantly(number) {
    const winningNumber = Math.max(1, Math.min(totalNumbers, Number(number) || 1));
    const finalAngle = normalizeAngle(-(wheelStep * (winningNumber - 1)));
    const wheel = $("#wheel");
    wheel.style.transform = `rotate(${finalAngle}deg)`;
    markWinningSegment(winningNumber, finalAngle);
  }

  function applyState(state) {
    if (!state || state.revision === lastRevision) return;
    const phaseChanged = state.phase !== lastPhase;
    lastRevision = state.revision;
    lastPhase = state.phase;
    stopTimers();
    $("#wheel").classList.remove("spinning", "winner-hit");
    $("#wheel").classList.remove("stopping");
    resetWheelLabels();
    $("#winnerCard").classList.remove("winner-reveal");
    $("#livePrize").textContent = state.current_prize || "Esperando el inicio…";
    $("#winnerName").textContent = "La rodada está por comenzar";

    if (state.phase === "idle") {
      $("#wheel").style.transform = "rotate(0deg)";
      $("#wheelNumber").textContent = "☠";
      $("#liveMessage").textContent = "El sorteo oficial comenzará en breve.";
    }

    if (state.phase === "countdown") {
      $("#wheel").style.transform = "rotate(0deg)";
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
      $("#wheel").style.removeProperty("transform");
      $("#wheel").classList.add("spinning");
      $("#winnerName").textContent = "LA SUERTE ESTÁ RODANDO";
      $("#liveMessage").textContent = "Seleccionando de forma segura entre los números pagados…";
      rollNumbers();
    }

    if (state.phase === "winner") showWinner(state);

    if (state.phase === "finished") {
      if (state.winning_number) alignWheelInstantly(state.winning_number);
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
    totalNumbers = Math.max(1, Math.floor(Number(raffle.total_numbers) || 20));
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

  if (isDemo) {
    document.body.classList.add("demo-broadcast");
    applyState({ phase: "idle", revision: 1, current_prize: "Premio de demostración" });
    window.addEventListener("message", (event) => {
      if (event.origin !== location.origin || event.data?.type !== "fantasmas-demo-state") return;
      applyState(event.data.state);
    });
    window.parent.postMessage({ type: "fantasmas-demo-ready" }, location.origin);
    return;
  }

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
