import { company } from "@/content/company";
import type { CompanyInfo } from "@/content/types";
import type { Locale } from "@/i18n/config";
import { directionsUrl, mapEmbedUrl, mapSearchUrl } from "@/lib/maps";
import { SectionHead } from "../home/SectionHead";
import { Icon } from "../Icon";
import { ContactRow, breakableEmail } from "./ContactRows";
import { FramePointer } from "./FramePointer";

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
  callLabel: string;
  send: string;
  emailLabel: string;
  external: string;
}

/** What the card and the map show: the address, the registered names, the first phone, the email and the map's links. */
export interface LocationPlace {
  lines: string[];
  full: string;
  legalName: CompanyInfo["legalName"];
  phone: { display: string; e164: string };
  email: string;
  map: { embed: string; directions: string; search: string };
}

/** Today's: the company's facts (company.ts) and the address search (maps.ts). */
function todaysPlace(locale: Locale): LocationPlace {
  return {
    lines: company.address[locale].lines,
    full: company.address[locale].full,
    legalName: company.legalName,
    phone: company.phones[0],
    email: company.email,
    map: { embed: mapEmbedUrl(locale), directions: directionsUrl, search: mapSearchUrl },
  };
}

/**
 * Where RAWASY is: the verified address, the registered name and direct contact beside a Google map of the address.
 * The map itself is unchanged from the previous design (decision D10): the keyless, lazy embed of an address search
 * (src/lib/maps.ts), its title and referrer policy, and the "Get directions" and "Open in Google Maps" links. Only its
 * frame is Modern Commerce: a rounded, bordered plate whose surface carries the address until the map loads (or if it
 * is blocked). Stacked on phones, details first, so directions are one tap away. The website passes no `place`: it
 * shows today's facts; the admin preview passes the company settings' working copy (A6).
 */
export function Location({ locale, text, place = todaysPlace(locale) }: { locale: Locale; text: LocationText; place?: LocationPlace }) {
  const other: Locale = locale === "ar" ? "en" : "ar";
  return (
    <section id="location" aria-labelledby="location-title" className="sec cp-location">
      <div className="shell">
        <SectionHead id="location-title" label={text.label} title={text.title} intro={text.intro} tone="steel" read />

        <div className="mt-10 grid gap-6 lg:mt-12 lg:grid-cols-12 lg:gap-8">
          <div className="card cp-loc lg:col-span-5" data-tone="steel" data-reveal>
            <div className="flex items-start gap-4">
              <span className="icon-chip icon-chip-lg shrink-0">
                <Icon name="pin" size={24} />
              </span>
              <div className="min-w-0">
                <p className="cp-label">{text.address}</p>
                <address className="cp-loc-address">
                  {place.lines.map((line) => (
                    <span key={line} className="block">
                      {line}
                    </span>
                  ))}
                </address>
              </div>
            </div>

            <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-4">
              <a href={place.map.directions} target="_blank" rel="noopener noreferrer" className="btn btn-steel">
                {text.directions}
                <span className="sr-only"> ({text.external})</span>
                <Icon name="arrow-up-right" size={17} />
              </a>
              <a href={place.map.search} target="_blank" rel="noopener noreferrer" className="link-arrow">
                <span>{text.openMap}</span>
                <span className="sr-only"> ({text.external})</span>
                <Icon name="arrow-up-right" size={15} />
              </a>
            </div>

            <div className="cp-loc-name">
              <p className="cp-label">{text.name}</p>
              <p className="cp-loc-legal">{place.legalName[locale]}</p>
              <p lang={other} dir={other === "ar" ? "rtl" : "ltr"} className={`cp-loc-legal-other ${locale === "ar" ? "text-right" : "text-left"}`}>
                {place.legalName[other]}
              </p>
            </div>

            <div className="mt-6">
              <p className="cp-label pb-2.5">{text.contact}</p>
              <div className="grid gap-2">
                <ContactRow
                  compact
                  row={{ icon: "phone", tone: "steel", label: text.callLabel, value: place.phone.display, href: `tel:${place.phone.e164}`, action: text.call, ltr: true }}
                  externalLabel={text.external}
                />
                <ContactRow
                  compact
                  row={{ icon: "mail", tone: "steel", label: text.emailLabel, value: breakableEmail(place.email), href: `mailto:${place.email}`, action: text.send, ltr: true }}
                  externalLabel={text.external}
                />
              </div>
            </div>
          </div>

          <figure className="cp-map lg:col-span-7" data-reveal>
            <div className="cp-map-frame">
              <div aria-hidden className="cp-map-surface">
                <span className="icon-chip icon-chip-lg" data-tone="brand">
                  <Icon name="pin" size={24} />
                </span>
                <span className="cp-map-surface-text">{place.full}</span>
              </div>
              <iframe
                src={place.map.embed}
                title={text.mapTitle}
                loading="lazy"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
                className="cp-map-iframe"
              />
            </div>
            <figcaption className="cp-map-caption a2-read">
              <Icon name="pin" size={14} />
              {text.mapCaption}
            </figcaption>
          </figure>
        </div>
      </div>
      <FramePointer />
    </section>
  );
}
