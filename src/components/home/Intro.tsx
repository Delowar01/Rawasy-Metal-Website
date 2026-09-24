import Link from "next/link";
import { ArrowIcon } from "@/components/ui/Icons";

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
    <section id="intro" aria-labelledby="intro-title" className="relative overflow-hidden pb-16 pt-[var(--section-y)] md:pb-20">
      <div className="container-x">
        <div className="grid gap-x-10 gap-y-14 lg:grid-cols-12">
          <div className="lg:col-span-6">
            <p className="t-label eyebrow" data-reveal="fade">
              <span className="t-num">{index}</span>
              <span aria-hidden>/</span>
              <span>{label}</span>
            </p>
            <h2 id="intro-title" className="intro-statement mt-8 max-w-[19ch] text-ink" data-reveal>
              {statement}
            </h2>

            {/* Nameplate: the company's registered names, like an engraved plate */}
            <div className="mt-14 inline-flex max-w-full flex-col gap-3 border border-line-strong px-6 py-5" data-reveal style={{ ["--d" as string]: 150 }}>
              <span className="t-label text-ink-3" lang="en" dir="ltr">
                {legalNames.en}
              </span>
              <span className="text-lg font-medium text-ink-2" lang="ar" dir="rtl">
                {legalNames.ar}
              </span>
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
                  <li key={item} className="border border-line px-3 py-1.5 text-sm text-ink-2">
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <figure className="mt-12 border-s-2 border-accent ps-6" data-reveal>
              <figcaption className="t-label text-ink-3">{visionLabel}</figcaption>
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
