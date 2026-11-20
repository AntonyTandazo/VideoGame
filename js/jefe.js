import EnemyBullet from "./enemyBullet.js";

/**
 * Clase Jefe: nave final del ciclo. Aparece tras derrotar a 5 sub-jefes.
 * Usa nave-enemiga-jefe.svg y dispara con disparo-enemigo.svg.
 * Vida y daño escalan con los multiplicadores del juego.
 *
 * IMPORTANTE: igual que el sub-jefe, el jefe NO se comporta como una nave
 * enemiga normal. No cae fuera de la pantalla ni se elimina por tiempo.
 * Entra, patrulla su zona de combate y SOLO se retira cuando su vida llega
 * a 0 (flag `derrotado`, que pone game.js una única vez).
 *
 * Diferencia con el sub-jefe: patrulla más lento pero dispara en ráfagas,
 * sin tocar sus stats escalados.
 *
 * Los parámetros llegan por `config` (el objeto CONFIG de game.js) y no por
 * import, para no crear un import circular entre game.js y esta clase.
 */
export default class Jefe {
  constructor(canvasWidth, canvasHeight, multiplicadorVida, multiplicadorDaño, config) {
    this.esBoss = true; // marca explícita: no es un enemigo normal
    this.config = config;
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;

    this.width = 130;
    this.height = 130;
    this.x = Math.random() * (canvasWidth - this.width);
    this.y = -this.height; // arranca justo por encima del canvas

    // Vida y daño base escalados por multiplicadores del juego
    const vidaBase = 1500;
    const dañoBase = 80;

    this.vida = Math.floor(vidaBase * multiplicadorVida);
    this.maxVida = this.vida;
    this.dañoDisparo = Math.floor(dañoBase * multiplicadorDaño);

    // Estado del boss: "entrando" (desciende) -> "combate" (patrulla y dispara)
    this.estado = "entrando";
    this.derrotado = false; // lo pone game.js UNA sola vez, al llegar la vida a 0
    this.tiempoGolpe = 0; // frames que dura el parpadeo al ser golpeado

    // Movimiento (todo sale de CONFIG para poder ajustarlo sin tocar la clase)
    this.velocidadEntrada = config.velocidadEntradaJefe;
    this.velocidadLateral = config.velocidadLateralJefe; // más lento que el sub-jefe
    this.alturaCombate = config.alturaCombateJefe * canvasHeight;

    // Disparo en ráfagas: pausa larga entre ráfagas, pausa corta dentro de una
    this.ultimoDisparo = 0;
    this.cadenciaDisparo = config.cadenciaDisparoJefe;
    this.disparosRafaga = 0; // disparos que quedan pendientes en la ráfaga actual
    this.ultimoContacto = 0; // último choque contra el jugador (cooldown)

    this.img = new Image();
    this.img.src = "assets/images/nave-enemiga-jefe.svg";
    this.imgLoaded = false;
    this.img.onload = () => {
      this.imgLoaded = true;
    };
  }

  /**
   * Actualiza el jefe. Nunca lo marca para eliminarse por posición: lo único
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

  /**
   * Dispara solo en combate. Dentro de una ráfaga usa el intervalo corto;
   * entre ráfagas, la cadencia larga. Así queda más agresivo que el sub-jefe
   * sin tocar su vida ni su daño.
   */
  puedeDisparar(tiempoActual) {
    if (this.estado !== "combate") return false;
    const espera = this.disparosRafaga > 0 ? this.config.intervaloRafagaJefe : this.cadenciaDisparo;
    return tiempoActual - this.ultimoDisparo >= espera;
  }

  disparar(tiempoActual) {
    if (!this.puedeDisparar(tiempoActual)) return null;
    this.ultimoDisparo = tiempoActual;

    // Si no quedaban disparos pendientes, arranca una ráfaga nueva
    if (this.disparosRafaga <= 0) this.disparosRafaga = this.config.rafagaJefe;
    this.disparosRafaga--;

    const bala = new EnemyBullet(this.x + this.width / 2, this.y + this.height, this.canvasHeight);
    bala.daño = this.dañoDisparo;
    bala.img.src = "assets/images/disparo-enemigo.svg";
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

    // El jefe mira hacia abajo: se dibuja girado 180 grados desde su centro
    ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
    ctx.rotate((Math.PI / 180) * 180);

    if (this.imgLoaded && this.img.complete) {
      ctx.drawImage(this.img, -this.width / 2, -this.height / 2, this.width, this.height);
    } else {
      // Fallback vectorial mientras carga la imagen
      ctx.fillStyle = "#ff4444";
      ctx.beginPath();
      ctx.moveTo(0, -40);
      ctx.lineTo(-40, 30);
      ctx.lineTo(-20, 15);
      ctx.lineTo(-15, 35);
      ctx.lineTo(0, 30);
      ctx.lineTo(15, 35);
      ctx.lineTo(20, 15);
      ctx.lineTo(40, 30);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(0, -12, 16, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}
