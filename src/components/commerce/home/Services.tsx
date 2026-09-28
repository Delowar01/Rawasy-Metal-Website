import type { ServiceSlug } from "@/content/types";
import { Icon } from "../Icon";
import { LaserCut } from "../signature/LaserCut";
import { LaserEngrave } from "../signature/LaserEngrave";
import { serviceTag, serviceTone } from "../tones";
import { Photo, delay, serviceIcon } from "../ui";
import type { HomeView } from "./data";
import { SectionHead } from "./SectionHead";

type ServiceItem = HomeView["services"]["items"][number];

function ServiceLink({ label, className = "" }: { label: string; className?: string }) {
  return (
    <span className={`flex items-center gap-1.5 text-[0.9rem] font-semibold text-[var(--tone-ink)] ${className}`}>
      {label}
      <Icon name="arrow" size={16} className="go" />
    </span>
  );
}

/** The two laser services carry their signature illustrations (the service pages' own drawings, animated). */
const signature: Partial<Record<ServiceSlug, "cut" | "engrave">> = { "laser-cutting": "cut", "laser-engraving": "engrave" };
const signatureStage = { cut: "a2-stage-dark", engrave: "a2-stage-brass a2-stage-engrave" };

/** Featured card: a laser signature (cutting, engraving) on its stage, with the service's figures and tags. */
function ServiceFeature({ service: s, view }: { service: ServiceItem; view: HomeView }) {
  const sig = signature[s.slug];
  const specs = s.slug === "laser-cutting" ? view.metrics.filter((m) => m.slug === "peak-laser-power" || m.slug === "bevel-cutting") : [];
  return (
    <article className={`card card-link a2-svc ${sig ? "a2-svc-sig" : "card-edge"}`} data-tone={serviceTone[s.slug]} data-sig-host={sig ? "" : undefined}>
      <div className={`a2-stage ${sig ? `a2-stage-sig ${signatureStage[sig]}` : "card-media aspect-[16/9] lg:aspect-auto lg:min-h-[17rem] lg:flex-1"}`}>
        {sig === "cut" && <LaserCut />}
        {sig === "engrave" && <LaserEngrave />}
        {!sig && s.image && <Photo image={s.image} sizes="(min-width: 1024px) 500px, 92vw" />}
        <span className="badge badge-light absolute start-4 top-4 z-[2]">
          <Icon name={serviceIcon[s.slug]} size={14} />
          {s.highlights[0]}
        </span>
      </div>
      <div className={`flex flex-col p-5 sm:p-6 ${sig ? "flex-1" : ""}`}>
        <div className="flex items-center gap-3">
          <span className="icon-chip shrink-0">
            <Icon name={serviceIcon[s.slug]} size={22} />
          </span>
          <h3 className="t-h3">
            <a href={s.href} className="stretch outline-none">
              {s.name}
            </a>
          </h3>
        </div>
        <p className="t-small mt-3 max-w-[40em]">{s.tagline}</p>
        {specs.length > 0 && (
          <dl className="mt-4 grid grid-cols-2 gap-2.5 sm:max-w-[26rem]">
            {specs.map((m) => (
              <div key={m.slug} className="a2-spec">
                <dt className="text-[0.76rem] font-medium leading-snug text-ink-2">{m.label}</dt>
                <dd className="t-stat text-[1.25rem] leading-none">
                  {/* The degree sign stays with its number in Arabic too. */}
                  <span dir="ltr">
                    {m.value}
                    {m.unit === "°" && <span className="text-[0.85rem] font-bold text-ink-2">°</span>}
                  </span>
                  {m.unit && m.unit !== "°" && <span className="ms-1 text-[0.85rem] font-bold text-ink-2">{m.unit}</span>}
                </dd>
              </div>
            ))}
          </dl>
        )}
        <ul className="mt-4 flex flex-wrap gap-1.5">
          {s.highlights.slice(1, 4).map((h) => (
            <li key={h} className="tag">
              {h}
            </li>
          ))}
        </ul>
        <ServiceLink label={view.services.open} className={sig ? "mt-auto pt-5" : "pt-5"} />
      </div>
    </article>
  );
}

/** Standard card: photo, icon, name, tagline, one capability tag, link. */
function ServiceCard({ service: s, open }: { service: ServiceItem; open: string }) {
  // Metal Fabrication shows its supporting photo: its cover (the workshop) already leads the About panel.
  const image = s.slug === "fabrication" ? s.support : s.image;
  return (
    <article className="card card-link card-edge a2-svc" data-tone={serviceTone[s.slug]}>
      <div className="a2-stage card-media aspect-[16/11]">{image && <Photo image={image} sizes="(min-width: 1024px) 300px, (min-width: 640px) 46vw, 48vw" />}</div>
      <div className="flex flex-1 flex-col p-3.5 pt-0 sm:p-5 sm:pt-0">
        <span className="icon-chip relative z-[2] -mt-5 size-10 shadow-[var(--sh-card)] [background:linear-gradient(var(--tone-soft),var(--tone-soft)),var(--surface)] sm:-mt-6 sm:size-12">
          <Icon name={serviceIcon[s.slug]} size={22} />
        </span>
        <h3 className="t-h3 mt-3 max-sm:text-[1.02rem]">
          <a href={s.href} className="stretch outline-none">
            {s.name}
          </a>
        </h3>
        <p className="t-small mt-1.5 max-sm:hidden">{s.tagline}</p>
        <p className="mt-3">
          <span className="tag tag-tone max-sm:text-[0.75rem]">{s.highlights[serviceTag[s.slug]]}</span>
        </p>
        <ServiceLink label={open} className="mt-auto pt-4 max-sm:text-[0.84rem]" />
      </div>
    </article>
  );
}

/** The six services: the two laser services lead with their signatures; the other four follow as photo cards. */
export function Services({ view }: { view: HomeView }) {
  const { services, links } = view;
  const [cutting, engraving] = (["laser-cutting", "laser-engraving"] as const).map((slug) => services.items.find((s) => s.slug === slug)!);
  const rest = services.items.filter((s) => s !== cutting && s !== engraving);
  return (
    <section id="services" className="sec sec-sheet sec-muted" aria-labelledby="services-title">
      <div className="shell">
        <SectionHead id="services-title" label={services.label} title={services.title} intro={services.intro} action={{ href: links.services, label: services.all }} />
        <ul className="mt-10 grid grid-cols-2 gap-3 sm:gap-5 lg:mt-12 lg:grid-cols-12">
          <li className="col-span-2 lg:col-span-7" data-reveal>
            <ServiceFeature service={cutting} view={view} />
          </li>
          <li className="col-span-2 lg:col-span-5" data-reveal style={delay(80)}>
            <ServiceFeature service={engraving} view={view} />
          </li>
          {rest.map((s, i) => (
            <li key={s.slug} className="col-span-1 lg:col-span-3" data-reveal style={delay(i * 70)}>
              <ServiceCard service={s} open={services.open} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
