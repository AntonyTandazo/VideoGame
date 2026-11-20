export default class EnemyBullet {
  /**
   * Disparo enemigo (normales, sub-jefes y jefe).
   * x, y = centro del disparo (se pasa desde el centro horizontal y borde inferior de la nave enemiga).
   */
  constructor(x, y, canvasHeight = 600) {
    this.x = x; // centro horizontal del disparo
    this.y = y; // centro vertical del disparo (borde inferior de la nave enemiga)
    this.speed = 5;
    this.radio = 12; // radio de colisión y de dibujo
    this.color = "#ff4444";
    this.markedForRemoval = false;
    this.daño = 25;
    this.canvasHeight = canvasHeight;

    this.img = new Image();
    this.img.src = "assets/images/disparo-enemigo.svg";
    this.imgLoaded = false;
    this.img.onload = () => {
      this.imgLoaded = true;
    };
  }

  update() {
    this.y += this.speed;
    if (this.y > this.canvasHeight + this.radio * 2) {
      this.markedForRemoval = true;
    }
  }

  draw(ctx) {
    const d = this.radio * 2; // diámetro del dibujo
    if (this.imgLoaded && this.img.complete) {
      // Dibujar centrado en (this.x, this.y)
      ctx.drawImage(this.img, this.x - d / 2, this.y - d / 2, d, d);
    } else {
      // Fallback círculo rojo mientras carga
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radio, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
}
