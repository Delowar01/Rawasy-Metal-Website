import type { CSSProperties } from "react";
import { ContactRow } from "@/components/contact/ContactCards";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { ArrowUpRightIcon, PinIcon } from "@/components/ui/Icons";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Backdrop } from "@/components/visual/Backdrop";
import { FrameMarks } from "@/components/visual/TechnicalFrame";
import { company } from "@/content/company";
import type { Locale } from "@/i18n/config";
import { directionsUrl, mapEmbedUrl, mapSearchUrl } from "@/lib/maps";

export interface LocationText {
  label: string;
  title: string;
  intro: string;
  address: string;
  name: string;
  contact: string;
  mapTitle: string;
  mapCaption: string;
  directions: string;
  openMap: string;
  call: string;
  send: string;
  external: string;
}

/**
 * Where RAWASY is: the verified address, registered name and direct contact
 * beside a Google map of the address. The map is a keyless, lazy-loaded embed
 * of an address search; "Get directions" opens Google Maps in a new tab.
 * Stacked on phones (details first, so directions are one tap away).
 */
export function LocationSection({ locale, text }: { locale: Locale; text: LocationText }) {
  const other: Locale = locale === "ar" ? "en" : "ar";
  return (
    <section
      id="location"
      aria-labelledby="location-title"
      className="sec-eng section-y relative isolate overflow-hidden"
    >
      <Backdrop kind="fine" className="[--bd-fade:linear-gradient(to_bottom,transparent_35%,var(--eng-surface))]" />
      <div className="container-x">
        <SectionHeader id="location-title" index="02" size="compact" label={text.label} title={text.title} intro={text.intro} />

        <div className="mt-12 grid gap-8 lg:mt-16 lg:grid-cols-12 lg:gap-10">
          {/* Details */}
          <div className="card card-edge flex flex-col p-6 sm:p-8 lg:col-span-5" data-tone="eng" data-reveal>
            <div className="flex items-start gap-4">
              <span className="icon-chip icon-chip-lg">
                <PinIcon size={24} />
              </span>
              <div className="min-w-0">
                <p className="t-label tone-ink">{text.address}</p>
                <address className="t-h4 mt-2 not-italic text-ink">
                  {company.address[locale].lines.map((line) => (
                    <span key={line} className="block">
                      {line}
                    </span>
                  ))}
                </address>
              </div>
            </div>

            <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-4">
              <ButtonLink href={directionsUrl} external variant="steel" icon="external">
                {text.directions}
                <span className="sr-only"> ({text.external})</span>
              </ButtonLink>
              <a
                href={mapSearchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center gap-2 text-[0.95rem] font-medium text-ink"
              >
                <span className="link-line">{text.openMap}</span>
                <span className="sr-only"> ({text.external})</span>
                <ArrowUpRightIcon size={15} className="text-ink-2 transition-transform duration-500 ease-out-expo group-hover:-translate-y-0.5 group-hover:translate-x-[calc(var(--dir)*2px)] rtl:-scale-x-100" />
              </a>
            </div>

            <div className="mt-8 border-t border-line-strong pt-6">
              <p className="t-label text-ink-2">{text.name}</p>
              <p className="mt-2 font-display text-[1.02rem] font-semibold text-ink">{company.legalName[locale]}</p>
              <p lang={other} dir={other === "ar" ? "rtl" : "ltr"} className={`mt-1 text-[0.92rem] text-ink-2 ${locale === "ar" ? "text-right" : "text-left"}`}>
                {company.legalName[other]}
              </p>
            </div>

            <div className="mt-6">
              <p className="t-label pb-2 text-ink-2">{text.contact}</p>
              <ContactRow
                link={{ href: `tel:${company.phones[0].e164}`, value: company.phones[0].display, action: text.call, ltr: true }}
                externalLabel={text.external}
              />
              <ContactRow
                link={{ href: `mailto:${company.email}`, value: company.email, action: text.send, ltr: true }}
                externalLabel={text.external}
              />
            </div>
          </div>

          {/* Map */}
          <figure className="flex flex-col lg:col-span-7" data-reveal style={{ ["--d" as string]: 120 } as CSSProperties}>
            <div className="tf-host relative flex-1">
              <div className="map-well relative aspect-[4/3] h-full overflow-hidden sm:aspect-[16/10] lg:aspect-auto lg:min-h-[30rem]">
                <MapPlate />
                <iframe
                  src={mapEmbedUrl(locale)}
                  title={text.mapTitle}
                  loading="lazy"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                  className="absolute inset-0 size-full border-0"
                />
              </div>
              <FrameMarks lines={false} />
            </div>
            <figcaption className="t-label mt-3 flex items-center gap-2 text-ink-2">
              <PinIcon size={14} className="text-[var(--eng-ink)]" />
              {text.mapCaption}
            </figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}

/** Drawn under the map until it loads (or if it is blocked): a plan grid with a marker at the centre. */
function MapPlate() {
  return (
    <div aria-hidden className="map-plate absolute inset-0 grid place-items-center">
      <span className="map-plate-rings" />
      <span className="relative grid size-12 place-items-center bg-accent text-[#17191a] shadow-[var(--shadow-floating)]">
        <PinIcon size={22} />
      </span>
    </div>
  );
}
