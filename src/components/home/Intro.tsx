import Image from "next/image";
import type { CSSProperties } from "react";
import { ServiceCard, type ServiceCardData } from "@/components/cards/ServiceCard";
import { SupportList } from "@/components/cards/SupportList";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Phrases } from "@/components/ui/Phrases";
import { Backdrop } from "@/components/visual/Backdrop";
import { Nameplate } from "@/components/visual/Nameplate";
import type { SupportSlug } from "@/content/types";

interface Photo {
  src: string;
  width: number;
  height: number;
  blurDataURL: string;
  alt: string;
}

export interface IntroProps {
  index: string;
  label: string;
  statement: string;
  paragraphs: string[];
  capabilitiesLabel: string;
  explore: string;
  capabilities: ServiceCardData[];
  beyondLabel: string;
  beyondTitle: string;
  beyond: { slug: SupportSlug; label: string }[];
  workshop: { main: Photo; detail: Photo; caption: string };
  visionLabel: string;
  vision: string;
  visionClosing: string;
  links: { about: { href: string; label: string }; services: { href: string; label: string } };
  legalNames: { en: string; ar: string };
}

const delay = (ms: number) => ({ ["--d" as string]: ms }) as CSSProperties;

/**
 * Who is RAWASY? The company in a statement and two paragraphs, then what it
 * does: the six service lines as cards, the site support around scaffolding,
 * genuine workshop photos and the vision. Ends with the way into About and
 * Services.
 */
export function Intro(props: IntroProps) {
  const { index, label, statement, paragraphs, capabilitiesLabel, explore, capabilities, workshop, links, legalNames } = props;
  return (
    <section id="intro" aria-labelledby="intro-title" className="relative isolate overflow-hidden pb-16 pt-[var(--section-y)] md:pb-20">
      {/* A faint drawing-sheet grid behind the copy column */}
      <Backdrop
        kind="fine"
        drift
        className="start-auto h-[48rem] w-[62%] [--bd-opacity:0.8] [--bd-fade:radial-gradient(ellipse_70%_60%_at_70%_38%,transparent,var(--background)_75%)] rtl:[--bd-fade:radial-gradient(ellipse_70%_60%_at_30%_38%,transparent,var(--background)_75%)] max-lg:hidden"
      />
      <div className="container-x">
        {/* Who we are */}
        <div className="grid gap-x-10 gap-y-12 lg:grid-cols-12">
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
            <div className="mt-12" data-reveal style={delay(150)}>
              <Nameplate en={legalNames.en} ar={legalNames.ar} />
            </div>
          </div>

          <div className="grid content-start gap-6 lg:col-span-5 lg:col-start-8 lg:pt-28">
            {paragraphs.map((p, i) => (
              <p key={i} className="t-body text-[1.0625rem]" data-reveal style={delay(80 * i)}>
                {p}
              </p>
            ))}
          </div>
        </div>

        {/* What we do: the six service lines */}
        <div className="mt-16 lg:mt-24">
          <p className="t-label flex items-center gap-4 text-ink-2" data-reveal="fade">
            <span aria-hidden className="size-1.5 shrink-0 bg-accent" />
            {capabilitiesLabel}
            <span aria-hidden className="h-px flex-1 bg-line-strong" />
          </p>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {capabilities.map((service, i) => (
              <li key={service.slug}>
                <ServiceCard service={service} action={explore} delay={(i % 3) * 70} />
              </li>
            ))}
          </ul>
        </div>

        {/* Workshop, site support and vision */}
        <div className="mt-4 grid gap-4 lg:grid-cols-12">
          <WorkshopPlate {...workshop} />

          <div className="card card-edge p-6 sm:p-7 lg:col-span-7" data-tone="proc" data-reveal>
            <p className="t-label tone-ink">{props.beyondLabel}</p>
            <h3 className="t-title mt-2 text-ink">{props.beyondTitle}</h3>
            <SupportList className="mt-6 lg:grid-cols-3" items={props.beyond} />
          </div>

          <figure className="sec-slate on-band relative isolate overflow-hidden p-6 sm:p-8 lg:col-span-7" data-reveal style={delay(90)}>
            <Backdrop kind="grid" className="[--bd-opacity:0.6]" />
            <span aria-hidden className="absolute inset-y-0 start-0 w-[3px] bg-accent" />
            <figcaption className="t-label flex items-center gap-2.5 text-band-ink-2">
              <span aria-hidden className="size-1.5 rotate-45 bg-accent" />
              {props.visionLabel}
            </figcaption>
            <blockquote className="vision-quote mt-5 max-w-[26em] text-band-ink">
              <Phrases>{props.vision}</Phrases>
            </blockquote>
            <p className="mt-6 text-[0.98rem] leading-relaxed text-band-ink-2">{props.visionClosing}</p>
          </figure>
        </div>

        <div className="mt-10 flex flex-wrap gap-3" data-reveal>
          <ButtonLink href={links.about.href} variant="secondary">
            {links.about.label}
          </ButtonLink>
          <ButtonLink href={links.services.href} variant="outline">
            {links.services.label}
          </ButtonLink>
        </div>
      </div>

      <StructuralBeam />
    </section>
  );
}

/**
 * Two genuine workshop photos on a gridded plate, each shown at close to its
 * native size (the profile's photos are small): the workshop floor, and
 * laser-cut sheets pinned over its corner.
 */
function WorkshopPlate({ main, detail, caption }: { main: Photo; detail: Photo; caption: string }) {
  return (
    <figure className="card proj-plate relative flex flex-col justify-between gap-6 overflow-hidden p-5 sm:p-7 lg:col-span-5 lg:row-span-2" data-tone="craft">
      <div className="relative pb-24 sm:pb-28">
        <div className="bg-elevated p-1.5 shadow-[var(--shadow-image)]" style={{ maxWidth: Math.round(main.width * 1.25) }} data-reveal="clip">
          <div className="relative overflow-hidden bg-strong" style={{ aspectRatio: `${main.width} / ${main.height}` }}>
            <Image
              src={main.src}
              alt={main.alt}
              fill
              sizes={`(min-width: 1024px) ${Math.round(main.width * 1.25)}px, 88vw`}
              placeholder="blur"
              blurDataURL={main.blurDataURL}
              className="object-cover"
            />
          </div>
        </div>
        <div
          className="absolute bottom-0 end-0 bg-elevated p-1.5 shadow-[var(--shadow-floating)]"
          style={{ width: `min(${Math.min(detail.width, 170)}px, 38%)` }}
          data-reveal="fade"
        >
          <div className="relative overflow-hidden bg-strong" style={{ aspectRatio: `${detail.width} / ${detail.height}` }}>
            <Image
              src={detail.src}
              alt={detail.alt}
              fill
              sizes="170px"
              placeholder="blur"
              blurDataURL={detail.blurDataURL}
              className="object-cover"
            />
          </div>
        </div>
      </div>
      <figcaption className="t-label max-w-[20rem] text-ink-2">{caption}</figcaption>
    </figure>
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
