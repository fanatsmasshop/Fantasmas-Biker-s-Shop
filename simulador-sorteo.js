(function () {
  const $ = (selector) => document.querySelector(selector);
  const query = new URLSearchParams(location.search);
  const raffleId = query.get("id") || "00000000-0000-4000-8000-000000000000";
  const iframe = $("#broadcastPreview");
  let revision = 10;
  let demoTimers = [];
  let ready = false;

  $("#backToControl").href = `sorteo-control.html?id=${encodeURIComponent(raffleId)}`;

  function clearDemoTimers() {
    demoTimers.forEach(clearTimeout);
    demoTimers = [];
    $("#runFullDemo").classList.remove("running");
  }

  function sendPhase(phase) {
    if (!ready) {
      $("#demoStatus").textContent = "La pantalla todavía está cargando. Espera un momento.";
      return;
    }
    revision += 1;
    const number = Math.max(1, Number($("#demoNumber").value) || 1);
    iframe.contentWindow.postMessage({
      type: "fantasmas-demo-state",
      state: {
        phase,
        revision,
        current_prize: $("#demoPrize").value.trim() || "Premio de demostración",
        current_prize_order: 1,
        winning_number: number,
        public_winner: $("#demoWinner").value.trim() || "Participante"
      }
    }, location.origin);
    const labels = { idle: "Pantalla en espera.", countdown: "Cuenta regresiva iniciada.", spinning: "La ruleta está girando.", winner: "Ganador de demostración mostrado.", finished: "Simulación finalizada." };
    $("#demoStatus").textContent = labels[phase];
  }

  function runFullDemo() {
    clearDemoTimers();
    $("#runFullDemo").classList.add("running");
    $("#demoStatus").textContent = "Ejecutando ensayo completo…";
    sendPhase("countdown");
    demoTimers.push(setTimeout(() => sendPhase("spinning"), 5300));
    demoTimers.push(setTimeout(() => sendPhase("winner"), 9300));
    demoTimers.push(setTimeout(() => {
      $("#runFullDemo").classList.remove("running");
      $("#demoStatus").textContent = "Ensayo completo. No se guardó ningún resultado.";
    }, 11800));
  }

  window.addEventListener("message", (event) => {
    if (event.origin !== location.origin || event.data?.type !== "fantasmas-demo-ready") return;
    ready = true;
    $("#demoStatus").textContent = "Simulador listo. Puedes iniciar el ensayo.";
  });
  iframe.src = `sorteo-en-vivo.html?id=${encodeURIComponent(raffleId)}&demo=1`;

  document.querySelectorAll("[data-demo-phase]").forEach((button) => {
    button.addEventListener("click", () => {
      clearDemoTimers();
      sendPhase(button.dataset.demoPhase);
    });
  });

  $("#runFullDemo").addEventListener("click", runFullDemo);
  document.querySelectorAll("[data-preview-size]").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll("[data-preview-size]").forEach((item) => item.classList.toggle("active", item === button));
      const mobile = button.dataset.previewSize === "mobile";
      $("#screenFrame").classList.toggle("mobile", mobile);
      $("#previewResolution").textContent = mobile ? "9:16" : "16:9";
    });
  });
  $("#openFullscreen").addEventListener("click", () => $("#screenFrame").requestFullscreen?.());
})();
