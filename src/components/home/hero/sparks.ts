/**
 * Tiny canvas particle system for laser sparks and the cursor "scribe" trail.
 * Coordinates are in plate (SVG) units; the canvas maps them to device pixels.
 * The animation loop only runs while particles are alive.
 */
interface Particle {
  x: number;
  y: number;
  px: number;
  py: number;
  vx: number;
  vy: number;
  life: number;
  decay: number;
  hue: number;
  width: number;
}

interface TrailPoint {
  x: number;
  y: number;
  life: number;
}

export function createSparks(canvas: HTMLCanvasElement, view: { w: number; h: number }) {
  const ctx = canvas.getContext("2d");
  let particles: Particle[] = [];
  let trail: TrailPoint[] = [];
  let raf = 0;
  let sx = 1;
  let sy = 1;
  let dark = true;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    sx = canvas.width / view.w;
    sy = canvas.height / view.h;
  }

  function tick() {
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Cursor scribe trail
    if (trail.length > 1) {
      ctx.globalCompositeOperation = dark ? "lighter" : "source-over";
      ctx.lineCap = "round";
      for (let i = 1; i < trail.length; i++) {
        const a = trail[i - 1];
        const b = trail[i];
        const alpha = Math.min(a.life, b.life);
        ctx.strokeStyle = `rgba(241, 95, 34, ${alpha * 0.7})`;
        ctx.lineWidth = 1.4 * sx;
        ctx.beginPath();
        ctx.moveTo(a.x * sx, a.y * sy);
        ctx.lineTo(b.x * sx, b.y * sy);
        ctx.stroke();
      }
    }
    trail = trail.map((p) => ({ ...p, life: p.life - 0.035 })).filter((p) => p.life > 0);

    // Sparks
    ctx.globalCompositeOperation = dark ? "lighter" : "source-over";
    for (const p of particles) {
      p.px = p.x;
      p.py = p.y;
      p.vy += 0.16;
      p.vx *= 0.985;
      p.vy *= 0.985;
      p.x += p.vx;
      p.y += p.vy;
      p.life -= p.decay;
      const l = Math.max(p.life, 0);
      const light = dark ? 55 + l * 35 : 45 + l * 12;
      ctx.strokeStyle = `hsla(${p.hue}, 100%, ${light}%, ${l})`;
      ctx.lineWidth = p.width * sx;
      ctx.beginPath();
      ctx.moveTo(p.px * sx, p.py * sy);
      ctx.lineTo(p.x * sx, p.y * sy);
      ctx.stroke();
    }
    particles = particles.filter((p) => p.life > 0 && p.y < view.h + 20);

    raf = particles.length || trail.length ? requestAnimationFrame(tick) : 0;
  }

  function wake() {
    dark = document.documentElement.getAttribute("data-theme") === "dark";
    if (!raf) raf = requestAnimationFrame(tick);
  }

  return {
    resize,
    /** Burst of sparks at a cut point. */
    emit(x: number, y: number, count: number, power = 1) {
      if (particles.length > 260) return;
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = (1.2 + Math.random() * 4.2) * power;
        particles.push({
          x,
          y,
          px: x,
          py: y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 1.2,
          life: 1,
          decay: 0.022 + Math.random() * 0.04,
          hue: 18 + Math.random() * 28,
          width: 0.6 + Math.random() * 0.9,
        });
      }
      wake();
    },
    /** Add a point to the fading cursor trail. */
    scribe(x: number, y: number) {
      trail.push({ x, y, life: 1 });
      if (trail.length > 40) trail.shift();
      wake();
    },
    destroy() {
      cancelAnimationFrame(raf);
      particles = [];
      trail = [];
    },
  };
}
