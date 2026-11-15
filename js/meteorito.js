export default class Meteorito {
  constructor(canvasWidth, canvasHeight = 600, speed = 2) {
    this.r = 18 + Math.random() * 20;
    this.x =
      Math.random() * (canvasWidth - this.r * 2) + this.r;
    this.y = -this.r * 2;
    this.speed = speed;
    this.canvasHeight = canvasHeight;
    this.markedForRemoval = false;

    this.img = new Image();
    this.img.src = "assets/images/roca-espacial.svg";
    this.imgLoaded = false;
    this.img.onload = () => {
      this.imgLoaded = true;
    };
  }

  get width() {
    return this.r * 2;
  }

  get height() {
    return this.r * 2;
  }

  update() {
    this.y += this.speed;
    if (this.y > this.canvasHeight + this.r * 2) this.markedForRemoval = true;
  }

  draw(ctx) {
    if (this.imgLoaded && this.img.complete) {
      ctx.drawImage(this.img, this.x - this.r, this.y, this.r * 2, this.r * 2);
    } else {
      // Fallback dibujo vectorial mientras carga
      ctx.save();
      ctx.translate(this.x, this.y + this.r);

      ctx.fillStyle = "#777";
      ctx.beginPath();
      const puntas = 8;
      for (let i = 0; i < puntas; i++) {
        const ang = (i / puntas) * Math.PI * 2;
        const radio = this.r * (0.6 + Math.sin(i * 2.3) * 0.35);
        const px = Math.cos(ang) * radio;
        const py = Math.sin(ang) * radio;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#555";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.restore();
    }
  }
}
