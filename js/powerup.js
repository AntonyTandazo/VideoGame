/**
 * Colores de aura por tipo de power-up.
 * Se usa para el anillo y gradiente del aura dibujada en canvas.
 */
export const POWERUP_COLORS = {
  vida: "#39ff88",      // verde - vida extra
  escudo: "#00e5ff",    // cian - escudo
  disparo: "#ffd54a"    // dorado - disparo discontinuo / arma
};

/**
 * Canvas offscreen precalculado para el aura de cada tipo de power-up.
 * Se crea una sola vez por tipo y se reutiliza con drawImage en cada frame,
 * evitando recalcular gradientes y trazos constantemente (mejora FPS).
 */
const auraCache = {};

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}

function crearAuraCanvas(tipo, ancho, alto) {
  const color = POWERUP_COLORS[tipo];
  const padding = 45; // espacio para que el aura rodee al sprite sin apretar
  const cw = ancho + padding * 2;
  const ch = alto + padding * 2;
  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const c = canvas.getContext("2d");

  const cx = cw / 2;
  const cy = ch / 2;
  const radioSprite = Math.min(ancho, alto) / 2;
  const radioAura = radioSprite + padding * 0.55;
  const radioOscuro = radioSprite + padding * 0.25;

  // 1. Círculo oscuro semitransparente detrás del sprite (contraste sobre fondo morado)
  c.fillStyle = "rgba(0, 0, 0, 0.35)";
  c.beginPath();
  c.arc(cx, cy, radioOscuro, 0, Math.PI * 2);
  c.fill();

  // 2. Gradiente radial suave de baja opacidad (se desvanece hacia los bordes)
  const grad = c.createRadialGradient(cx, cy, 0, cx, cy, radioAura);
  grad.addColorStop(0, `rgba(${hexToRgb(color)}, 0.35)`);
  grad.addColorStop(0.35, `rgba(${hexToRgb(color)}, 0.15)`);
  grad.addColorStop(1, `rgba(${hexToRgb(color)}, 0)`);
  c.fillStyle = grad;
  c.beginPath();
  c.arc(cx, cy, radioAura, 0, Math.PI * 2);
  c.fill();

  // 3. Anillo circular definido (arc + stroke de 3px) con el color del tipo
  c.strokeStyle = color;
  c.lineWidth = 3;
  c.lineCap = "round";
  c.beginPath();
  c.arc(cx, cy, radioAura - 6, 0, Math.PI * 2);
  c.stroke();

  return canvas;
}

function obtenerAuraCanvas(tipo, ancho, alto) {
  const key = `${tipo}-${ancho}-${alto}`;
  if (!auraCache[key]) {
    auraCache[key] = crearAuraCanvas(tipo, ancho, alto);
  }
  return auraCache[key];
}

export default class PowerUp {
  /**
   * Power-up que cae del canvas.
   * Usa los SVGs power-escudo.svg, power-discontinuo.svg y power-extralife.svg tal cual,
   * dibujados con drawImage manteniendo el aspect ratio del viewBox (669x373) sin deformar.
   * Tiene una aura de color por tipo dibujada en canvas detrás del sprite.
   * La hitbox coincide con el área del sprite (sin incluir el aura).
   */
  constructor(canvasWidth, canvasHeight = 600, tipo = "vida") {
    if (typeof canvasHeight === "string") {
      tipo = canvasHeight;
      canvasHeight = 600;
    }
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
    this.tipo = tipo; // 'escudo' | 'disparo' | 'vida'

    // Aspect ratio de los SVGs de power-ups (todos son 669x373)
    const aspectRatio = 669 / 373;

    // Tamaño base aumentado ~50% (alto 40 → 60), manteniendo proporción del viewBox
    this.altoBase = 60;
    this.anchoBase = this.altoBase * aspectRatio;

    // Aura precalculada para este tipo y tamaño
    this.auraCanvas = obtenerAuraCanvas(tipo, this.anchoBase, this.altoBase);

    // Dibujado centrado en (this.x, this.y). Margen para que el aura no quede
    // cortada en los bordes del canvas.
    const paddingAura = 50;
    this.x =
      Math.random() *
        (canvasWidth - this.anchoBase - paddingAura * 2) +
      this.anchoBase / 2 +
      paddingAura;
    this.y = -this.altoBase / 2 - paddingAura;
    this.speed = 2.5;
    this.markedForRemoval = false;

    // Hitbox: mismo tamaño que el dibujo del sprite (sin incluir el aura)
    this.ancho = this.anchoBase;
    this.alto = this.altoBase;

    this.img = new Image();
    if (tipo === "escudo") {
      this.img.src = "assets/images/power-escudo.svg";
    } else if (tipo === "disparo") {
      this.img.src = "assets/images/power-discontinuo.svg";
    } else {
      this.img.src = "assets/images/power-extralife.svg";
    }
    this.imgLoaded = false;
    this.img.onload = () => {
      this.imgLoaded = true;
    };
  }

  update() {
    this.y += this.speed;

    if (this.y > this.canvasHeight + this.altoBase / 2 + 50) {
      this.markedForRemoval = true;
    }
  }

  draw(ctx) {
    const ahora = Date.now();

    // Animación de pulso: escala entre 1.0 y 1.15, ciclo ~1.2 s
    const ciclo = 1200;
    const fase = (ahora % ciclo) / ciclo;
    const escala = 1 + 0.15 * Math.sin(fase * 2 * Math.PI);
    const opacidad = 0.6 + 0.4 * Math.cos(fase * 2 * Math.PI);

    // Pequeño flote vertical de 2-3 px sobre el sprite
    const flotar = 2.5 * Math.sin(ahora / 150);

    const w = this.anchoBase * escala;
    const h = this.altoBase * escala;

    ctx.save();
    ctx.imageSmoothingEnabled = true;

    // --- AURA (precalculada, dibujada detrás del sprite) ---
    ctx.globalAlpha = opacidad;
    const aw = this.auraCanvas.width * escala;
    const ah = this.auraCanvas.height * escala;
    ctx.drawImage(
      this.auraCanvas,
      this.x - aw / 2,
      this.y - ah / 2 + flotar,
      aw,
      ah
    );
    ctx.globalAlpha = 1;

    // --- SPRITE ---
    if (this.imgLoaded && this.img.complete) {
      ctx.drawImage(
        this.img,
        this.x - w / 2,
        this.y - h / 2 + flotar,
        w,
        h
      );
    } else {
      // Fallback dibujo vectorial mientras carga la imagen
      const color =
        this.tipo === "escudo"
          ? "#0ff"
          : this.tipo === "disparo"
          ? "#ff0"
          : "#0f0";
      const simbolo =
        this.tipo === "escudo"
          ? "🛡️"
          : this.tipo === "disparo"
          ? "⚡"
          : "❤️";

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(0, 0, (this.altoBase / 2) * escala, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2 * escala;
      ctx.stroke();
      ctx.fillStyle = "#000";
      ctx.font = `${18 * escala}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(simbolo, 0, 2 * escala);
    }

    ctx.restore();
  }
}
