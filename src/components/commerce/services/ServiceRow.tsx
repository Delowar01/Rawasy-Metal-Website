import type { ServiceSlug } from "@/content/types";
import { Icon } from "../Icon";
import { Figure } from "../inner/Figure";
import { LaserEngrave } from "../signature/LaserEngrave";
import type { CommerceImage, Tone } from "../types";
import { delay, serviceIcon } from "../ui";

export interface ServiceRowView {
  slug: ServiceSlug;
  index: string;
  name: string;
  tagline: string;
  summary: string;
  highlights: string[];
  equipment: string[];
  href: string;
  tone: Tone;
  /** The cover and the supporting photo; none for Laser Engraving, which shows its signature (decision D6). */
  photos?: { cover: CommerceImage; supporting: CommerceImage };
}

/** The service's button takes its role colour: orange for laser cutting, steel for machine work, neutral otherwise. */
const BUTTON: Record<Tone, string> = { brand: "btn-primary", steel: "btn-steel", teal: "btn-secondary", brass: "btn-secondary" };

/**
 * One service on the overview (Stage TM-2.4): its number and icon, name, tagline and summary, what it includes, the
 * machines behind it (rated power where the profile states it) and the way to its page, beside its photographs — the
 * cover with the supporting photo over its lower corner, each at most at its source size. Laser Engraving shows the
 * homepage's engraving signature instead of photographs; the row is its host (it replays on hover and focus).
 */
export function ServiceRow({ service: s, labels, reverse }: { service: ServiceRowView; labels: { includes: string; equipment: string; open: string }; reverse: boolean }) {
  return (
    // No reveal on the row: the index and the hero's tiles land on it.
    <article
      id={s.slug}
      aria-labelledby={`${s.slug}-title`}
      className="card sv-row"
      data-tone={s.tone}
      data-reverse={reverse ? "" : undefined}
      data-sig-host={s.photos ? undefined : ""}
    >
      <div className="sv-row-media">
        {s.photos ? (
          <>
            <Figure image={s.photos.cover} sizes={`(min-width: 768px) ${Math.min(s.photos.cover.width, 460)}px, 88vw`} className="sv-row-cover" />
            <Figure image={s.photos.supporting} sizes={`${Math.min(s.photos.supporting.width, 240)}px`} delay={200} className="sv-row-support" />
          </>
        ) : (
          <div className="sv-row-sig" data-reveal="fade">
            <LaserEngrave />
          </div>
        )}
      </div>
      <div className="sv-row-body">
        <div className="flex items-center gap-4" data-reveal="fade">
          <span className="icon-chip icon-chip-lg">
            <Icon name={serviceIcon[s.slug]} size={26} />
          </span>
          <span aria-hidden className="sv-row-n" dir="ltr">
            {s.index}
          </span>
        </div>
        <h2 id={`${s.slug}-title`} className="t-h2 mt-5" data-reveal>
          {s.name}
        </h2>
        <p className="sv-tagline mt-3" data-reveal style={delay(60)}>
          {s.tagline}
        </p>
        <p className="t-body mt-4 max-w-[36rem]" data-reveal style={delay(120)}>
          {s.summary}
        </p>
        <div className="mt-7" data-reveal style={delay(160)}>
          <p className="sv-label">{labels.includes}</p>
          <ul className="sv-includes-list sv-includes-grid">
            {s.highlights.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        {s.equipment.length > 0 && (
          <div className="mt-6" data-reveal style={delay(200)}>
            <p className="sv-label">{labels.equipment}</p>
            <ul className="sv-tags">
              {s.equipment.map((item) => (
                <li key={item} className="tag tag-tone">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="mt-8" data-reveal style={delay(240)}>
          <a href={s.href} className={`btn ${BUTTON[s.tone]}`}>
            {`${labels.open} ${s.name}`}
            <Icon name="arrow" size={17} />
          </a>
        </div>
      </div>
    </article>
  );
}
