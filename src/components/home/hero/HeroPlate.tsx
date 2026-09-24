"use client";

import { useEffect, useRef } from "react";
import { logoPaths } from "@/components/brand/Logo";
import { whenIntroDone } from "@/components/motion/Loader";
import { gsap, prefersReducedMotion } from "@/lib/gsap";
import {
  CUTS,
  HOLE_R,
  HOLES,
  PERF,
  PLATE,
  SLOT,
  STAR,
  VIEW,
  perforations,
  platePolygon,
  starPath,
} from "./plate-geometry";
import { createSparks } from "./sparks";

interface HeroPlateProps {
  photo: string;
  labels: { part: string; sequence: string };
}

const TOTAL_STEPS = CUTS.length + 1; // + perforation raster
const DOTS = perforations();
const STAR_D = starPath(STAR.cx, STAR.cy, STAR.R);
const pct = (v: number, of: number) => `${((v / of) * 100).toFixed(3)}%`;
const PLATE_CLIP = `polygon(${pct(PLATE.x0, VIEW.w)} ${pct(PLATE.y0, VIEW.h)}, ${pct(PLATE.x1 - PLATE.chamfer, VIEW.w)} ${pct(
  PLATE.y0,
  VIEW.h,
)}, ${pct(PLATE.x1, VIEW.w)} ${pct(PLATE.y0 + PLATE.chamfer, VIEW.h)}, ${pct(PLATE.x1, VIEW.w)} ${pct(PLATE.y1, VIEW.h)}, ${pct(
  PLATE.x0,
  VIEW.w,
)} ${pct(PLATE.y1, VIEW.h)})`;

/**
 * Signature hero object: a brushed plate that RAWASY's laser cuts in front of
 * the visitor — bolt holes, an eight-point star, a slot and a perforation
 * field — with sparks, engineering dimensions, a cursor-reactive reflection,
 * a CNC-style crosshair and a laser that follows the pointer.
 */
export function HeroPlate({ photo, labels }: HeroPlateProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const tiltRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const shineRef = useRef<HTMLDivElement>(null);
  const seqRef = useRef<HTMLSpanElement>(null);
  const readoutRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const tilt = tiltRef.current;
    const svg = svgRef.current;
    const canvas = canvasRef.current;
    if (!root || !tilt || !svg || !canvas) return;

    const q = <T extends Element>(sel: string) => svg.querySelector<T>(sel);
    const kerfs = CUTS.map((cut) => ({
      cut,
      el: q<SVGPathElement>(`[data-kerf="${cut.id}"]`)!,
      hole: q<SVGPathElement>(`[data-hole="${cut.id}"]`)!,
      length: 0,
    }));
    const head = q<SVGGElement>("[data-head]")!;
    const piece = q<SVGGElement>("[data-piece]")!;
    const perfClip = q<SVGRectElement>("[data-perf-clip]")!;
    const cross = q<SVGGElement>("[data-cross]")!;
    const crossX = q<SVGLineElement>("[data-cross-x]")!;
    const crossY = q<SVGLineElement>("[data-cross-y]")!;
    const dims = svg.querySelectorAll<SVGElement>("[data-dim]");
    const perfWidth = PERF.x1 - PERF.x0 + PERF.step * 2;
    const setSeq = (n: number) => {
      if (seqRef.current) seqRef.current.textContent = `${String(n).padStart(2, "0")}/${String(TOTAL_STEPS).padStart(2, "0")}`;
    };

    const finalState = () => {
      kerfs.forEach((k) => {
        k.hole.setAttribute("opacity", "1");
        k.el.setAttribute("stroke-dasharray", "none");
      });
      perfClip.setAttribute("width", String(perfWidth));
      piece.style.opacity = "0";
      head.style.opacity = "0";
      gsap.set([tilt, ...dims], { opacity: 1 });
      setSeq(TOTAL_STEPS);
    };

    if (prefersReducedMotion()) {
      finalState();
      return;
    }

    const sparks = createSparks(canvas, VIEW);
    sparks.resize();
    const ro = new ResizeObserver(() => sparks.resize());
    ro.observe(canvas);

    let introDone = false;
    // Server HTML shows the finished part (no-JS / reduced motion); reset it to
    // an uncut plate before the sequence plays. `.js` CSS keeps it hidden until then.
    const ctx = gsap.context(() => {
      gsap.set(tilt, { opacity: 0, y: 36 });
      gsap.set(dims, { opacity: 0 });
      setSeq(0);
      perfClip.setAttribute("width", "0");
      kerfs.forEach((k) => {
        k.length = k.el.getTotalLength();
        k.hole.setAttribute("opacity", "0");
        k.el.setAttribute("stroke", "var(--accent)");
        k.el.setAttribute("stroke-width", "1.8");
        k.el.setAttribute("stroke-dasharray", `${k.length}`);
        k.el.setAttribute("stroke-dashoffset", `${k.length}`);
      });
    }, root);

    const tl = gsap.timeline({ paused: true, onComplete: () => (introDone = true) });
    ctx.add(() => {
      tl.to(tilt, { opacity: 1, y: 0, duration: 1.2, ease: "expo.out" }, 0);
      tl.to(dims, { opacity: 1, duration: 0.8, stagger: 0.07, ease: "power2.out" }, 0.35);
      let t = 1.0;
      kerfs.forEach((k, i) => {
        const proxy = { p: 0 };
        tl.set(head, { opacity: 1 }, t);
        tl.to(
          proxy,
          {
            p: 1,
            duration: k.cut.duration,
            ease: k.cut.kind === "star" ? "power1.inOut" : "none",
            onStart: () => setSeq(i + 1),
            onUpdate: () => {
              const len = k.length * proxy.p;
              k.el.setAttribute("stroke-dashoffset", `${k.length - len}`);
              const pt = k.el.getPointAtLength(len);
              head.setAttribute("transform", `translate(${pt.x} ${pt.y})`);
              sparks.emit(pt.x, pt.y, k.cut.kind === "hole" ? 2 : 3);
            },
          },
          t,
        );
        t += k.cut.duration;
        tl.set(k.hole, { attr: { opacity: 1 } }, t);
        tl.set(k.el, { attr: { stroke: "var(--metal-edge)", "stroke-width": 1 } }, t + 0.9);
        if (k.cut.kind === "star") {
          tl.set(piece, { opacity: 1 }, t);
          tl.to(piece, { x: 12, y: 46, rotation: 7, opacity: 0, transformOrigin: "50% 50%", duration: 1.5, ease: "power2.in" }, t + 0.4);
          t += 0.5;
        }
        t += 0.14;
      });
      // Perforation raster: the head sweeps while the field is opened.
      const raster = { p: 0 };
      tl.to(
        raster,
        {
          p: 1,
          duration: 1.25,
          ease: "none",
          onStart: () => setSeq(TOTAL_STEPS),
          onUpdate: () => {
            const x = PERF.x0 - PERF.step + perfWidth * raster.p;
            perfClip.setAttribute("width", `${perfWidth * raster.p}`);
            const row = Math.floor((raster.p * 40) % PERF.rows);
            const y = PERF.y0 + row * PERF.step;
            head.setAttribute("transform", `translate(${x} ${y})`);
            if (Math.random() < 0.6) sparks.emit(x, y, 1, 0.7);
          },
        },
        t,
      );
      t += 1.25;
      tl.to(head, { opacity: 0, duration: 0.35 }, t);
    });

    const cancelIntro = whenIntroDone(() => tl.play());

    // ---------- Pointer: tilt, reflection, crosshair, cursor laser ----------
    const section = root.closest("section") ?? root;
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    let raf = 0;
    let rx = 0;
    let ry = 0;
    let trx = 0;
    let try_ = 0;
    let lastX = 0;
    let lastY = 0;

    const loop = () => {
      rx += (trx - rx) * 0.08;
      ry += (try_ - ry) * 0.08;
      tilt.style.transform = `rotateX(${rx.toFixed(3)}deg) rotateY(${ry.toFixed(3)}deg)`;
      raf = Math.abs(trx - rx) > 0.01 || Math.abs(try_ - ry) > 0.01 ? requestAnimationFrame(loop) : 0;
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const r = tilt.getBoundingClientRect();
      const nx = (e.clientX - r.left) / r.width;
      const ny = (e.clientY - r.top) / r.height;
      trx = (0.5 - Math.min(Math.max(ny, 0), 1)) * 7;
      try_ = (Math.min(Math.max(nx, 0), 1) - 0.5) * 9;
      if (!raf) raf = requestAnimationFrame(loop);

      if (shineRef.current) {
        shineRef.current.style.transform = `translate3d(${nx * r.width}px, ${ny * r.height}px, 0)`;
        shineRef.current.style.opacity = "1";
      }

      const x = nx * VIEW.w;
      const y = ny * VIEW.h;
      const inside = x > PLATE.x0 && x < PLATE.x1 && y > PLATE.y0 && y < PLATE.y1;
      cross.style.opacity = inside ? "1" : "0";
      if (readoutRef.current) readoutRef.current.style.opacity = inside ? "1" : "0";
      if (!inside) return;
      crossX.setAttribute("transform", `translate(0 ${y.toFixed(1)})`);
      crossY.setAttribute("transform", `translate(${x.toFixed(1)} 0)`);
      if (readoutRef.current) {
        const mmX = (x - PLATE.x0).toFixed(1).padStart(5, "0");
        const mmY = (PLATE.y1 - y).toFixed(1).padStart(5, "0");
        readoutRef.current.textContent = `X ${mmX} · Y ${mmY}`;
      }
      if (introDone) {
        const speed = Math.hypot(x - lastX, y - lastY);
        sparks.scribe(x, y);
        if (speed > 6) sparks.emit(x, y, Math.min(3, Math.round(speed / 10)), 0.6);
      }
      lastX = x;
      lastY = y;
    };

    const onLeave = () => {
      trx = 0;
      try_ = 0;
      if (!raf) raf = requestAnimationFrame(loop);
      cross.style.opacity = "0";
      if (shineRef.current) shineRef.current.style.opacity = "0";
      if (readoutRef.current) readoutRef.current.style.opacity = "0";
    };

    if (fine) {
      section.addEventListener("pointermove", onMove as EventListener, { passive: true });
      section.addEventListener("pointerleave", onLeave);
    }

    // ---------- Scroll: plate drifts and settles as the hero leaves ----------
    const st = gsap.to(root, {
      yPercent: -9,
      ease: "none",
      scrollTrigger: { trigger: section, start: "top top", end: "bottom top", scrub: 0.6 },
    });

    return () => {
      cancelIntro();
      tl.kill();
      st.scrollTrigger?.kill();
      st.kill();
      ctx.revert();
      cancelAnimationFrame(raf);
      sparks.destroy();
      ro.disconnect();
      if (fine) {
        section.removeEventListener("pointermove", onMove as EventListener);
        section.removeEventListener("pointerleave", onLeave);
      }
    };
  }, []);

  const [mt, mb] = [logoPaths.markTop, logoPaths.markBottom];

  return (
    <div ref={rootRef} className="relative mx-auto aspect-[640/760] h-auto w-full [perspective:1400px]">
      <div ref={tiltRef} className="hero-plate-tilt relative h-full w-full will-change-transform [transform-style:preserve-3d]">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VIEW.w} ${VIEW.h}`}
          className="absolute inset-0 h-full w-full overflow-visible"
          style={{ direction: "ltr", unicodeBidi: "isolate" }}
          aria-hidden
          focusable="false"
        >
          <defs>
            <linearGradient id="hp-metal" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" style={{ stopColor: "var(--metal-b)" }} />
              <stop offset="0.42" style={{ stopColor: "var(--metal-a)" }} />
              <stop offset="0.68" style={{ stopColor: "var(--metal-b)" }} />
              <stop offset="1" style={{ stopColor: "var(--metal-c)" }} />
            </linearGradient>
            <filter id="hp-brush" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
              <feTurbulence type="fractalNoise" baseFrequency="0.003 0.8" numOctaves="2" seed="11" />
              <feColorMatrix type="saturate" values="0" />
            </filter>
            <filter id="hp-soft" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="7" />
            </filter>
            <filter id="hp-shadow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="16" />
            </filter>
            <radialGradient id="hp-heat" cx="0.5" cy="0.45" r="0.6">
              <stop offset="0" stopColor="#f15f22" stopOpacity="0.28" />
              <stop offset="1" stopColor="#0c0d0e" stopOpacity="0.55" />
            </radialGradient>
            <clipPath id="hp-plate-clip">
              <polygon points={platePolygon} />
            </clipPath>
            <clipPath id="hp-star-clip">
              <path d={STAR_D} />
            </clipPath>
            <clipPath id="hp-perf-clip">
              <rect
                data-perf-clip
                x={PERF.x0 - PERF.step}
                y={PERF.y0 - PERF.step}
                width={PERF.x1 - PERF.x0 + PERF.step * 2}
                height={PERF.rows * PERF.step + PERF.step}
              />
            </clipPath>
            <mask id="hp-cuts" maskUnits="userSpaceOnUse" x="0" y="0" width={VIEW.w} height={VIEW.h}>
              <polygon points={platePolygon} fill="white" />
              {CUTS.map((cut) => (
                <path key={cut.id} data-hole={cut.id} d={cut.d} fill="black" opacity="1" />
              ))}
              <g clipPath="url(#hp-perf-clip)">
                {DOTS.map((d) => (
                  <circle key={`${d.cx}-${d.cy}`} cx={d.cx} cy={d.cy} r={PERF.r} fill="black" />
                ))}
              </g>
            </mask>
          </defs>

          {/* Soft cast shadow */}
          <polygon points={platePolygon} transform="translate(14 22)" fill="rgb(0 0 0 / 0.22)" filter="url(#hp-shadow)" />

          {/* What the cuts reveal: the fabrication floor, glowing */}
          <g clipPath="url(#hp-plate-clip)">
            <rect x={PLATE.x0} y={PLATE.y0} width={PLATE.x1 - PLATE.x0} height={PLATE.y1 - PLATE.y0} fill="#0d0e0f" />
            <image
              href={photo}
              x={PLATE.x0}
              y={PLATE.y0}
              width={PLATE.x1 - PLATE.x0}
              height={PLATE.y1 - PLATE.y0}
              preserveAspectRatio="xMidYMid slice"
            />
            <rect x={PLATE.x0} y={PLATE.y0} width={PLATE.x1 - PLATE.x0} height={PLATE.y1 - PLATE.y0} fill="url(#hp-heat)" />
          </g>

          {/* The plate, with every opened cut masked away */}
          <g mask="url(#hp-cuts)">
            <polygon points={platePolygon} fill="url(#hp-metal)" />
            <rect
              x={PLATE.x0}
              y={PLATE.y0}
              width={PLATE.x1 - PLATE.x0}
              height={PLATE.y1 - PLATE.y0}
              filter="url(#hp-brush)"
              opacity="0.32"
              style={{ mixBlendMode: "overlay" }}
            />
            {/* Laser-engraved maker's mark and part code */}
            <g opacity="0.5" fill="none" stroke="var(--metal-edge)" strokeWidth="1.1">
              <g transform="translate(262 626) scale(0.12) translate(-70.8 -201.37)">
                <path d={mt} strokeWidth="9" />
                <path d={mb} strokeWidth="9" />
              </g>
            </g>
            <text
              x="302"
              y="647"
              fill="var(--metal-edge)"
              opacity="0.8"
              style={{ font: "500 10.5px var(--ff-mono)", letterSpacing: "0.18em" }}
            >
              RW—01
            </text>
            {/* Bevel highlight */}
            <polyline
              points={`${PLATE.x0 + 1},${PLATE.y1 - 1} ${PLATE.x0 + 1},${PLATE.y0 + 1} ${PLATE.x1 - PLATE.chamfer},${PLATE.y0 + 1}`}
              fill="none"
              stroke="rgb(255 255 255 / 0.55)"
              strokeWidth="1.2"
            />
          </g>
          <polygon points={platePolygon} fill="none" stroke="var(--metal-edge)" strokeWidth="1" />

          {/* Kerfs — orange while hot, cooling to the plate edge colour */}
          <g fill="none" strokeLinecap="round" strokeLinejoin="round">
            {CUTS.map((cut) => (
              <path key={cut.id} data-kerf={cut.id} d={cut.d} stroke="var(--metal-edge)" strokeWidth="1" />
            ))}
          </g>

          {/* The star piece falls away once cut */}
          <g data-piece style={{ opacity: 0 }}>
            <g clipPath="url(#hp-star-clip)">
              <polygon points={platePolygon} fill="url(#hp-metal)" />
              <rect
                x={PLATE.x0}
                y={PLATE.y0}
                width={PLATE.x1 - PLATE.x0}
                height={PLATE.y1 - PLATE.y0}
                filter="url(#hp-brush)"
                opacity="0.32"
                style={{ mixBlendMode: "overlay" }}
              />
            </g>
            <path d={STAR_D} fill="none" stroke="var(--accent)" strokeWidth="1.4" />
          </g>

          {/* Engineering dimensions */}
          <g className="text-ink-3" fill="none" stroke="currentColor" strokeWidth="0.8">
            <g data-dim>
              <path d={`M${PLATE.x0} 30H${PLATE.x1}M${PLATE.x0} 22V44M${PLATE.x1} 22V44`} />
              <path d={`M${PLATE.x0 + 8} 26L${PLATE.x0} 30L${PLATE.x0 + 8} 34M${PLATE.x1 - 8} 26L${PLATE.x1} 30L${PLATE.x1 - 8} 34`} />
              <text x="320" y="21" textAnchor="middle" fill="currentColor" stroke="none" style={{ font: "500 11px var(--ff-mono)", letterSpacing: "0.12em" }}>
                520.00
              </text>
            </g>
            <g data-dim>
              <path d={`M30 ${PLATE.y0}V${PLATE.y1}M22 ${PLATE.y0}H44M22 ${PLATE.y1}H44`} />
              <path d={`M26 ${PLATE.y0 + 8}L30 ${PLATE.y0}L34 ${PLATE.y0 + 8}M26 ${PLATE.y1 - 8}L30 ${PLATE.y1}L34 ${PLATE.y1 - 8}`} />
              <text
                x="21"
                y={(PLATE.y0 + PLATE.y1) / 2}
                textAnchor="middle"
                fill="currentColor"
                stroke="none"
                transform={`rotate(-90 21 ${(PLATE.y0 + PLATE.y1) / 2})`}
                style={{ font: "500 11px var(--ff-mono)", letterSpacing: "0.12em" }}
              >
                640.00
              </text>
            </g>
            <g data-dim opacity="0.7" strokeDasharray="10 4 2 4">
              <path d={`M${PLATE.x0 - 10} ${STAR.cy}H${PLATE.x1 + 14}M${STAR.cx} ${PLATE.y0 - 8}V${PLATE.y1 + 14}`} />
            </g>
            <g data-dim>
              <path d={`M${STAR.cx + 96} ${STAR.cy - 96}L${PLATE.x1 + 26} ${STAR.cy - 150}H${PLATE.x1 + 52}`} />
              <text x={PLATE.x1 + 28} y={STAR.cy - 156} fill="currentColor" stroke="none" style={{ font: "500 11px var(--ff-mono)", letterSpacing: "0.1em" }}>
                R128
              </text>
            </g>
            <g data-dim>
              <path d={`M${PLATE.x1 - 20} ${PLATE.y0 + 20}L${PLATE.x1 + 18} ${PLATE.y0 - 18}H${PLATE.x1 + 50}`} />
              <text x={PLATE.x1 + 20} y={PLATE.y0 - 24} fill="currentColor" stroke="none" style={{ font: "500 11px var(--ff-mono)", letterSpacing: "0.1em" }}>
                45°×40
              </text>
            </g>
            <g data-dim>
              <path d={`M${HOLES[3].cx - HOLE_R * 0.7} ${HOLES[3].cy + HOLE_R * 0.7}L${PLATE.x0 - 6} ${PLATE.y1 + 30}H${PLATE.x0 - 40}`} />
              <text
                x={PLATE.x0 - 4}
                y={PLATE.y1 + 46}
                textAnchor="end"
                fill="currentColor"
                stroke="none"
                style={{ font: "500 11px var(--ff-mono)", letterSpacing: "0.1em" }}
              >
                4×Ø22
              </text>
            </g>
            <g data-dim>
              <path d={`M${SLOT.x + SLOT.w} ${SLOT.y + SLOT.h / 2}L${PLATE.x1 + 26} ${SLOT.y + 60}H${PLATE.x1 + 52}`} />
              <text x={PLATE.x1 + 28} y={SLOT.y + 76} fill="currentColor" stroke="none" style={{ font: "500 11px var(--ff-mono)", letterSpacing: "0.1em" }}>
                240×28
              </text>
            </g>
          </g>

          {/* CNC crosshair following the cursor */}
          <g data-cross style={{ opacity: 0, transition: "opacity .3s" }} stroke="var(--accent)" strokeWidth="0.7">
            <line data-cross-x x1={PLATE.x0} x2={PLATE.x1} y1="0" y2="0" strokeDasharray="3 5" />
            <line data-cross-y x1="0" x2="0" y1={PLATE.y0} y2={PLATE.y1} strokeDasharray="3 5" />
          </g>

          {/* Laser head */}
          <g data-head style={{ opacity: 0 }}>
            <circle r="16" fill="#f15f22" opacity="0.45" filter="url(#hp-soft)" />
            <circle r="5" fill="#ffb27a" opacity="0.9" />
            <circle r="2.4" fill="#fff8ec" />
          </g>
        </svg>

        <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden />

        {/* Specular reflection that follows the pointer (compositor-only transform) */}
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden mix-blend-soft-light dark:mix-blend-overlay" style={{ clipPath: PLATE_CLIP }}>
          <div
            ref={shineRef}
            className="absolute -left-[210px] -top-[210px] size-[420px] rounded-full opacity-0 transition-opacity duration-500"
            style={{ background: "radial-gradient(circle, rgb(255 255 255 / 0.85), rgb(255 255 255 / 0) 62%)" }}
          />
        </div>
      </div>

      {/* Technical readouts */}
      <div className="t-label pointer-events-none absolute inset-x-[9.4%] -bottom-7 flex items-center justify-between gap-4 whitespace-nowrap text-ink-3 sm:-bottom-2">
        <span>
          <span className="hidden sm:inline">{labels.part} · </span>
          {labels.sequence}{" "}
          <span ref={seqRef} className="t-num text-accent-ink" dir="ltr">
            {String(TOTAL_STEPS).padStart(2, "0")}/{String(TOTAL_STEPS).padStart(2, "0")}
          </span>
        </span>
        <span ref={readoutRef} className="t-num opacity-0 transition-opacity duration-300" dir="ltr">
          X 000.0 · Y 000.0
        </span>
      </div>
    </div>
  );
}
