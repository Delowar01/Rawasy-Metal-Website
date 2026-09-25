import { company } from "@/content/company";
import type { Locale } from "@/i18n/config";

/**
 * Google Maps links for the contact page, built from the verified address text
 * (company profile p.16). Google places the pin from that address: no
 * coordinates are invented and no API key is used. When RAWASY confirms its
 * own Google Maps place link, it replaces these address searches.
 */
const query = encodeURIComponent(company.address.en.full);

/** Keyless embed of an address search; `hl` sets the map's label language. */
export function mapEmbedUrl(locale: Locale) {
  return `https://www.google.com/maps?q=${query}&hl=${locale}&z=15&output=embed`;
}

/** Opens Google Maps directions to the address (Maps URLs, no key). */
export const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${query}`;

/** Opens the address in Google Maps. */
export const mapSearchUrl = `https://www.google.com/maps/search/?api=1&query=${query}`;
