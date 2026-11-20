import Player from "./player.js";
import Enemy from "./enemy.js";
import Meteorito from "./meteorito.js";
import Bullet from "./bullet.js";
import EnemyBullet from "./enemyBullet.js";
import PowerUp from "./powerup.js";
import SubJefe from "./subjefe.js";
import Jefe from "./jefe.js";
import { sound } from "./sound.js";

// Configuración del sistema de progresión (ajustable fácilmente)
// Para pruebas rápidas, cambiar tiempoSubjefe a 10 (segundos)
export const CONFIG = {
  /* --- Dimensiones lógicas del canvas (proporción 16:10 panorámica) --- */
  canvasAncho: 960,             // 960x600 mantiene nitidez y amplía el campo visual lateral
  canvasAlto: 600,
  anchoReferenciaDensidad: 800, // ancho base sobre el que se calculaba la densidad de enemigos

  tiempoSubjefe: 90,            // segundos de juego activo hasta sub-jefe (1:30 min)
  subjefesPorJefe: 5,           // sub-jefes a derrotar para que aparezca el JEFE
  bonusJugadorSubjefe: 0.03,    // al derrotar sub-jefe: +3% daño y +3% vida máxima (compuesto)
  bonusJugadorJefe: 0.06,       // al derrotar JEFE: +6% daño y +6% vida máxima (compuesto)
  aumentoEnemigosJefe: 0.04,    // al derrotar JEFE: enemigos normales +4% vida y daño (compuesto)
  aumentoSubjefesJefe: 0.05,    // al derrotar JEFE: sub-jefes +5% vida y daño (compuesto)
  curacionSubjefe: 1,           // 1 = restaura 100% de la vida máxima al derrotar un sub-jefe
  curacionJefe: 1,              // 1 = restaura 100% de la vida máxima al derrotar al jefe

  /* --- Frecuencia de enemigos durante boss y transición de retorno --- */
  factorEnemigosSubjefe: 0.4,   // con un sub-jefe vivo aparecen solo el 40% de los enemigos normales
  factorEnemigosJefe: 0.3,      // con el jefe vivo aparecen solo el 30%
  duracionRetornoEnemigos: 2500, // ms que tarda en volver al 100% tras derrotar al boss

  /* --- Sub-jefe: entrada, patrulla y disparo --- */
  alturaCombateSubjefe: 0.2,     // 20% de la altura del canvas: dónde se detiene a pelear
  velocidadEntradaSubjefe: 2.5,  // px por frame mientras desciende
  velocidadLateralSubjefe: 2.4,  // px por frame de patrulla lateral
  cadenciaDisparoSubjefe: 1800,  // ms entre disparos ya en combate

  /* --- Jefe: patrulla más lenta y disparo en ráfagas (más agresivo) --- */
  alturaCombateJefe: 0.18,       // el jefe se queda un poco más arriba que el sub-jefe
  velocidadEntradaJefe: 2.0,     // px por frame mientras desciende
  velocidadLateralJefe: 1.2,     // px por frame de patrulla lateral
  cadenciaDisparoJefe: 1500,     // ms de pausa entre ráfagas
  rafagaJefe: 3,                 // disparos por ráfaga
  intervaloRafagaJefe: 180,      // ms entre disparos de una misma ráfaga

  /* --- Contacto del jugador contra un boss --- */
  dañoContactoSubjefe: 60,       // daño al jugador al chocar con el sub-jefe
  dañoContactoJefe: 100,         // daño al jugador al chocar con el jefe
  cooldownContactoBoss: 800,     // ms de gracia para no dañar en cada frame
  framesGolpeBoss: 6             // frames que dura el parpadeo al ser golpeado
};

export class Game {
  constructor(canvas) {
    // Aplicar dimensiones lógicas configuradas
    canvas.width = CONFIG.canvasAncho;
    canvas.height = CONFIG.canvasAlto;
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    if (this.ctx) {
      this.ctx.imageSmoothingEnabled = true;
      this.ctx.imageSmoothingQuality = "high";
    }
    this.player = new Player(canvas.width, canvas.height);
    this.bullets = [];
    this.enemyBullets = [];
    this.enemies = [];
    this.meteoritos = [];
    this.powerups = [];
    this.subJefes = []; // solo uno activo a la vez
    this.jefe = null; // solo uno activo a la vez

    this.score = 0;
    this.lives = 3;
    this.gameOver = false;
    this.startTime = Date.now();

    // Progresión
    this.numeroFase = 1; // ciclo actual (1, 2, 3...)
    this.subjefesCiclo = 0; // sub-jefes derrotados en el ciclo actual (0 a 5)

    // Multiplicadores acumulativos (empiezan en 1)
    this.multiplicadorVidaEnemigos = 1; // enemigos normales
    this.multiplicadorDañoEnemigos = 1; // daño disparos/choque enemigos normales
    this.multiplicadorVidaSubjefes = 1; // sub-jefes
    this.multiplicadorDañoSubjefes = 1; // daño de disparos de sub-jefes

    // Factor dinámico de spawn de enemigos normales (1.0 = normal, 0.4 = sub-jefe, 0.3 = jefe)
    this.factorEnemigosActual = 1.0;
    this.ultimoTiempoTransicionEnemigos = Date.now();

    // Temporizador de sub-jefe (solo avanza en juego activo, sin sub-jefe ni jefe vivo)
    this.tiempoJuegoAcumulado = 0;
    this.ultimoTiempoJuego = Date.now();

    // Avisos de pantalla
    this.avisoTexto = "";
    this.avisoTiempoRestante = 0;
    this.mostrandoAvisoJefe = false;
    this.tiempoAvisoJefe = 0;

    // Curaciones pendientes de feedback visual (las consume main.js)
    this.curacionPendiente = 0;

    // Fondo espacial
    this.fondo = new Image();
    this.fondo.src = "assets/images/fondo-espacial.svg";
    this.fondoLoaded = false;
    this.fondo.onload = () => {
      this.fondoLoaded = true;
    };

    // Dificultad progresiva (enemigos normales por frames)
    this.frameCount = 0;
    this.baseEnemySpeed = 2;
    this.baseMeteoritoSpeed = 2;
    this.baseEnemyInterval = 60;
    this.baseMeteoritoInterval = 90;
    this.enemyTimer = 0;
    this.meteoritoTimer = 0;

    // Spawn de power-ups (cada 400 frames ~6.6s a 60fps)
    this.powerupTimer = 0;
    this.powerupInterval = 400;

    // El disparo del jugador se maneja desde main.js (loop) para permitir cadencia continua.
  }

  /* ---------- Utilidades de progresión ---------- */

  tiempoTranscurrido() {
    return Math.floor((Date.now() - this.startTime) / 1000);
  }

  /**
   * Acumula segundos de juego activo.
   * No avanza en pausa, pantallas de intro, ni mientras haya sub-jefe o jefe vivo.
   */
  actualizarTiempoJuego(tiempoActual) {
    const haySubjefe = this.subJefes.length > 0;
    const hayJefe = this.jefe !== null;

    if (haySubjefe || hayJefe) {
      // Reiniciar marca para no contar tiempo mientras haya jefe/sub-jefe
      this.ultimoTiempoJuego = tiempoActual;
      return;
    }

    const delta = (tiempoActual - this.ultimoTiempoJuego) / 1000;
    this.tiempoJuegoAcumulado += delta;
    this.ultimoTiempoJuego = tiempoActual;
  }

  tiempoRestanteSubjefe() {
    return Math.max(0, CONFIG.tiempoSubjefe - Math.floor(this.tiempoJuegoAcumulado));
  }

  spawnearSubjefe() {
    if (this.subJefes.length > 0 || this.jefe !== null || this.mostrandoAvisoJefe) return;
    const numero = this.subjefesCiclo + 1;
    const subjefe = new SubJefe(this.canvas.width, this.canvas.height, numero, CONFIG);
    // Escalar vida y daño por multiplicadores acumulados del juego
    subjefe.vida = Math.floor(subjefe.vida * this.multiplicadorVidaSubjefes);
    subjefe.maxVida = subjefe.vida;
    subjefe.dañoDisparo = Math.floor(subjefe.dañoDisparo * this.multiplicadorDañoSubjefes);
    this.subJefes.push(subjefe);
    this.tiempoJuegoAcumulado = 0;
    this.ultimoTiempoJuego = Date.now();
    this.mostrarAviso(`¡SUB-JEFE #${numero} APARECE!`, 3500);
  }

  spawnearJefe() {
    if (this.jefe !== null || this.subJefes.length > 0) return;
    this.jefe = new Jefe(
      this.canvas.width,
      this.canvas.height,
      this.multiplicadorVidaEnemigos, // jefe usa multiplicador de enemigos como base
      this.multiplicadorDañoSubjefes,
      CONFIG
    );
    this.tiempoJuegoAcumulado = 0;
    this.ultimoTiempoJuego = Date.now();
    this.mostrarAviso("¡JEFE FINAL!", 3500);
  }

  /**
   * Aplica un bono compuesto al jugador: +bono de daño de disparo y
   * +bono de vida máxima, manteniendo la proporción de vida actual.
   */
  aplicarBonoJugador(bono) {
    if (!this.player.factorDañoDisparo) this.player.factorDañoDisparo = 1;
    this.player.factorDañoDisparo *= 1 + bono;

    const vidaAntes = this.player.maxVida;
    this.player.maxVida = Math.floor(this.player.maxVida * (1 + bono));
    const porcentaje = this.player.vida / vidaAntes;
    this.player.vida = Math.floor(this.player.maxVida * porcentaje);
    if (this.player.vida > this.player.maxVida) this.player.vida = this.player.maxVida;
  }

  /**
   * Cura al jugador un porcentaje de su vida máxima (factor 1 = 100%).
   * Debe llamarse DESPUÉS de aumentar la vida máxima, para curar sobre el valor nuevo.
   * Solo cura si el jugador sigue vivo y el juego no terminó.
   * Marca `curacionPendiente` para que main.js muestre el feedback visual.
   */
  curarJugador(factor) {
    if (this.gameOver || this.player.vida <= 0 || !factor || factor <= 0) return;

    const cura = Math.floor(this.player.maxVida * factor);
    this.player.vida = Math.min(this.player.maxVida, this.player.vida + cura);

    this.curacionPendiente++;
    sound.reproducirEfecto("powerup"); // reutiliza el efecto de power-up de vida
  }

  aplicarBonusJugadorSubjefe() {
    // 1) Bono de daño y vida máxima (+3%)
    this.aplicarBonoJugador(CONFIG.bonusJugadorSubjefe);
    // 2) Cura al máximo DESPUÉS del aumento de vida máxima
    this.curarJugador(CONFIG.curacionSubjefe);

    this.mostrarAviso("+3% poder, +3% vida", 2500);
  }

  aplicarBonosJefe() {
    // 1) Bono de daño y vida máxima del jugador (+6%)
    this.aplicarBonoJugador(CONFIG.bonusJugadorJefe);
    // 2) Cura al máximo DESPUÉS del aumento de vida máxima
    this.curarJugador(CONFIG.curacionJefe);

    // Enemigos normales +4% vida y daño (compuesto)
    this.multiplicadorVidaEnemigos *= 1 + CONFIG.aumentoEnemigosJefe;
    this.multiplicadorDañoEnemigos *= 1 + CONFIG.aumentoEnemigosJefe;

    // Sub-jefes +5% vida y daño (compuesto)
    this.multiplicadorVidaSubjefes *= 1 + CONFIG.aumentoSubjefesJefe;
    this.multiplicadorDañoSubjefes *= 1 + CONFIG.aumentoSubjefesJefe;

    this.mostrarAviso("+6% poder, +6% vida", 2500);
  }

  mostrarAviso(texto, duracionMs) {
    this.avisoTexto = texto;
    this.avisoTiempoRestante = duracionMs;
  }

  /* ---------- Dificultad progresiva (enemigos normales por frames) ---------- */

  subirDificultad() {
    this.frameCount++;
    if (this.frameCount % 600 === 0) {
      this.baseEnemySpeed += 0.4;
      this.baseMeteoritoSpeed += 0.4;
      this.baseEnemyInterval = Math.max(25, this.baseEnemyInterval - 6);
      this.baseMeteoritoInterval = Math.max(35, this.baseMeteoritoInterval - 6);
    }
  }

  /* ---------- Spawns ---------- */

  spawnEnemy() {
    this.enemyTimer++;
    // Intervalo ajustado proporcionalmente al ancho (1c) y reducido durante bosses (3b/3f)
    const factorDensidad = this.canvas.width / CONFIG.anchoReferenciaDensidad;
    const factorBoss = Math.max(0.1, this.factorEnemigosActual || 1.0);
    const intervaloCompensado = Math.max(
      10,
      Math.floor(this.baseEnemyInterval / (factorDensidad * factorBoss))
    );

    if (this.enemyTimer >= intervaloCompensado) {
      const speed = this.baseEnemySpeed + Math.random() * 2;
      const enemigo = new Enemy(this.canvas.width, this.canvas.height, speed);
      // Aplicar aumento de vida de enemigos por ciclos de jefe
      if (this.multiplicadorVidaEnemigos > 1) {
        enemigo.vida = Math.floor(enemigo.vida * this.multiplicadorVidaEnemigos);
        enemigo.maxVida = enemigo.vida;
      }
      this.enemies.push(enemigo);
      this.enemyTimer = 0;
    }
  }

  spawnMeteorito() {
    this.meteoritoTimer++;
    const factorDensidad = this.canvas.width / CONFIG.anchoReferenciaDensidad;
    const intervaloCompensado = Math.max(15, Math.floor(this.baseMeteoritoInterval / factorDensidad));

    if (this.meteoritoTimer >= intervaloCompensado) {
      const speed = this.baseMeteoritoSpeed + Math.random() * 2;
      this.meteoritos.push(new Meteorito(this.canvas.width, this.canvas.height, speed));
      this.meteoritoTimer = 0;
    }
  }

  spawnPowerUp() {
    this.powerupTimer++;
    if (this.powerupTimer >= this.powerupInterval) {
      const tipos = ["escudo", "disparo", "vida"];
      const pesos = [0.35, 0.35, 0.3];
      const azar = Math.random();
      let acumulado = 0;
      let tipoSeleccionado = "vida";
      for (let i = 0; i < tipos.length; i++) {
        acumulado += pesos[i];
        if (azar <= acumulado) {
          tipoSeleccionado = tipos[i];
          break;
        }
      }
      this.powerups.push(new PowerUp(this.canvas.width, this.canvas.height, tipoSeleccionado));
      this.powerupTimer = 0;
      this.powerupInterval = 300 + Math.random() * 400;
    }
  }

  /* ---------- Colisiones y daño ---------- */

  colisionRect(circuloX, circuloY, radio, rectX, rectY, rectW, rectH) {
    const cx = Math.max(rectX, Math.min(circuloX, rectX + rectW));
    const cy = Math.max(rectY, Math.min(circuloY, rectY + rectH));
    const dx = circuloX - cx;
    const dy = circuloY - cy;
    return dx * dx + dy * dy <= radio * radio;
  }

  /**
   * Contacto directo del jugador contra un boss (sub-jefe o jefe).
   * Regla: el boss NO muere ni desaparece por el choque; solo el jugador
   * recibe daño. El cooldown por boss evita que la colisión vuelva a dañar
   * en cada frame mientras las dos naves siguen superpuestas.
   */
  colisionJugadorBoss(boss, dañoContacto, tiempoActual) {
    if (!boss || !boss.esBoss || boss.derrotado) return;

    const superpuestos =
      this.player.x < boss.x + boss.width &&
      this.player.x + this.player.width > boss.x &&
      this.player.y < boss.y + boss.height &&
      this.player.y + this.player.height > boss.y;
    if (!superpuestos) return;

    if (tiempoActual - boss.ultimoContacto < CONFIG.cooldownContactoBoss) return;

    boss.ultimoContacto = tiempoActual;
    this.aplicarDañoJugador(dañoContacto);
  }

  aplicarDañoJugador(cantidad) {
    // El escudo absorbe primero
    if (this.player.escudo.activo) {
      this.player.escudo.impactos--;
      sound.reproducirEfecto("golpe");
      if (this.player.escudo.impactos <= 0) {
        this.player.escudo.activo = false;
        this.player.escudo.impactos = 4;
      }
      return;
    }

    this.player.vida -= cantidad;
    sound.reproducirEfecto("golpe");

    if (this.player.vida <= 0) {
      this.lives--;
      this.player.vida = this.player.maxVida;
      if (this.lives <= 0) {
        this.gameOver = true;
        sound.reproducirEfecto("gameOver");
      }
    }
  }

  /* ---------- Bucle de lógica ---------- */

  update() {
    if (this.gameOver) return;

    const tiempoActual = Date.now();

    // Actualizar temporizador de juego activo (no avanza en pausa ni con jefe/sub-jefe vivo)
    this.actualizarTiempoJuego(tiempoActual);

    // Actualizar avisos
    if (this.avisoTiempoRestante > 0) {
      this.avisoTiempoRestante -= 16; // ~60fps
      if (this.avisoTiempoRestante <= 0) {
        this.avisoTexto = "";
        this.avisoTiempoRestante = 0;
      }
    }

    // Manejo de aviso de jefe (pausa de ~3s antes de spawnear)
    if (this.mostrandoAvisoJefe) {
      this.tiempoAvisoJefe -= 16;
      if (this.tiempoAvisoJefe <= 0) {
        this.mostrandoAvisoJefe = false;
        this.spawnearJefe();
      }
    }

    // Actualizar factor de frecuencia de enemigos normales (boss activo o transición gradual)
    let factorObjetivo = 1.0;
    if (this.jefe && !this.jefe.derrotado) {
      factorObjetivo = CONFIG.factorEnemigosJefe;
    } else if (this.subJefes.some((s) => !s.derrotado)) {
      factorObjetivo = CONFIG.factorEnemigosSubjefe;
    }

    if (this.factorEnemigosActual > factorObjetivo) {
      // Entrada del boss: reducción inmediata a su cuota
      this.factorEnemigosActual = factorObjetivo;
      this.ultimoTiempoTransicionEnemigos = tiempoActual;
    } else if (this.factorEnemigosActual < factorObjetivo) {
      // Salida/derrota del boss: retorno gradual hacia 1.0 en duracionRetornoEnemigos (2.5s)
      const delta = Math.min(100, Math.max(0, tiempoActual - this.ultimoTiempoTransicionEnemigos));
      const incremento = delta / CONFIG.duracionRetornoEnemigos;
      this.factorEnemigosActual = Math.min(factorObjetivo, this.factorEnemigosActual + incremento);
      this.ultimoTiempoTransicionEnemigos = tiempoActual;
    } else {
      this.ultimoTiempoTransicionEnemigos = tiempoActual;
    }

    this.subirDificultad();
    this.player.update(tiempoActual);

    // Progresión: spawnear sub-jefe cuando se cumple el tiempo y no hay jefe/sub-jefe activo ni aviso
    if (
      this.jefe === null &&
      this.subJefes.length === 0 &&
      !this.mostrandoAvisoJefe &&
      this.tiempoJuegoAcumulado >= CONFIG.tiempoSubjefe
    ) {
      this.spawnearSubjefe();
    }

    // Disparos enemigos (normales)
    this.enemies.forEach((e) => {
      if (e.puedeDisparar(tiempoActual)) {
        const bala = e.disparar(tiempoActual);
        if (bala) {
          if (this.multiplicadorDañoEnemigos > 1) {
            bala.daño = Math.floor(bala.daño * this.multiplicadorDañoEnemigos);
          }
          this.enemyBullets.push(bala);
          sound.reproducirEfecto("disparoEnemigo");
        }
      }
    });

    // Disparos de sub-jefes
    this.subJefes.forEach((s) => {
      if (s.puedeDisparar(tiempoActual)) {
        const bala = s.disparar(tiempoActual);
        if (bala) {
          this.enemyBullets.push(bala);
          sound.reproducirEfecto("disparoEnemigo");
        }
      }
    });

    // Disparos del jefe
    if (this.jefe) {
      if (this.jefe.puedeDisparar(tiempoActual)) {
        const bala = this.jefe.disparar(tiempoActual);
        if (bala) {
          this.enemyBullets.push(bala);
          sound.reproducirEfecto("disparoEnemigo");
        }
      }
      this.jefe.update();
      // El jefe solo se retira cuando su vida llegó a 0 (flag `derrotado`).
      // Nunca por posición: no sale del canvas ni desaparece por tiempo.
      if (this.jefe.derrotado) {
        this.jefe = null;
      }
    }

    // Balas del jugador
    this.bullets.forEach((b) => b.update());
    this.bullets = this.bullets.filter((b) => !b.markedForRemoval);

    // Balas enemigas
    this.enemyBullets.forEach((b) => b.update());
    this.enemyBullets = this.enemyBullets.filter((b) => !b.markedForRemoval);

    // Enemigos normales
    this.spawnEnemy();
    this.enemies.forEach((e) => e.update());
    this.enemies = this.enemies.filter((e) => !e.markedForRemoval);

    // Sub-jefes: se actualizan cada frame igual que los enemigos, pero NO se
    // eliminan por posición (nunca salen del canvas). Solo se retiran cuando
    // su vida llegó a 0, es decir cuando `derrotado` es true.
    this.subJefes.forEach((s) => s.update());
    this.subJefes = this.subJefes.filter((s) => !s.derrotado);

    // Meteoritos
    this.spawnMeteorito();
    this.meteoritos.forEach((m) => m.update());
    this.meteoritos = this.meteoritos.filter((m) => !m.markedForRemoval);

    // Power-ups
    this.spawnPowerUp();
    this.powerups.forEach((p) => p.update());
    this.powerups = this.powerups.filter((p) => !p.markedForRemoval);

    // --- COLISIONES ---

    // Bala jugador vs enemigos normales, sub-jefes, jefe y meteoritos
    this.bullets.forEach((b) => {
      if (b.propietario !== "jugador") return;

      this.enemies.forEach((e) => {
        if (
          b.x > e.x &&
          b.x < e.x + e.width &&
          b.y > e.y &&
          b.y < e.y + e.height
        ) {
          const daño = b.daño * (this.player.factorDañoDisparo || 1);
          e.recibirDaño(daño);
          b.markedForRemoval = true;
          sound.reproducirEfecto("golpe");
          if (e.vida <= 0) {
            e.markedForRemoval = true;
            this.score += 10;
            sound.reproducirEfecto("explosionEnemigo");
            if (Math.random() < 0.15) {
              this.powerups.push(new PowerUp(this.canvas.width, this.canvas.height, e.soltarPowerUp()));
            }
          }
        }
      });

      // Bala jugador vs sub-jefes
      this.subJefes.forEach((s) => {
        if (
          b.x > s.x &&
          b.x < s.x + s.width &&
          b.y > s.y &&
          b.y < s.y + s.height
        ) {
          const daño = b.daño * (this.player.factorDañoDisparo || 1);
          s.recibirDaño(daño);
          b.markedForRemoval = true;
          sound.reproducirEfecto("golpe");
          // `!s.derrotado` evita aplicar el bono/curación dos veces si varios
          // disparos impactan al sub-jefe en el mismo frame: la derrota se
          // dispara UNA sola vez.
          if (s.vida <= 0 && !s.derrotado) {
            s.derrotado = true;
            this.score += 50;
            this.subjefesCiclo++;
            this.tiempoJuegoAcumulado = 0;
            this.ultimoTiempoJuego = tiempoActual;
            this.aplicarBonusJugadorSubjefe();
            sound.reproducirEfecto("explosionEnemigo");

            // Si se completan 5 sub-jefes, preparar jefe (aviso + pausa 3s)
            if (this.subjefesCiclo >= CONFIG.subjefesPorJefe) {
              this.mostrandoAvisoJefe = true;
              this.tiempoAvisoJefe = 3000;
              this.subjefesCiclo = 0;
            }
          }
        }
      });

      // Bala jugador vs jefe
      if (this.jefe) {
        if (
          b.x > this.jefe.x &&
          b.x < this.jefe.x + this.jefe.width &&
          b.y > this.jefe.y &&
          b.y < this.jefe.y + this.jefe.height
        ) {
          const daño = b.daño * (this.player.factorDañoDisparo || 1);
          this.jefe.recibirDaño(daño);
          b.markedForRemoval = true;
          sound.reproducirEfecto("golpe");
          // `!derrotado` evita aplicar los bonos/curación dos veces si varios
          // disparos impactan al jefe en el mismo frame: la derrota se dispara
          // UNA sola vez.
          if (this.jefe.vida <= 0 && !this.jefe.derrotado) {
            this.jefe.derrotado = true;
            this.score += 500;
            this.aplicarBonosJefe();
            this.numeroFase++;
            this.subjefesCiclo = 0;
            this.tiempoJuegoAcumulado = 0;
            this.ultimoTiempoJuego = tiempoActual;
            sound.reproducirEfecto("explosionEnemigo");
          }
        }
      }

      // Bala jugador vs meteoritos
      this.meteoritos.forEach((m) => {
        if (
          b.x > m.x - m.r &&
          b.x < m.x + m.r &&
          b.y > m.y - m.r &&
          b.y < m.y + m.r
        ) {
          m.markedForRemoval = true;
          b.markedForRemoval = true;
          this.score += 5;
          sound.reproducirEfecto("explosionAsteroide");
        }
      });
    });

    // Balas enemigas vs jugador (colisión círculo vs rectángulo)
    this.enemyBullets.forEach((b) => {
      const cx = Math.max(this.player.x, Math.min(b.x, this.player.x + this.player.width));
      const cy = Math.max(this.player.y, Math.min(b.y, this.player.y + this.player.height));
      const dx = b.x - cx;
      const dy = b.y - cy;
      if (dx * dx + dy * dy <= b.radio * b.radio) {
        b.markedForRemoval = true;
        this.aplicarDañoJugador(b.daño);
      }
    });

    // Jugador vs enemigos normales (colisión directa)
    this.enemies.forEach((e) => {
      if (
        this.player.x < e.x + e.width &&
        this.player.x + this.player.width > e.x &&
        this.player.y < e.y + e.height &&
        this.player.y + this.player.height > e.y
      ) {
        e.markedForRemoval = true;
        const daño = Math.floor(40 * (this.multiplicadorDañoEnemigos || 1));
        this.aplicarDañoJugador(daño);
      }
    });

    // Jugador vs sub-jefe / jefe (colisión directa).
    // El boss NO muere ni desaparece por el choque: solo el jugador recibe daño.
    this.subJefes.forEach((s) =>
      this.colisionJugadorBoss(s, CONFIG.dañoContactoSubjefe, tiempoActual)
    );
    this.colisionJugadorBoss(this.jefe, CONFIG.dañoContactoJefe, tiempoActual);

    // Jugador vs meteoritos (colisión directa)
    this.meteoritos.forEach((m) => {
      if (
        this.player.x < m.x + m.width &&
        this.player.x + this.player.width > m.x &&
        this.player.y < m.y + m.height &&
        this.player.y + this.player.height > m.y
      ) {
        m.markedForRemoval = true;
        this.aplicarDañoJugador(40);
      }
    });

    // Jugador vs power-ups
    this.powerups.forEach((p) => {
      const pLeft = p.x - p.ancho / 2;
      const pRight = p.x + p.ancho / 2;
      const pTop = p.y - p.alto / 2;
      const pBottom = p.y + p.alto / 2;
      if (
        this.player.x < pRight &&
        this.player.x + this.player.width > pLeft &&
        this.player.y < pBottom &&
        this.player.y + this.player.height > pTop
      ) {
        p.markedForRemoval = true;
        if (p.tipo === "escudo") {
          this.player.activarEscudo(tiempoActual);
          sound.reproducirEfecto("powerup");
        } else if (p.tipo === "disparo") {
          this.player.activarDisparoContinuo(tiempoActual);
          sound.reproducirEfecto("powerup");
        } else if (p.tipo === "vida") {
          if (this.lives < 3) {
            this.lives++;
          }
          sound.reproducirEfecto("powerup");
        }
      }
    });

    // Limpieza inmediata de bosses derrotados tras las colisiones
    this.subJefes = this.subJefes.filter((s) => !s.derrotado);
    if (this.jefe && this.jefe.derrotado) {
      this.jefe = null;
    }
  }

  /* ---------- Renderizado ---------- */

  draw() {
    // Dibujar fondo galáctico en modo "cover" proporcional (sin deformar la imagen)
    if (this.fondoLoaded && this.fondo.complete) {
      const cw = this.canvas.width;
      const ch = this.canvas.height;
      const iw = this.fondo.naturalWidth || this.fondo.width || cw;
      const ih = this.fondo.naturalHeight || this.fondo.height || ch;
      const escala = Math.max(cw / iw, ch / ih);
      const dw = iw * escala;
      const dh = ih * escala;
      const dx = (cw - dw) / 2;
      const dy = (ch - dh) / 2;
      this.ctx.drawImage(this.fondo, dx, dy, dw, dh);
    } else {
      this.ctx.fillStyle = "#05050a";
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    this.player.draw(this.ctx);
    this.bullets.forEach((b) => b.draw(this.ctx));
    this.enemyBullets.forEach((b) => b.draw(this.ctx));
    this.enemies.forEach((e) => e.draw(this.ctx));
    this.subJefes.forEach((s) => s.draw(this.ctx));
    if (this.jefe) this.jefe.draw(this.ctx);
    this.meteoritos.forEach((m) => m.draw(this.ctx));
    this.powerups.forEach((p) => p.draw(this.ctx));
  }
}
