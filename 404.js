(function () {
  const route = document.querySelector("#missingRoute");
  if (route) route.textContent = location.pathname + location.search;

  const sparks = document.querySelector("#sparks");
  if (sparks && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const fragment = document.createDocumentFragment();
    for (let index = 0; index < 18; index += 1) {
      const spark = document.createElement("i");
      spark.className = "spark";
      spark.style.left = `${Math.random() * 100}%`;
      spark.style.setProperty("--duration", `${6 + Math.random() * 8}s`);
      spark.style.setProperty("--delay", `${-Math.random() * 12}s`);
      spark.style.setProperty("--drift", `${-60 + Math.random() * 120}px`);
      fragment.append(spark);
    }
    sparks.append(fragment);
  }

  const wheel = document.querySelector(".ghost-wheel");
  if (
    wheel &&
    matchMedia("(pointer:fine)").matches &&
    !matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    window.addEventListener(
      "pointermove",
      (event) => {
        const x = (event.clientX / innerWidth - 0.5) * 10;
        const y = (event.clientY / innerHeight - 0.5) * 10;
        wheel.style.translate = `${x}px ${y}px`;
      },
      { passive: true },
    );
  }
})();
