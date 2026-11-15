import EnemyBullet from "./enemyBullet.js";

/**
 * Clase SubJefe: nave del pelotón que aparece periódicamente.
 * Usa nave-subjefe.svg y dispara con disparo-enemigo-subnave.svg.
 * Su vida y daño crecen compuesto por cada sub-jefe nuevo.
 *
 * IMPORTANTE: un boss NO se comporta como una nave enemiga normal.
 * No cae fuera de la pantalla ni se elimina por tiempo. Entra, se queda en
 * su zona de combate patrullando, y SOLO se retira cuando su vida llega a 0
 * (flag `derrotado`, que pone game.js una única vez). Ver `update()`.
 *
 * Los parámetros de movimiento llegan por `config` (el objeto CONFIG de
 * game.js) y no por import, para no crear un import circular entre game.js
 * y esta clase (game.js ya importa SubJefe).
 */
export default class SubJefe {
  constructor(canvasWidth, canvasHeight, numeroSubjefe, config) {
    this.esBoss = true; // marca explícita: no es un enemigo normal
    this.config = config;
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;

    this.width = 90;
    this.height = 90;
    this.x = Math.random() * (canvasWidth - this.width);
    this.y = -this.height; // arranca justo por encima del canvas
    this.numero = numeroSubjefe; // 1, 2, 3...

    // Vida y daño base del sub-jefe #1, escalados por número compuesto
    const vidaBase = 300;
    const dañoBase = 40;
    const crecimiento = 1.05; // +5% por sub-jefe

    this.vida = Math.floor(vidaBase * Math.pow(crecimiento, numeroSubjefe - 1));
    this.maxVida = this.vida;
    this.dañoDisparo = Math.floor(dañoBase * Math.pow(crecimiento, numeroSubjefe - 1));

    // Estado del boss: "entrando" (desciende) -> "combate" (patrulla y dispara)
    this.estado = "entrando";
    this.derrotado = false; // lo pone game.js UNA sola vez, al llegar la vida a 0
    this.tiempoGolpe = 0; // frames que dura el parpadeo al ser golpeado

    // Movimiento (todo sale de CONFIG para poder ajustarlo sin tocar la clase)
    this.velocidadEntrada = config.velocidadEntradaSubjefe;
    this.velocidadLateral = config.velocidadLateralSubjefe;
    // Altura de combate: el borde superior del boss se detiene acá, dentro de
    // la banda pedida (15% a 25% de la altura del canvas).
    this.alturaCombate = config.alturaCombateSubjefe * canvasHeight;

    this.ultimoDisparo = 0;
    this.cadenciaDisparo = config.cadenciaDisparoSubjefe;
    this.ultimoContacto = 0; // último choque contra el jugador (cooldown)

    this.img = new Image();
    this.img.src = "assets/images/nave-subjefe.svg";
    this.imgLoaded = false;
    this.img.onload = () => {
      this.imgLoaded = true;
    };
  }

  /**
   * Actualiza el boss. Nunca lo marca para eliminarse por posición: lo único
   * que lo saca de la partida es `derrotado`.
   */
  update() {
    if (this.derrotado) return;

    // Parpadeo por golpe: solo afecta el dibujo, no cuesta FPS
    if (this.tiempoGolpe > 0) this.tiempoGolpe--;

    // 1) Entrada: desciende en línea recta hasta la zona de combate
    if (this.estado === "entrando") {
      this.y += this.velocidadEntrada;
      if (this.y >= this.alturaCombate) {
        this.y = this.alturaCombate;
        this.estado = "combate";
      }
      return;
    }

    // 2) Combate: patrulla de lado a lado rebotando en los bordes
    this.x += this.velocidadLateral;
    if (this.x <= 0) {
      this.x = 0;
      this.velocidadLateral = Math.abs(this.velocidadLateral);
    } else if (this.x + this.width >= this.canvasWidth) {
      this.x = this.canvasWidth - this.width;
      this.velocidadLateral = -Math.abs(this.velocidadLateral);
    }

    // Clamp final: aunque cambie la velocidad, nunca sale del canvas
    this.x = Math.max(0, Math.min(this.x, this.canvasWidth - this.width));
    this.y = Math.max(0, Math.min(this.y, this.canvasHeight - this.height));
  }

  /** Solo dispara cuando ya llegó a su zona de combate. */
  puedeDisparar(tiempoActual) {
    return (
      this.estado === "combate" &&
      tiempoActual - this.ultimoDisparo >= this.cadenciaDisparo
    );
  }

  disparar(tiempoActual) {
    if (!this.puedeDisparar(tiempoActual)) return null;
    this.ultimoDisparo = tiempoActual;
    // Usamos EnemyBullet con daño del sub-jefe y su propia imagen
    const bala = new EnemyBullet(this.x + this.width / 2, this.y + this.height, this.canvasHeight);
    bala.daño = this.dañoDisparo;
    bala.img.src = "assets/images/disparo-enemigo-subnave.svg";
    bala.imgLoaded = false;
    bala.img.onload = () => {
      bala.imgLoaded = true;
    };
    return bala;
  }

  /**
   * Resta vida y enciende el parpadeo. NO marca la nave para eliminarse:
   * de eso se encarga game.js, que pone `derrotado` cuando la vida llega a 0.
   */
  recibirDaño(cantidad) {
    if (this.derrotado) return;
    this.vida -= cantidad;
    this.tiempoGolpe = this.config.framesGolpeBoss;
  }

  draw(ctx) {
    if (this.derrotado) return;
    ctx.save();
    // Parpadeo de impacto: solo opacidad, sin costo de rendimiento
    if (this.tiempoGolpe > 0) ctx.globalAlpha = 0.45;

    // El boss mira hacia abajo: se dibuja girado 180 grados desde su centro
    ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
    ctx.rotate((Math.PI / 180) * 180);

    if (this.imgLoaded && this.img.complete) {
      ctx.drawImage(this.img, -this.width / 2, -this.height / 2, this.width, this.height);
    } else {
      // Fallback vectorial mientras carga la imagen
      ctx.fillStyle = "#ffaa00";
      ctx.beginPath();
      ctx.moveTo(0, -30);
      ctx.lineTo(-30, 20);
      ctx.lineTo(-15, 10);
      ctx.lineTo(-10, 25);
      ctx.lineTo(0, 20);
      ctx.lineTo(10, 25);
      ctx.lineTo(15, 10);
      ctx.lineTo(30, 20);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(0, -10, 12, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}
