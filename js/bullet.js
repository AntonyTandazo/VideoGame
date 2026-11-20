export default class Bullet {
  /**
   * Disparo del jugador.
   * x, y = centro del disparo (se pasa desde la punta frontal de la nave amiga).
   */
  constructor(x, y, speed = -7, color = "#0ff", daño = 10, propietario = "jugador", canvasHeight = 600) {
    this.x = x; // centro horizontal del disparo
    this.y = y; // centro vertical del disparo (punta de la nave)
    this.speed = speed;
    this.color = color;
    this.radio = 12; // radio de colisión y de dibujo
    this.markedForRemoval = false;
    this.daño = daño;
    this.propietario = propietario;
    this.canvasHeight = canvasHeight;

    // Disparo de la nave amiga usa su SVG
    this.img = new Image();
    this.img.src = "assets/images/disparo-navecita-amiga.svg";
    this.imgLoaded = false;
    this.img.onload = () => {
      this.imgLoaded = true;
    };
  }

  update() {
    this.y += this.speed;
    // Eliminar cuando sale del canvas (margen del radio)
    if (this.y < -this.radio * 2 || this.y > this.canvasHeight + this.radio * 2) {
      this.markedForRemoval = true;
    }
  }

  draw(ctx) {
    const d = this.radio * 2; // diámetro del dibujo
    if (this.imgLoaded && this.img.complete) {
      // Dibujar centrado en (this.x, this.y)
      ctx.drawImage(this.img, this.x - d / 2, this.y - d / 2, d, d);
    } else {
      // Fallback círculo simple mientras carga
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radio, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
