import { company } from "@/content/company";
import type { Locale } from "@/i18n/config";

/**
 * Google Maps links for the contact page, built from the verified address text
 * (company profile p.16). Google places the pin from that address: no
 * coordinates are invented and no API key is used. When RAWASY confirms its
 * own Google Maps place link, it replaces these address searches.
 *
 * `mapLinksFor` builds the same three links for any address text: the admin
 * preview (A6) draws the map of the company settings' working copy with it.
 */
export function mapLinksFor(address: string) {
  const query = encodeURIComponent(address);
  return {
    /** Keyless embed of an address search; `hl` sets the map's label language. */
    embed: (locale: Locale) => `https://www.google.com/maps?q=${query}&hl=${locale}&z=15&output=embed`,
    /** Opens Google Maps directions to the address (Maps URLs, no key). */
    directions: `https://www.google.com/maps/dir/?api=1&destination=${query}`,
    /** Opens the address in Google Maps. */
    search: `https://www.google.com/maps/search/?api=1&query=${query}`,
  };
}

let today = mapLinksFor(company.address.en.full);

/** Keyless embed of an address search; `hl` sets the map's label language. */
export function mapEmbedUrl(locale: Locale) {
  return today.embed(locale);
}

/** Opens Google Maps directions to the address (Maps URLs, no key). */
export let directionsUrl = today.directions;

/** Opens the address in Google Maps. */
export let mapSearchUrl = today.search;

/** Builds the links again from the company's address as it is now (database mode, after new content is laid in: A9). */
export function refreshMapLinks() {
  today = mapLinksFor(company.address.en.full);
  directionsUrl = today.directions;
  mapSearchUrl = today.search;
}
