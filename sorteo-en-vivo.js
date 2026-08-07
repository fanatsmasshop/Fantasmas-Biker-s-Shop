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
  let wheelAnimationFrame = null;
  let winnerRevealTimer = null;
  let wheelAngle = 0;
  let wheelVelocity = 0;
  let audioContext = null;
  let mechanicalAudioEnabled = false;
  let lastPegIndex = null;
  let lastMechanicalClick = 0;

  function stopTimers() {
    clearInterval(countdownTimer);
    clearInterval(rollingTimer);
    clearTimeout(winnerRevealTimer);
    countdownTimer = null;
    rollingTimer = null;
    winnerRevealTimer = null;
    if (wheelAnimationFrame) {
      cancelAnimationFrame(wheelAnimationFrame);
      wheelAnimationFrame = null;
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
    $("#wheelPegs").innerHTML = Array.from({ length: visibleTotal }, (_, index) => {
      const boundaryAngle = (wheelStep * index) - (wheelStep / 2);
      return `<i style="--peg-angle:${boundaryAngle}deg"></i>`;
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

  function playMechanicalClick(force = .5) {
    if (!mechanicalAudioEnabled || !audioContext || audioContext.state !== "running") return;
    const now = performance.now();
    if (now - lastMechanicalClick < 24) return;
    lastMechanicalClick = now;
    const duration = .022;
    const length = Math.floor(audioContext.sampleRate * duration);
    const buffer = audioContext.createBuffer(1, length, audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < length; index += 1) {
      data[index] = ((Math.random() * 2) - 1) * (1 - (index / length));
    }
    const source = audioContext.createBufferSource();
    const filter = audioContext.createBiquadFilter();
    const gain = audioContext.createGain();
    source.buffer = buffer;
    filter.type = "bandpass";
    filter.frequency.value = 650 + (Math.min(1, force) * 1050);
    filter.Q.value = 1.4;
    gain.gain.value = .035 + (Math.min(1, force) * .055);
    source.connect(filter).connect(gain).connect(audioContext.destination);
    source.start();
  }

  function setMechanicalAngle(angle, velocity = 0, movePointer = true) {
    wheelAngle = angle;
    wheelVelocity = velocity;
    $("#wheel").style.transform = `rotate(${angle}deg)`;
    $(".wheel-hub").style.transform = `rotate(${-angle}deg)`;
    if (!movePointer) {
      $("#wheelPointer").style.setProperty("--pointer-angle", "0deg");
      return;
    }
    const cycle = normalizeAngle(angle + (wheelStep / 2)) / wheelStep;
    const phase = cycle - Math.floor(cycle);
    const pegIndex = Math.floor((angle + (wheelStep / 2)) / wheelStep);
    if (pegIndex !== lastPegIndex) {
      playMechanicalClick(Math.max(.18, Math.min(1, Math.abs(velocity) / 650)));
      lastPegIndex = pegIndex;
    }
    const force = Math.max(.28, Math.min(1, Math.abs(velocity) / 500));
    const kick = phase < .14
      ? -13 * (1 - (phase / .14)) * force
      : 12 * Math.pow((phase - .14) / .86, 3) * force;
    $("#wheelPointer").style.setProperty("--pointer-angle", `${kick}deg`);
  }

  function markWinningSegment(number, finalAngle) {
    document.querySelectorAll("#wheelNumbers span").forEach((label) => {
      const labelNumber = Number(label.dataset.number);
      label.classList.toggle("is-winner", labelNumber === number);
    });
    $("#wheel").style.setProperty("--winner-angle", `${finalAngle}deg`);
  }

  function resetWheelLabels() {
    document.querySelectorAll("#wheelNumbers span").forEach((label) => {
      label.classList.remove("is-winner");
    });
    $("#wheel").style.removeProperty("--winner-angle");
  }

  function startMechanicalSpin() {
    if (wheelAnimationFrame) cancelAnimationFrame(wheelAnimationFrame);
    const startedAt = performance.now();
    let previousTime = startedAt;
    const frame = (now) => {
      const elapsed = now - startedAt;
      const deltaSeconds = Math.min(.04, (now - previousTime) / 1000);
      previousTime = now;
      const acceleration = Math.min(1, elapsed / 900);
      const push = 70 + (610 * (1 - Math.pow(1 - acceleration, 2)));
      const naturalDrag = elapsed > 900 ? Math.min(75, (elapsed - 900) * .014) : 0;
      const velocity = Math.max(70, push - naturalDrag);
      setMechanicalAngle(wheelAngle + (velocity * deltaSeconds), velocity, true);
      wheelAnimationFrame = requestAnimationFrame(frame);
    };
    wheelAnimationFrame = requestAnimationFrame(frame);
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
    const currentAngle = wheelAngle;
    const remainingAngle = normalizeAngle(finalAngle - currentAngle);
    const incomingVelocity = Math.max(540, wheelVelocity || 620);
    const preferredDuration = 6.1;
    const rotations = Math.max(4, Math.round(((incomingVelocity * preferredDuration / 2) - remainingAngle) / 360));
    const travelAngle = (360 * rotations) + remainingAngle;
    const duration = Math.max(5.3, Math.min(7.2, (2 * travelAngle) / incomingVelocity));

    wheel.classList.remove("spinning");
    resetWheelLabels();
    wheel.classList.add("stopping");
    $("#wheelNumber").textContent = "…";
    $("#winnerName").textContent = "LA RULETA ESTÁ DECIDIENDO";
    $("#liveMessage").textContent = "La rueda pierde fuerza y cada tope golpea la pluma…";

    const startedAt = performance.now();
    const durationMs = duration * 1000;
    const decelerate = (now) => {
      const progress = Math.min(1, (now - startedAt) / durationMs);
      const physicalDistance = travelAngle * ((2 * progress) - (progress * progress));
      const currentVelocity = (2 * travelAngle / duration) * (1 - progress);
      setMechanicalAngle(currentAngle + physicalDistance, currentVelocity, true);
      if (progress < 1) {
        wheelAnimationFrame = requestAnimationFrame(decelerate);
        return;
      }
      wheelAnimationFrame = null;
      wheel.classList.remove("stopping");
      setMechanicalAngle(finalAngle, 0, false);
      playMechanicalClick(1);
      markWinningSegment(winningNumber, finalAngle);
      void wheel.offsetWidth;
      wheel.classList.add("winner-hit");
      $("#wheelPointer").classList.add("pointer-settle");
      setTimeout(() => wheel.classList.remove("winner-hit"), 2100);
      setTimeout(() => $("#wheelPointer").classList.remove("pointer-settle"), 900);
      $("#wheelNumber").textContent = String(winningNumber).padStart(2, "0");
      $("#winnerName").textContent = state.public_winner
        ? `GANADOR: ${state.public_winner}`
        : "¡TENEMOS GANADOR!";
      $("#liveMessage").textContent = `La pluma confirma el número ${String(winningNumber).padStart(2, "0")}, registrado oficialmente.`;
      $("#winnerCard").classList.add("winner-reveal");
      celebrate();
    };
    wheelAnimationFrame = requestAnimationFrame(decelerate);
  }

  function alignWheelInstantly(number) {
    const winningNumber = Math.max(1, Math.min(totalNumbers, Number(number) || 1));
    const finalAngle = normalizeAngle(-(wheelStep * (winningNumber - 1)));
    setMechanicalAngle(finalAngle, 0, false);
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
      setMechanicalAngle(0, 0, false);
      $("#wheelNumber").textContent = "☠";
      $("#liveMessage").textContent = "El sorteo oficial comenzará en breve.";
    }

    if (state.phase === "countdown") {
      setMechanicalAngle(0, 0, false);
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
      $("#wheelNumber").textContent = "☠";
      $("#winnerName").textContent = "LA SUERTE ESTÁ RODANDO";
      $("#liveMessage").textContent = "La rueda recibió el impulso inicial…";
      startMechanicalSpin();
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

  $("#mechanicalSound").addEventListener("click", async () => {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    await audioContext.resume();
    mechanicalAudioEnabled = audioContext.state === "running";
    $("#mechanicalSound").classList.toggle("active", mechanicalAudioEnabled);
    $("#mechanicalSound").textContent = mechanicalAudioEnabled
      ? "🔊 SONIDO MECÁNICO ACTIVO"
      : "🔇 AUDIO BLOQUEADO · TOCA DE NUEVO";
    playMechanicalClick(1);
  });

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
