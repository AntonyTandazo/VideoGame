import EnemyBullet from "./enemyBullet.js";
import PowerUp from "./powerup.js";

export default class Enemy {
  constructor(canvasWidth, canvasHeight = 600, speed = 2) {
    this.width = 70;
    this.height = 70;
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
    this.x = Math.random() * (canvasWidth - this.width);
    this.y = -this.height;
    this.speed = speed;

    // Vida de la nave enemiga
    this.vida = 100;
    this.maxVida = 100;

    this.markedForRemoval = false;
    this.ultimoDisparo = 0;
    this.cadenciaDisparo = 1500 + Math.random() * 2000; // ms entre disparos

    this.img = new Image();
    this.img.src = "assets/images/navecita_enemiga.svg";
    this.imgLoaded = false;
    this.img.onload = () => {
      this.imgLoaded = true;
    };
  }

  update() {
    this.y += this.speed;
    if (this.y > this.canvasHeight + this.height) this.markedForRemoval = true;
  }

  puedeDisparar(tiempoActual) {
    return tiempoActual - this.ultimoDisparo >= this.cadenciaDisparo;
  }

  disparar(tiempoActual) {
    if (!this.puedeDisparar(tiempoActual)) return null;
    this.ultimoDisparo = tiempoActual;
    this.cadenciaDisparo = 1500 + Math.random() * 2000;
    return new EnemyBullet(this.x + this.width / 2, this.y + this.height, this.canvasHeight);
  }

  recibirDaño(cantidad) {
    this.vida -= cantidad;
  }

  soltarPowerUp() {
    const tipos = ["escudo", "disparo", "vida"];
    const pesos = [0.4, 0.4, 0.2];
    const azar = Math.random();
    let acumulado = 0;
    for (let i = 0; i < tipos.length; i++) {
      acumulado += pesos[i];
      if (azar <= acumulado) return tipos[i];
    }
    return "vida";
  }

  draw(ctx) {
    if (this.imgLoaded && this.img.complete) {
      ctx.save();
      ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
      ctx.rotate((Math.PI / 180) * 180); // giro 180 grados
      ctx.drawImage(this.img, -this.width / 2, -this.height / 2, this.width, this.height);
      ctx.restore();
    } else {
      // Fallback dibujo vectorial mientras carga (rotado 180)
      ctx.save();
      ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
      ctx.rotate((Math.PI / 180) * 180);

      ctx.fillStyle = "#f44";
      ctx.beginPath();
      ctx.moveTo(0, -20);
      ctx.lineTo(-20, 12);
      ctx.lineTo(-10, 8);
      ctx.lineTo(-6, 16);
      ctx.lineTo(0, 12);
      ctx.lineTo(6, 16);
      ctx.lineTo(10, 8);
      ctx.lineTo(20, 12);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "#66ffff";
      ctx.beginPath();
      ctx.ellipse(0, -6, 8, 10, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }
}
