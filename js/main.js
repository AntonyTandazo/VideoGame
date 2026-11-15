import { Game, CONFIG } from "./game.js";
import { sound } from "./sound.js";

const canvas = document.getElementById("juego");
const game = new Game(canvas);

// Referencias HUD (solo UI)
const puntos = document.getElementById("puntos");
const vidaEl = document.getElementById("vida");
const vidasEl = document.getElementById("vidas");
const tiempo = document.getElementById("tiempo");
const cicloEl = document.getElementById("ciclo");
const subjefesEl = document.getElementById("subjefes");
const tiempoSubjefeEl = document.getElementById("tiempo-subjefe");
const subjefeVidaEl = document.getElementById("subjefe-vida");
const rellenoVida = vidaEl.querySelector(".relleno-vida");
const rellenoSubjefe = subjefeVidaEl.querySelector(".relleno-vida");

const pantallaInicio = document.getElementById("pantalla-inicio");
const pantallaHistoria = document.getElementById("pantalla-historia");
const pantallaGameOver = document.getElementById("pantalla-gameover");
const pantallaPausa = document.getElementById("pantalla-pausa");
const btnJugar = document.getElementById("btn-jugar");
const btnEmpezarViaje = document.getElementById("btn-empezar-viaje");
const btnReiniciar = document.getElementById("btn-reiniciar");
const btnReanudar = document.getElementById("btn-reanudar");
const btnPausa = document.getElementById("btn-pausa");
const btnSaltarIntro = document.getElementById("btn-saltar-intro");
const scoreFinal = document.getElementById("score-final");
const tiempoFinal = document.getElementById("tiempo-final");

// Elemento de aviso flotante
const avisoEl = document.getElementById("aviso-pantalla");
let avisoTimer = null;    // timer único que controla el ocultado del aviso
let avisoMostrado = "";   // último texto mostrado (para no re-disparar cada frame)

// Elemento de aviso de vida restaurada
const avisoCuracionEl = document.getElementById("aviso-curacion");
let avisoCuracionTimer = null; // timer único que reinicia la animación de curación

let estado = "menu"; // "menu" | "historia" | "jugando" | "pausado" | "gameover"

const keys = {};
window.addEventListener("keydown", (e) => {
  keys[e.key] = true;
});
window.addEventListener("keyup", (e) => {
  keys[e.key] = false;
});

/* ---------- UI: rastreo de valores previos para animaciones de feedback ---------- */
let puntosPrevios = 0;
let vidaPrevia = 120;
let vidasPrevias = 3;
let subjefesPrevios = 0;

/* ---------- Referencias elementos del crawl ---------- */
const crawlFrase = document.getElementById("crawl-frase");
const crawlTitulo = document.getElementById("crawl-titulo");
const crawlTexto = document.getElementById("crawl-texto");
const crawlBotones = document.querySelector(".crawl-botones");

/* ---------- Actualizar HUD ---------- */
function actualizarHUD() {
  // Puntos
  const puntosNuevos = game.score;
  puntos.querySelector(".hud-valor").textContent = puntosNuevos;
  if (puntosNuevos !== puntosPrevios) {
    puntos.classList.add("pulse");
    setTimeout(() => puntos.classList.remove("pulse"), 350);
    puntosPrevios = puntosNuevos;
  }

  // Vida (numérica + barra visual)
  const vidaActual = game.player.vida;
  const maxVida = game.player.maxVida;
  vidaEl.querySelector(".hud-valor").textContent = `${vidaActual}/${maxVida}`;
  const porcentaje = Math.max(0, Math.min(100, (vidaActual / maxVida) * 100));
  rellenoVida.style.width = `${porcentaje}%`;
  rellenoVida.classList.remove("vida-alta", "vida-media", "vida-baja");
  if (porcentaje > 60) rellenoVida.classList.add("vida-alta");
  else if (porcentaje > 30) rellenoVida.classList.add("vida-media");
  else rellenoVida.classList.add("vida-baja");

  if (vidaActual < vidaPrevia) {
    vidaEl.classList.add("daño");
    setTimeout(() => vidaEl.classList.remove("daño"), 500);
  }
  vidaPrevia = vidaActual;

  // Vidas
  const vidasActuales = game.lives;
  vidasEl.querySelector(".hud-valor").textContent = vidasActuales;
  if (vidasActuales !== vidasPrevias) {
    vidasEl.classList.add("daño");
    setTimeout(() => vidasEl.classList.remove("daño"), 500);
    vidasPrevias = vidasActuales;
  }

  // Tiempo
  tiempo.querySelector(".hud-valor").textContent = `${game.tiempoTranscurrido()}s`;

  // Ciclo
  cicloEl.querySelector(".hud-valor").textContent = game.numeroFase;

  // Sub-jefes derrotados en ciclo actual (X/5)
  const subjefesActuales = game.subjefesCiclo;
  subjefesEl.querySelector(".hud-valor").textContent = `${subjefesActuales}/${CONFIG.subjefesPorJefe}`;
  if (subjefesActuales !== subjefesPrevios) {
    subjefesEl.classList.add("pulse");
    setTimeout(() => subjefesEl.classList.remove("pulse"), 350);
    subjefesPrevios = subjefesActuales;
  }

  // Tiempo restante para próximo sub-jefe (mm:ss)
  // Ojo: escribir sobre .hud-valor (no sobre la tarjeta entera) para no
  // borrar el ícono ni la etiqueta de la tarjeta.
  const segundos = game.tiempoRestanteSubjefe();
  const m = Math.floor(segundos / 60);
  const s = segundos % 60;
  tiempoSubjefeEl.querySelector(".hud-valor").textContent = `${m}:${s < 10 ? "0" : ""}${s}`;

  // Barra de vida del sub-jefe o jefe activo
  const subjefeActivo = game.subJefes.find((s) => !s.derrotado);
  const jefeActivo = game.jefe && !game.jefe.derrotado ? game.jefe : null;
  if (subjefeActivo) {
    subjefeVidaEl.classList.remove("hidden");
    const pct = Math.max(0, Math.min(100, (subjefeActivo.vida / subjefeActivo.maxVida) * 100));
    rellenoSubjefe.style.width = `${pct}%`;
    subjefeVidaEl.querySelector(".hud-label").textContent = `Sub-jefe #${subjefeActivo.numero}`;
  } else if (jefeActivo) {
    subjefeVidaEl.classList.remove("hidden");
    const pct = Math.max(0, Math.min(100, (jefeActivo.vida / jefeActivo.maxVida) * 100));
    rellenoSubjefe.style.width = `${pct}%`;
    subjefeVidaEl.querySelector(".hud-label").textContent = "JEFE FINAL";
  } else {
    subjefeVidaEl.classList.add("hidden");
  }
}

/* ---------- Avisos flotantes ---------- */
function mostrarAviso(texto, duracion = 3000) {
  if (!avisoEl) return;
  avisoEl.textContent = texto;
  avisoEl.classList.remove("hidden");
  // Forzar reflujo para que la transición de entrada se ejecute al salir de display:none
  void avisoEl.offsetWidth;
  avisoEl.classList.add("aviso-visible");

  // Un solo timer: cancela el anterior para no acumular ocultados
  if (avisoTimer) clearTimeout(avisoTimer);
  avisoTimer = setTimeout(() => {
    avisoEl.classList.remove("aviso-visible");
    avisoTimer = setTimeout(() => {
      avisoEl.classList.add("hidden");
      avisoTimer = null;
    }, 350);
  }, duracion);
}

/* Muestra el aviso verde de "¡VIDA RESTAURADA!" reiniciando su animación.
   El elemento arranca con `hidden`; hay que quitarlo para que la keyframe corra. */
function mostrarCuracion() {
  if (!avisoCuracionEl) return;
  // Sacar `hidden` para que la animación pueda ejecutarse y reiniciarla
  avisoCuracionEl.classList.remove("hidden");
  avisoCuracionEl.classList.remove("aviso-visible");
  void avisoCuracionEl.offsetWidth; // reflujo: reinicia la keyframe
  avisoCuracionEl.classList.add("aviso-visible");

  // Un solo timer para limpiar al terminar la animación (1.6s)
  if (avisoCuracionTimer) clearTimeout(avisoCuracionTimer);
  avisoCuracionTimer = setTimeout(() => {
    avisoCuracionEl.classList.remove("aviso-visible");
    avisoCuracionEl.classList.add("hidden");
    avisoCuracionTimer = null;
  }, 1600);
}

/* Destello verde sobre la tarjeta de vida cuando se restaura vida */
function destelloVida() {
  vidaEl.classList.remove("curacion");
  void vidaEl.offsetWidth;
  vidaEl.classList.add("curacion");
  setTimeout(() => vidaEl.classList.remove("curacion"), 700);
}

/* ---------- Pantallas ---------- */
function mostrarHistoria() {
  estado = "historia";
  pantallaInicio.classList.add("hidden");
  pantallaGameOver.classList.add("hidden");
  pantallaPausa.classList.add("hidden");
  pantallaHistoria.classList.remove("hidden");

  // Resetear crawl
  btnEmpezarViaje.disabled = true;
  crawlFrase.style.opacity = "0";
  crawlFrase.style.transform = "scale(0.95)";
  crawlTitulo.style.opacity = "0";
  crawlTitulo.style.transform = "scale(0.5)";
  crawlTexto.style.opacity = "0";
  crawlBotones.style.opacity = "0";

  // Forzar reflujo para que las animaciones se reinicien
  void crawlFrase.offsetWidth;

  crawlFrase.style.animation = "none";
  crawlTitulo.style.animation = "none";
  crawlTexto.style.animation = "none";
  crawlBotones.style.animation = "none";

  void crawlFrase.offsetWidth;

  crawlFrase.style.animation = "frase-fade 6s ease-in-out both";
  crawlTitulo.style.animation = "titulo-alejarse 8s ease-in both";
  crawlTexto.style.animation = "texto-subir 22s linear both";
  crawlBotones.style.animation = "botones-aparecer 10s ease forwards";

  // Habilitar "Empezar viaje" al terminar el crawl (22s) o al saltar
  setTimeout(() => {
    if (estado === "historia") {
      btnEmpezarViaje.disabled = false;
    }
  }, 22000);

  // La música arranca dentro del gesto del usuario (clic en "Jugar"),
  // que es lo que el navegador exige para permitir audio.
  sound.iniciar();
  sound.cambiarMusica("menu");
}

function saltarIntro() {
  if (estado !== "historia") return;
  btnEmpezarViaje.disabled = false;
  iniciarJuego();
}

function iniciarJuego() {
  estado = "jugando";
  pantallaHistoria.classList.add("hidden");
  pantallaGameOver.classList.add("hidden");
  pantallaPausa.classList.add("hidden");

  // El cronómetro de juego activo arranca a contar desde que empieza la partida
  game.ultimoTiempoJuego = Date.now();

  sound.iniciar();
  sound.cambiarMusica("nivel");
  reiniciarGuia();
  loop();
}

function mostrarGameOver() {
  estado = "gameover";
  scoreFinal.textContent = `Puntuación: ${game.score}`;
  tiempoFinal.textContent = `Tiempo sobrevivido: ${game.tiempoTranscurrido()}s`;
  pantallaGameOver.classList.remove("hidden");
  sound.detenerMusica(); // fade out: la música se apaga en 1,5 s
}

function reiniciarJuego() {
  game.score = 0;
  game.lives = 3;
  game.gameOver = false;
  game.startTime = Date.now();

  // Resetear el jugador a sus valores base (sin arrastrar bonos de vida ni poderes)
  game.player.maxVida = 120;
  game.player.vida = 120;
  game.player.escudo = { activo: false, impactos: 4, expiraEn: 0 };
  game.player.disparoContinuo = { activo: false, expiraEn: 0 };
  game.player.ultimoDisparo = 0;
  delete game.player.factorDañoDisparo;
  game.player.x = canvas.width / 2 - game.player.width / 2;
  game.player.y = canvas.height - 70;

  game.bullets = [];
  game.enemyBullets = [];
  game.enemies = [];
  game.meteoritos = [];
  game.powerups = [];
  game.subJefes = [];
  game.jefe = null;
  game.enemyTimer = 0;
  game.meteoritoTimer = 0;
  game.powerupTimer = 0;
  game.frameCount = 0;
  game.baseEnemySpeed = 2;
  game.baseMeteoritoSpeed = 2;
  game.baseEnemyInterval = 60;
  game.baseMeteoritoInterval = 90;
  game.numeroFase = 1;
  game.subjefesCiclo = 0;
  game.tiempoJuegoAcumulado = 0;
  game.ultimoTiempoJuego = Date.now();
  game.multiplicadorVidaEnemigos = 1;
  game.multiplicadorDañoEnemigos = 1;
  game.multiplicadorVidaSubjefes = 1;
  game.multiplicadorDañoSubjefes = 1;
  game.avisoTexto = "";
  game.avisoTiempoRestante = 0;
  game.curacionPendiente = 0;
  // El aviso del jefe también se reinicia. Sin esto, reiniciar la partida justo
  // después de derrotar al 5º sub-jefe hacía aparecer el jefe apenas arrancaba
  // la partida nueva (el flag quedaba en true de la partida anterior).
  game.mostrandoAvisoJefe = false;
  game.tiempoAvisoJefe = 0;
  game.factorEnemigosActual = 1.0;
  game.ultimoTiempoTransicionEnemigos = Date.now();
  game.powerupInterval = 400;
  delete game.factorEnemigosFase;

  // Resetear rastreo de animaciones
  puntosPrevios = 0;
  vidaPrevia = 120;
  vidasPrevias = 3;
  subjefesPrevios = 0;

  actualizarHUD();

  pantallaGameOver.classList.add("hidden");
  pantallaPausa.classList.add("hidden");
  pantallaHistoria.classList.remove("hidden");
  estado = "historia";

  // Reiniciar crawl
  btnEmpezarViaje.disabled = true;
  crawlFrase.style.animation = "none";
  crawlTitulo.style.animation = "none";
  crawlTexto.style.animation = "none";
  crawlBotones.style.animation = "none";
  void crawlFrase.offsetWidth;
  crawlFrase.style.animation = "frase-fade 6s ease-in-out both";
  crawlTitulo.style.animation = "titulo-alejarse 8s ease-in both";
  crawlTexto.style.animation = "texto-subir 22s linear both";
  crawlBotones.style.animation = "botones-aparecer 10s ease forwards";

  setTimeout(() => {
    if (estado === "historia") btnEmpezarViaje.disabled = false;
  }, 22000);

  sound.iniciar();
  sound.cambiarMusica("menu");
}

function pausarJuego() {
  if (estado !== "jugando") return;
  estado = "pausado";
  pantallaPausa.classList.remove("hidden");
  sound.pausar();          // recuerda el paso exacto del secuenciador
  mostrarGuiaCompleta();   // en pausa la guía se ve entera
}

function reanudarJuego() {
  if (estado !== "pausado") return;
  estado = "jugando";
  // Evitar que el tiempo transcurrido durante la pausa se acumule al cronómetro de jefes
  game.ultimoTiempoJuego = Date.now();
  pantallaPausa.classList.add("hidden");
  sound.reanudar();        // continúa la música donde estaba
  reiniciarGuia();
  loop();
}

/* ---------- Eventos ---------- */
btnJugar.addEventListener("click", mostrarHistoria);
btnSaltarIntro.addEventListener("click", saltarIntro);
btnEmpezarViaje.addEventListener("click", iniciarJuego);
btnReiniciar.addEventListener("click", reiniciarJuego);
btnPausa.addEventListener("click", pausarJuego);
btnReanudar.addEventListener("click", reanudarJuego);

// Pausa con tecla ESC; Saltar con Enter o Espacio en historia
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (estado === "jugando") pausarJuego();
    else if (estado === "pausado") reanudarJuego();
  }
  if ((e.key === "Enter" || e.key === " ") && estado === "historia") {
    saltarIntro();
  }
});

/* ---------- Sonido ---------- */
const btnSonido = document.getElementById("btn-sonido");

// Refleja en el botón el estado real del módulo de audio, que ya leyó la
// preferencia guardada en localStorage al arrancar.
function actualizarBotonSonido() {
  const silenciado = sound.estaSilenciado();
  btnSonido.textContent = silenciado ? "🔇" : "🔊";
  btnSonido.classList.toggle("activo", !silenciado);
  btnSonido.setAttribute("aria-label", silenciado ? "Activar sonido" : "Desactivar sonido");
  btnSonido.setAttribute("aria-pressed", silenciado ? "false" : "true");
}

// El módulo de audio es el único dueño del mute: persiste la preferencia y
// el juego nunca vuelve a activar el sonido por su cuenta.
btnSonido.addEventListener("click", () => {
  sound.silenciar();
  actualizarBotonSonido();
});

actualizarBotonSonido();

/* ---------- Guía de controles ---------- */
// La guía de la partida arranca nítida y se atenúa a los 10 segundos para no
// molestar; vuelve a opacidad completa al pasar el mouse (CSS :hover) o al
// pausar (que la deja entera).
const guiaJuego = document.getElementById("guia-controles");
const MS_ATENUAR_GUIA = 10000;
let guiaTimer = null;

function reiniciarGuia() {
  if (!guiaJuego) return;
  guiaJuego.classList.remove("guia-atenuada");
  if (guiaTimer) clearTimeout(guiaTimer);
  guiaTimer = setTimeout(() => {
    guiaJuego.classList.add("guia-atenuada");
    guiaTimer = null;
  }, MS_ATENUAR_GUIA);
}

function mostrarGuiaCompleta() {
  if (!guiaJuego) return;
  if (guiaTimer) {
    clearTimeout(guiaTimer);
    guiaTimer = null;
  }
  guiaJuego.classList.remove("guia-atenuada");
}

/* ---------- Bucle de juego ---------- */
function loop() {
  if (estado !== "jugando") return;

  const tiempoActual = Date.now();

  game.player.handleInput(keys);

  // Disparo del jugador con cadencia (incluye disparo continuo si tiene el poder)
  if (keys[" "]) {
    const bala = game.player.disparar(tiempoActual);
    if (bala) {
      game.bullets.push(bala);
      sound.reproducirEfecto("disparoJugador");
    }
  }

  game.update(tiempoActual);
  game.draw();

  actualizarHUD();

  // Feedback visual de curación: game.js acumula los eventos en curacionPendiente
  if (game.curacionPendiente > 0) {
    mostrarCuracion();
    destelloVida();
    game.curacionPendiente = 0;
  }

  // Mostrar aviso solo cuando cambia el texto (no cada frame)
  if (game.avisoTexto) {
    if (game.avisoTexto !== avisoMostrado) {
      mostrarAviso(game.avisoTexto, game.avisoTiempoRestante);
      avisoMostrado = game.avisoTexto;
    }
  } else {
    avisoMostrado = "";
  }

  if (game.gameOver) {
    mostrarGameOver();
    return;
  }

  requestAnimationFrame(loop);
}
