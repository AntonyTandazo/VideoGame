import Bullet from "./bullet.js";

export default class Player {
  constructor(canvasWidth, canvasHeight) {
    this.width = 50;
    this.height = 50;
    this.x = canvasWidth / 2 - this.width / 2;
    this.y = canvasHeight - 70;
    this.speed = 5;
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
    this.keys = { left: false, right: false };

    // Vida
    this.maxVida = 120;
    this.vida = 120;

    // Poderes (duracion = tiempo total activo, para la barra del HUD)
    this.escudo = { activo: false, impactos: 4, expiraEn: 0, duracion: 15000 };
    this.disparoContinuo = { activo: false, expiraEn: 0, duracion: 20000 };

    // Disparo
    this.ultimoDisparo = 0;
    this.cadenciaNormal = 300; // ms entre disparos normales
    this.cadenciaRapida = 60; // ms con poder de disparo continuo

    this.img = new Image();
    this.img.src = "assets/images/Nave-espacial.svg";
    this.imgLoaded = false;
    this.img.onload = () => {
      this.imgLoaded = true;
    };
  }

  handleInput(keys) {
    this.keys.left = keys.ArrowLeft || keys.a || keys.A;
    this.keys.right = keys.ArrowRight || keys.d || keys.D;
  }

  update(tiempoActual) {
    // Apagar poderes vencidos
    if (this.escudo.activo && tiempoActual > this.escudo.expiraEn) {
      this.escudo.activo = false;
      this.escudo.impactos = 4;
    }
    if (this.disparoContinuo.activo && tiempoActual > this.disparoContinuo.expiraEn) {
      this.disparoContinuo.activo = false;
    }

    if (this.keys.left) this.x -= this.speed;
    if (this.keys.right) this.x += this.speed;

    if (this.x < 0) this.x = 0;
    if (this.x + this.width > this.canvasWidth) this.x = this.canvasWidth - this.width;
  }

  puedeDisparar(tiempoActual) {
    const cadencia = this.disparoContinuo.activo ? this.cadenciaRapida : this.cadenciaNormal;
    return tiempoActual - this.ultimoDisparo >= cadencia;
  }

  disparar(tiempoActual) {
    if (!this.puedeDisparar(tiempoActual)) return null;
    this.ultimoDisparo = tiempoActual;
    return new Bullet(this.x + this.width / 2, this.y, -7, "#0ff", 25, "jugador", this.canvasHeight);
  }

  activarEscudo(tiempoActual) {
    this.escudo.activo = true;
    this.escudo.impactos = 4;
    this.escudo.expiraEn = tiempoActual + this.escudo.duracion; // 15 segundos
  }

  activarDisparoContinuo(tiempoActual) {
    this.disparoContinuo.activo = true;
    this.disparoContinuo.expiraEn = tiempoActual + this.disparoContinuo.duracion; // 20 segundos
  }

  draw(ctx) {
    // Escudo visual
    const ahora = Date.now();
    if (this.escudo.activo) {
      const pulso = 1 + 0.15 * Math.sin(ahora / 200);
      ctx.save();
      ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
      ctx.fillStyle = "rgba(0, 255, 255, 0.25)";
      ctx.beginPath();
      ctx.arc(0, 0, (this.width / 2 + 12) * pulso, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#0ff";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, (this.width / 2 + 12) * pulso, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Nave
    if (this.imgLoaded && this.img.complete) {
      ctx.drawImage(this.img, this.x, this.y, this.width, this.height);
    } else {
      ctx.fillStyle = "#0ff";
      ctx.fillRect(this.x, this.y, this.width, this.height);
    }
  }
}
