/**
 * ============================================================
 *  sound.js — Módulo único de audio del juego
 * ============================================================
 *  Toda la música y todos los efectos se sintetizan en tiempo real
 *  con la Web Audio API nativa: el juego no depende de ningún
 *  archivo de audio externo.
 *
 *  ¿Por qué procedural y no archivos?
 *  Los 9 archivos de `assets/sounds/` del proyecto eran placeholders
 *  corruptos (MP3 sin cabecera, WAV que no empezaba con "RIFF"), así
 *  que ningún navegador podía decodificarlos. Encima el código viejo
 *  se tragaba los errores con `play().catch(() => {})`, y por eso no
 *  se escuchaba absolutamente nada (ni música ni efectos).
 *
 *  Cadena de audio (un único destino, un único volumen maestro):
 *
 *      música  ──▶ musicaGain  ──┐
 *                                ├──▶ maestroGain ──▶ compresor ──▶ salida
 *      efectos ──▶ efectosGain ──┘
 *
 *  El compresor evita la saturación cuando se solapan muchos efectos
 *  (disparos + explosiones + power-ups al mismo tiempo).
 *
 *  API pública:
 *    iniciar()                 crea/reanuda el AudioContext
 *    cambiarMusica(nombre)     "menu" | "nivel"
 *    pausar(motivo)            detiene la música recordando el paso exacto
 *    reanudar(motivo)          continúa la música donde quedó
 *    silenciar(silenciado)     mute global, persistido en localStorage
 *    reproducirEfecto(nombre)  efecto puntual, solapable
 *    detenerMusica(segundos)   fade out (Game Over)
 * ============================================================
 */

/* ============================================================
   Configuración
   ============================================================ */

// Clave de localStorage. "1" = sonido activo, "0" = silenciado.
const CLAVE_ALMACENAMIENTO = "juego-naves:sonido";

const VOLUMEN_MUSICA = 0.4;   // dentro del rango pedido (0.3 – 0.5)
const VOLUMEN_EFECTOS = 0.7;  // dentro del rango pedido (0.6 – 0.8)

// Antirrebote por efecto: evita ráfagas que saturen el compresor.
const MS_MINIMOS_ENTRE_EFECTOS = 25;

/* Pistas musicales procedurales.
   Cada pista son tres capas sincronizadas sobre el mismo compás (16 pasos):
     - bajo    : nota larga al inicio (y a mitad en "nivel") del compás
     - pad     : acorde sostenido que dura todo el compás
     - arpegio : nota cada dos pasos, ciclando por la escala
   La progresión indica los semitonos que se suman a la raíz en cada compás. */
const PISTAS = {
  menu: {
    bpm: 74,
    raiz: 110,                  // A2
    progresion: [0, 0, -4, -2], // Am, Am, F, G
    acorde: [0, 3, 7, 12],      // tercera menor, quinta y octava
    arpegio: [12, 15, 19, 15, 12, 15, 19, 24, 19, 15, 12, 15, 19, 15, 12, 15],
    golpesBajo: [0],            // una nota larga por compás (más calmo)
  },
  nivel: {
    bpm: 104,
    raiz: 98,                   // G2
    progresion: [0, 0, 3, 3, 5, 5, -2, -2],
    acorde: [0, 3, 7, 12],
    arpegio: [12, 19, 24, 19, 15, 19, 24, 19, 12, 19, 24, 19, 15, 22, 24, 22],
    golpesBajo: [0, 8],         // dos notas por compás: más pulso
  },
};

/* ============================================================
   Preferencia de sonido (localStorage, siempre con try/catch)
   ============================================================ */

// Devuelve true si el sonido debe estar activo.
function leerPreferencia() {
  try {
    const valor = localStorage.getItem(CLAVE_ALMACENAMIENTO);
    return valor === null ? true : valor === "1";
  } catch (error) {
    // Modo privado o almacenamiento bloqueado: seguimos con sonido activo.
    console.warn("[audio] No se pudo leer la preferencia de sonido:", error);
    return true;
  }
}

function guardarPreferencia(activo) {
  try {
    localStorage.setItem(CLAVE_ALMACENAMIENTO, activo ? "1" : "0");
  } catch (error) {
    console.warn("[audio] No se pudo guardar la preferencia de sonido:", error);
  }
}

/* ============================================================
   Módulo de audio
   ============================================================ */

class SoundManager {
  constructor() {
    this.ctx = null;                 // AudioContext (se crea en el primer gesto)
    this.maestroGain = null;
    this.compresor = null;
    this.musicaGain = null;
    this.efectosGain = null;
    this.bufferRuido = null;         // buffer de ruido blanco reutilizable

    this.silenciado = !leerPreferencia();

    // Motivos activos de pausa ("juego", "foco"). La música solo suena
    // cuando el conjunto está vacío: así pausar por foco y por el botón
    // de pausa no se pisan entre sí.
    this.pausas = new Set();

    // Transporte de la música (secuenciador con lookahead)
    this.nombreMusicaActual = null;
    this.paso = 0;                   // paso global: por eso reanudar continúa donde iba
    this.proximoPaso = 0;            // instante (ctx.currentTime) del próximo paso
    this.intervalo = null;
    this.timerDetencion = null;

    this.ultimoEfecto = {};          // nombre -> instante del último disparo
    this.reintentoProgramado = false;

    // Al perder el foco se pausa la música y al volver se reanuda.
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.pausar("foco");
      else this.reanudar("foco");
    });
  }

  /* ----------------------------------------------------------
     Contexto y cadena de audio
     ---------------------------------------------------------- */

  // Crea el AudioContext y la cadena de nodos la primera vez.
  // Devuelve false si el navegador no soporta Web Audio.
  _asegurarContexto() {
    if (this.ctx) return true;

    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) {
      console.warn("[audio] Este navegador no soporta la Web Audio API: el juego funcionará sin sonido.");
      return false;
    }

    try {
      this.ctx = new Ctor();
    } catch (error) {
      console.warn("[audio] No se pudo crear el AudioContext:", error);
      return false;
    }

    this.bufferRuido = this._crearBufferRuido();

    // Volumen maestro: 0 si el usuario había silenciado en una sesión anterior.
    this.maestroGain = this.ctx.createGain();
    this.maestroGain.gain.value = this.silenciado ? 0 : 1;

    // Compresor suave: evita la distorsión cuando se solapan efectos.
    this.compresor = this.ctx.createDynamicsCompressor();
    this.compresor.threshold.value = -18;
    this.compresor.knee.value = 24;
    this.compresor.ratio.value = 6;
    this.compresor.attack.value = 0.004;
    this.compresor.release.value = 0.25;

    this.musicaGain = this.ctx.createGain();
    this.musicaGain.gain.value = 0;

    this.efectosGain = this.ctx.createGain();
    this.efectosGain.gain.value = VOLUMEN_EFECTOS;

    this.musicaGain.connect(this.maestroGain);
    this.efectosGain.connect(this.maestroGain);
    this.maestroGain.connect(this.compresor);
    this.compresor.connect(this.ctx.destination);

    return true;
  }

  // Reanuda el contexto (los navegadores lo arrancan suspendido hasta
  // que hay un gesto del usuario) y reintenta en la próxima interacción
  // si la promesa falla.
  _reanudarContexto() {
    if (!this.ctx) return;
    const promesa = this.ctx.resume();
    if (promesa && typeof promesa.catch === "function") {
      promesa.catch((error) => {
        console.warn("[audio] No se pudo reanudar el AudioContext:", error);
        this._programarReintento();
      });
    }
  }

  _programarReintento() {
    if (this.reintentoProgramado) return;
    this.reintentoProgramado = true;

    const reintentar = () => {
      window.removeEventListener("pointerdown", reintentar);
      window.removeEventListener("keydown", reintentar);
      this.reintentoProgramado = false;
      this.iniciar();
    };

    window.addEventListener("pointerdown", reintentar);
    window.addEventListener("keydown", reintentar);
  }

  /* ----------------------------------------------------------
     API pública
     ---------------------------------------------------------- */

  // Inicializa el audio. Debe llamarse DENTRO de un gesto del usuario
  // (clic o tecla) para que el navegador permita reproducir sonido.
  iniciar() {
    if (!this._asegurarContexto()) return;
    this._reanudarContexto();

    // Si ya había una pista elegida y el transporte está parado sin
    // motivo, la retomamos (por ejemplo al reactivar el sonido).
    if (this.silenciado || this.pausas.size > 0) return;
    if (this.nombreMusicaActual && !this.intervalo) {
      this._rampaMusica(VOLUMEN_MUSICA, 0.4);
      this._arrancarTransporte();
    }
  }

  // Cambia de pista. Arranca desde el principio de la nueva pista.
  cambiarMusica(nombre) {
    const pista = PISTAS[nombre];
    if (!pista) {
      console.warn(`[audio] Pista de música desconocida: "${nombre}"`);
      return;
    }
    if (!this._asegurarContexto()) return;
    this._reanudarContexto();

    // Si había un fade out pendiente (Game Over), lo cancelamos.
    if (this.timerDetencion) {
      clearTimeout(this.timerDetencion);
      this.timerDetencion = null;
    }

    this._detenerTransporte();
    this.nombreMusicaActual = nombre;
    this.paso = 0;

    // Arrancar una pista implica que la partida empieza: nos aseguramos de
    // no arrastrar la pausa de una partida anterior. La pausa por foco
    // ("foco") sí se respeta, porque sigue siendo válida.
    this.pausas.delete("juego");

    if (this.silenciado || this.pausas.size > 0) {
      this.musicaGain.gain.setValueAtTime(0, this.ctx.currentTime);
      return;
    }

    this._rampaMusica(VOLUMEN_MUSICA, 0.6);
    this._arrancarTransporte();
  }

  // Pausa la música sin perder la posición del secuenciador.
  pausar(motivo = "juego") {
    this.pausas.add(motivo);
    this._detenerTransporte();
    this._rampaMusica(0, 0.15);
  }

  // Reanuda la música donde estaba, solo si no queda ningún motivo de pausa.
  reanudar(motivo = "juego") {
    this.pausas.delete(motivo);
    if (this.pausas.size > 0) return;
    if (!this.ctx || this.silenciado || !this.nombreMusicaActual) return;
    this._rampaMusica(VOLUMEN_MUSICA, 0.4);
    this._arrancarTransporte();
  }

  // Silencia o reactiva todo (música + efectos). Sin argumento, alterna.
  // Devuelve el estado resultante: true = silenciado.
  silenciar(silenciado = !this.silenciado) {
    this.silenciado = Boolean(silenciado);
    guardarPreferencia(!this.silenciado);

    if (this.ctx) {
      const ganancia = this.maestroGain.gain;
      const ahora = this.ctx.currentTime;
      ganancia.cancelScheduledValues(ahora);
      ganancia.setValueAtTime(ganancia.value, ahora);
      ganancia.linearRampToValueAtTime(this.silenciado ? 0 : 1, ahora + 0.15);
    }

    if (this.silenciado) {
      // Congelamos el transporte: al reactivar, la música sigue donde iba.
      this._detenerTransporte();
    } else {
      this._reanudarContexto();
      if (this.pausas.size === 0 && this.nombreMusicaActual) {
        this._rampaMusica(VOLUMEN_MUSICA, 0.4);
        this._arrancarTransporte();
      }
    }

    return this.silenciado;
  }

  estaSilenciado() {
    return this.silenciado;
  }

  // Fade out y parada total de la música (Game Over).
  detenerMusica(segundos = 1.5) {
    if (!this.ctx) return;
    this._rampaMusica(0, segundos);

    if (this.timerDetencion) clearTimeout(this.timerDetencion);
    this.timerDetencion = setTimeout(() => {
      this._detenerTransporte();
      this.nombreMusicaActual = null;
      this.paso = 0;
      this.timerDetencion = null;
    }, segundos * 1000);
  }

  // Efecto puntual. Cada llamada crea sus propios nodos, así que los
  // efectos se solapan entre sí sin cortar la música ni a los demás.
  reproducirEfecto(nombre) {
    if (!this.ctx || this.silenciado) return;

    const ahora = this.ctx.currentTime;
    const anterior = this.ultimoEfecto[nombre];
    if (anterior !== undefined && ahora - anterior < MS_MINIMOS_ENTRE_EFECTOS / 1000) return;
    this.ultimoEfecto[nombre] = ahora;

    this._efecto(nombre, ahora + 0.001);
  }

  /* ----------------------------------------------------------
     Secuenciador de música
     ---------------------------------------------------------- */

  _arrancarTransporte() {
    if (!this.ctx || this.intervalo || !this.nombreMusicaActual) return;
    this.proximoPaso = this.ctx.currentTime + 0.08;
    this._planificar();
    this.intervalo = setInterval(() => this._planificar(), 25);
  }

  _detenerTransporte() {
    if (this.intervalo) {
      clearInterval(this.intervalo);
      this.intervalo = null;
    }
  }

  // Programa con antelación (lookahead) todos los pasos que caen dentro
  // de la ventana siguiente. Es la técnica estándar para que un
  // secuenciador de Web Audio no se desfase con setInterval.
  _planificar() {
    if (!this.ctx) return;
    const pista = PISTAS[this.nombreMusicaActual];
    if (!pista) return;

    const duracionPaso = 60 / pista.bpm / 4; // 16 pasos por compás
    const limite = this.ctx.currentTime + 0.12;

    while (this.proximoPaso < limite) {
      this._programarPaso(this.paso, this.proximoPaso, pista, duracionPaso);
      this.paso++;
      this.proximoPaso += duracionPaso;
    }
  }

  _programarPaso(paso, inicio, pista, duracionPaso) {
    const compas = Math.floor(paso / 16);
    const pasoEnCompas = paso % 16;
    const semitonosCompas = pista.progresion[compas % pista.progresion.length];
    const raizCompas = this._frec(pista.raiz, semitonosCompas);

    // Pad: acorde completo al inicio del compás, sostenido todo el compás.
    if (pasoEnCompas === 0) {
      const duracionCompas = duracionPaso * 16;
      for (const semitono of pista.acorde) {
        this._pad(this._frec(raizCompas, semitono), inicio, duracionCompas, 0.05);
      }
    }

    // Bajo: nota larga con filtro descendente.
    if (pista.golpesBajo.includes(pasoEnCompas)) {
      this._nota(raizCompas, inicio, duracionPaso * 6, 0.34, {
        tipo: "triangle",
        filtro: { frec: 700, frecFin: 220, q: 3 },
      });
    }

    // Arpegio: una nota cada dos pasos.
    if (pasoEnCompas % 2 === 0) {
      const indice = Math.floor(paso / 2) % pista.arpegio.length;
      this._nota(this._frec(raizCompas, pista.arpegio[indice]), inicio, duracionPaso * 1.6, 0.11, {
        tipo: "triangle",
        filtro: { frec: 2600, frecFin: 900, q: 2 },
      });
    }
  }

  // Frecuencia de una nota: raíz desplazada N semitonos.
  _frec(raiz, semitonos) {
    return raiz * Math.pow(2, semitonos / 12);
  }

  /* ----------------------------------------------------------
     Voces de síntesis
     ---------------------------------------------------------- */

  // Oscilador con envolvente y filtro opcional.
  _nota(frecuencia, inicio, duracion, ganancia, opciones = {}) {
    const { tipo = "triangle", filtro = null } = opciones;

    const osc = this.ctx.createOscillator();
    osc.type = tipo;
    osc.frequency.setValueAtTime(frecuencia, inicio);

    const envolvente = this.ctx.createGain();
    envolvente.gain.setValueAtTime(0.0001, inicio);
    envolvente.gain.linearRampToValueAtTime(ganancia, inicio + 0.012);
    envolvente.gain.exponentialRampToValueAtTime(0.0001, inicio + duracion);

    let salida = osc;
    if (filtro) {
      const nodoFiltro = this.ctx.createBiquadFilter();
      nodoFiltro.type = "lowpass";
      nodoFiltro.frequency.setValueAtTime(filtro.frec, inicio);
      if (filtro.frecFin) {
        nodoFiltro.frequency.exponentialRampToValueAtTime(filtro.frecFin, inicio + duracion);
      }
      nodoFiltro.Q.value = filtro.q || 1;
      osc.connect(nodoFiltro);
      salida = nodoFiltro;
    }

    salida.connect(envolvente);
    envolvente.connect(this.musicaGain);

    osc.start(inicio);
    osc.stop(inicio + duracion + 0.08);
  }

  // Acorde de pad: tres osciladores desafinados con ataque y liberación largos.
  _pad(frecuencia, inicio, duracion, ganancia) {
    const envolvente = this.ctx.createGain();
    envolvente.gain.setValueAtTime(0.0001, inicio);
    envolvente.gain.linearRampToValueAtTime(ganancia, inicio + 1.6);
    envolvente.gain.setValueAtTime(ganancia, inicio + duracion - 1.2);
    envolvente.gain.linearRampToValueAtTime(0.0001, inicio + duracion);

    const filtro = this.ctx.createBiquadFilter();
    filtro.type = "lowpass";
    filtro.frequency.setValueAtTime(900, inicio);
    filtro.Q.value = 0.7;

    filtro.connect(envolvente);
    envolvente.connect(this.musicaGain);

    // Pequeña desafinación por voz: da cuerpo sin sonar "digital".
    for (const desafinado of [-7, 0, 6]) {
      const osc = this.ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(frecuencia, inicio);
      osc.detune.setValueAtTime(desafinado, inicio);
      osc.connect(filtro);
      osc.start(inicio);
      osc.stop(inicio + duracion + 0.2);
    }
  }

  // Barrido de frecuencia (láseres, bombo de las explosiones).
  _barrido(inicio, { tipo, frecIni, frecFin, dur, gan, q = 4 }) {
    const osc = this.ctx.createOscillator();
    osc.type = tipo;
    osc.frequency.setValueAtTime(frecIni, inicio);
    osc.frequency.exponentialRampToValueAtTime(frecFin, inicio + dur);

    const filtro = this.ctx.createBiquadFilter();
    filtro.type = "lowpass";
    filtro.frequency.setValueAtTime(Math.max(frecIni, frecFin) * 1.5, inicio);
    filtro.Q.value = q;

    const envolvente = this.ctx.createGain();
    envolvente.gain.setValueAtTime(0.0001, inicio);
    envolvente.gain.linearRampToValueAtTime(gan, inicio + 0.008);
    envolvente.gain.exponentialRampToValueAtTime(0.0001, inicio + dur);

    osc.connect(filtro);
    filtro.connect(envolvente);
    envolvente.connect(this.efectosGain);

    osc.start(inicio);
    osc.stop(inicio + dur + 0.05);
  }

  // Explosión: ruido blanco filtrado + un golpe grave opcional.
  _explosion(inicio, { dur, gan, frecIni, frecFin, bombo = 0 }) {
    const fuente = this.ctx.createBufferSource();
    fuente.buffer = this.bufferRuido;
    fuente.loop = true;

    const filtro = this.ctx.createBiquadFilter();
    filtro.type = "lowpass";
    filtro.frequency.setValueAtTime(frecIni, inicio);
    filtro.frequency.exponentialRampToValueAtTime(frecFin, inicio + dur);
    filtro.Q.value = 0.8;

    const envolvente = this.ctx.createGain();
    envolvente.gain.setValueAtTime(0.0001, inicio);
    envolvente.gain.linearRampToValueAtTime(gan, inicio + 0.01);
    envolvente.gain.exponentialRampToValueAtTime(0.0001, inicio + dur);

    fuente.connect(filtro);
    filtro.connect(envolvente);
    envolvente.connect(this.efectosGain);

    fuente.start(inicio);
    fuente.stop(inicio + dur + 0.05);

    if (bombo) {
      this._barrido(inicio, { tipo: "sine", frecIni: bombo, frecFin: 40, dur: dur * 0.7, gan: gan * 0.8, q: 1 });
    }
  }

  // Secuencia corta de notas (power-up ascendente, game over descendente).
  _secuencia(inicio, notas, { tipo = "triangle", dur, gan, espaciado }) {
    notas.forEach((frecuencia, indice) => {
      this._barrido(inicio + indice * espaciado, {
        tipo,
        frecIni: frecuencia,
        frecFin: frecuencia,
        dur,
        gan,
        q: 1,
      });
    });
  }

  // Buffer de ruido blanco de 1 segundo, generado una sola vez y reutilizado.
  _crearBufferRuido() {
    const longitud = Math.floor(this.ctx.sampleRate);
    const buffer = this.ctx.createBuffer(1, longitud, this.ctx.sampleRate);
    const datos = buffer.getChannelData(0);
    for (let i = 0; i < longitud; i++) {
      datos[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  // Tabla de efectos. Cada uno es corto, solapable y sin ruido excesivo.
  _efecto(nombre, inicio) {
    switch (nombre) {
      case "disparoJugador":
        this._barrido(inicio, { tipo: "sawtooth", frecIni: 1200, frecFin: 280, dur: 0.09, gan: 0.22, q: 6 });
        break;

      case "disparoEnemigo":
        this._barrido(inicio, { tipo: "square", frecIni: 620, frecFin: 180, dur: 0.12, gan: 0.14, q: 5 });
        break;

      case "golpe":
        this._explosion(inicio, { dur: 0.12, gan: 0.18, frecIni: 1600, frecFin: 500, bombo: 150 });
        break;

      case "explosionEnemigo":
        this._explosion(inicio, { dur: 0.34, gan: 0.3, frecIni: 2200, frecFin: 160, bombo: 120 });
        break;

      case "explosionAsteroide":
        this._explosion(inicio, { dur: 0.5, gan: 0.34, frecIni: 1400, frecFin: 90, bombo: 90 });
        break;

      case "powerup":
        this._secuencia(inicio, [660, 831, 988, 1319], { dur: 0.1, gan: 0.16, espaciado: 0.06 });
        break;

      case "gameOver":
        this._secuencia(inicio, [440, 415, 349, 261], { dur: 0.4, gan: 0.2, espaciado: 0.17 });
        break;

      default:
        console.warn(`[audio] Efecto desconocido: "${nombre}"`);
    }
  }

  /* ----------------------------------------------------------
     Utilidades
     ---------------------------------------------------------- */

  _rampaMusica(valor, segundos) {
    if (!this.ctx || !this.musicaGain) return;
    const ganancia = this.musicaGain.gain;
    const ahora = this.ctx.currentTime;
    ganancia.cancelScheduledValues(ahora);
    ganancia.setValueAtTime(ganancia.value, ahora);
    ganancia.linearRampToValueAtTime(valor, ahora + segundos);
  }
}

export const sound = new SoundManager();
