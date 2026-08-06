// Datos de respaldo: el panel sustituye esta lista cuando el editor está instalado.
const rifas = [
  { precio: 10, numeros: 30, icono: "⏰", principal: "Reloj despertador con radio y bocina Bluetooth", secundarios: "3 peluches exclusivos" },
  { precio: 20, numeros: 20, icono: "🎧", principal: "Intercomunicador Bluetooth para casco", secundarios: "3 peluches exclusivos" },
  { precio: 30, numeros: 20, icono: "⚙", principal: "Hebilla biker", secundarios: "2 peluches + mochila para tenis" },
  { precio: 50, numeros: 15, icono: "🔑", principal: "Portallaves biker metálico #1", secundarios: "2 peluches + mochila para tenis" },
  { precio: 75, numeros: 12, icono: "🏍", principal: "Portallaves biker metálico #2", secundarios: "Peluche + mochila + gorra" },
  { precio: 100, numeros: 10, icono: "🎁", principal: "Muñeca Hello Kitty × Chucky", secundarios: "Peluche + mochila + gorra" }
];
window.FANTASMAS_FALLBACK_RAFFLES = rifas;

const telefono = "525610329215";
const contenedor = document.querySelector("#listaRifas");

rifas.forEach((rifa) => {
  const mensaje = encodeURIComponent(`Hola, quiero apartar un número de la rifa de $${rifa.precio} de Fantasmas Biker's Shop.`);
  contenedor.insertAdjacentHTML("beforeend", `
    <article class="rifa">
      <div class="rifa-cabecera">
        <span class="icono">${rifa.icono}</span>
        <span class="cantidad">${rifa.numeros} NÚMEROS</span>
      </div>
      <div class="rifa-cuerpo">
        <div class="precio"><small>$</small>${rifa.precio}<small> MXN</small></div>
        <p class="mini">PREMIO PRINCIPAL</p>
        <h3>${rifa.principal}</h3>
        <p class="secundarios"><b>3 premios secundarios:</b> ${rifa.secundarios}</p>
        <a href="https://wa.me/${telefono}?text=${mensaje}" target="_blank">Apartar número <b>→</b></a>
      </div>
    </article>
  `);
});

const menuBoton = document.querySelector("#menuBoton");
const menu = document.querySelector("#menu");

menuBoton.addEventListener("click", () => menu.classList.toggle("abierto"));
menu.querySelectorAll("a").forEach((enlace) => enlace.addEventListener("click", () => menu.classList.remove("abierto")));
