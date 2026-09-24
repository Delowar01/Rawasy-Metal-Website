import Link from "next/link";
import { ArrowIcon } from "@/components/ui/Icons";
import { Phrases } from "@/components/ui/Phrases";
import { Backdrop } from "@/components/visual/Backdrop";
import { Nameplate } from "@/components/visual/Nameplate";

export interface IntroProps {
  index: string;
  label: string;
  statement: string;
  paragraphs: string[];
  beyondLabel: string;
  beyond: string[];
  visionLabel: string;
  vision: string;
  link: { href: string; label: string };
  legalNames: { en: string; ar: string };
}

/** Who is RAWASY? — editorial statement on one side, short readable copy on the other. */
export function Intro({ index, label, statement, paragraphs, beyondLabel, beyond, visionLabel, vision, link, legalNames }: IntroProps) {
  return (
    <section id="intro" aria-labelledby="intro-title" className="relative isolate overflow-hidden pb-16 pt-[var(--section-y)] md:pb-20">
      {/* A faint drawing-sheet grid behind the copy column */}
      <Backdrop
        kind="fine"
        drift
        className="start-auto w-[62%] [--bd-opacity:0.8] [--bd-fade:radial-gradient(ellipse_70%_60%_at_70%_38%,transparent,var(--background)_75%)] rtl:[--bd-fade:radial-gradient(ellipse_70%_60%_at_30%_38%,transparent,var(--background)_75%)] max-lg:hidden"
      />
      <div className="container-x">
        <div className="grid gap-x-10 gap-y-14 lg:grid-cols-12">
          <div className="lg:col-span-6">
            <p className="t-label eyebrow" data-reveal="fade">
              <span className="t-num">{index}</span>
              <span aria-hidden>/</span>
              <span>{label}</span>
            </p>
            <h2 id="intro-title" className="intro-statement mt-8 max-w-[13em] text-ink" data-reveal>
              <Phrases>{statement}</Phrases>
            </h2>

            {/* Nameplate: the company's registered names on a riveted, brushed plate */}
            <div className="mt-14" data-reveal style={{ ["--d" as string]: 150 }}>
              <Nameplate en={legalNames.en} ar={legalNames.ar} />
            </div>
          </div>

          <div className="lg:col-span-5 lg:col-start-8 lg:pt-28">
            <div className="grid gap-6">
              {paragraphs.map((p, i) => (
                <p key={i} className="t-body text-[1.0625rem]" data-reveal style={{ ["--d" as string]: 80 * i }}>
                  {p}
                </p>
              ))}
            </div>

            <div className="mt-12" data-reveal>
              <p className="t-label text-ink-3">{beyondLabel}</p>
              <ul className="mt-4 flex flex-wrap gap-2">
                {beyond.map((item) => (
                  <li key={item} className="tech-tag">
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <figure className="panel-recessed mt-12 border-s-2 border-s-accent px-6 py-5" data-reveal>
              <figcaption className="t-label text-ink-2">{visionLabel}</figcaption>
              <blockquote className="mt-3 text-lg leading-relaxed text-ink">{vision}</blockquote>
            </figure>

            <Link href={link.href} className="link-arrow mt-10 text-ink" data-reveal>
              <span className="link-line">{link.label}</span>
              <ArrowIcon className="arrow rtl:-scale-x-100" />
            </Link>
          </div>
        </div>
      </div>

      <StructuralBeam />
    </section>
  );
}

/** An I-beam elevation with bolt groups that draws itself in — structural line work. */
function StructuralBeam() {
  const bolts = [140, 170, 410, 440, 680, 710, 950, 980, 1220, 1250];
  return (
    <div aria-hidden className="container-x mt-20 md:mt-24">
      <svg viewBox="0 0 1400 90" className="beam-draw w-full text-line-strong" fill="none" stroke="currentColor" data-reveal="fade">
        <path d="M0 20H1400M0 70H1400M0 26H1400M0 64H1400" strokeWidth="1" pathLength={1} />
        {[270, 540, 810, 1080].map((x) => (
          <path key={x} d={`M${x} 26V64`} strokeWidth="1" pathLength={1} />
        ))}
        {bolts.map((x) => (
          <circle key={x} cx={x} cy="45" r="5" strokeWidth="1" pathLength={1} />
        ))}
        <path d="M0 84H1400" strokeWidth="0.75" strokeDasharray="2 10" className="text-accent" stroke="currentColor" />
      </svg>
    </div>
  );
}
