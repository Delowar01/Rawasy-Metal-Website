/**
 * Site addresses for redirects (A6; A1 `redirects`), as pure functions: normalising a typed address into the stored
 * form, telling whether a page of the website answers it (a redirect's source never may), and whether a target address
 * is a page of the website (a redirect's target always must). "Answers" covers today's static release and the working
 * records that become live addresses at the A9 cutover (A3 page, service and project slugs), passed in by the caller.
 */
import { RESERVED_PAGE_SLUGS } from "../../i18n/reserved-slugs.ts";
import { LOCALES, SITE_ROUTES, type Locale } from "./registry.ts";

export type PathResult = { ok: true; path: string; locale: Locale } | { ok: false; message: string };

const UNRESERVED = /^[A-Za-z0-9._~-]$/;

/**
 * Characters a segment never holds once decoded: controls, formatting marks (zero-width, bidi …) and every other
 * default-ignorable character (variation selectors, the combining grapheme joiner, Hangul fillers …), which draw nothing
 * — the A5 certificate guard's set.
 */
const HIDDEN = /[\p{Cc}\p{Cf}\p{Default_Ignorable_Code_Point}]/u;

/**
 * One path segment in canonical form: decoded, NFC-normalised (two spellings of one text — "café" composed or with a
 * combining accent — are one address), then every character outside A–Z a–z 0–9 . _ ~ - written as %XX. Null when it
 * can't be read (an incomplete %-code, “.” or “..”); "hidden" when it holds a character that draws nothing. A9 resolves a
 * visitor's address through this same function, so the stored form and the request's meet.
 */
function canonicalSegment(segment: string): string | null | "hidden" {
  let decoded: string;
  try {
    decoded = decodeURIComponent(segment).normalize("NFC");
  } catch {
    return null;
  }
  if (!decoded || decoded === "." || decoded === "..") return null;
  if (HIDDEN.test(decoded)) return "hidden";
  let out = "";
  for (const char of decoded) {
    if (UNRESERVED.test(char)) out += char;
    else out += encodeChar(char);
  }
  return out;
}

const encodeChar = (char: string) => [...new TextEncoder().encode(char)].map((byte) => `%${byte.toString(16).toUpperCase().padStart(2, "0")}`).join("");

/**
 * A stored address as people read it: letters, marks and digits of any script shown as themselves (an Arabic address in
 * Arabic), everything else as stored (%XX: spaces, slashes and percent signs inside a part). Typing it back gives the same
 * stored form.
 */
export function readablePath(path: string): string {
  return path
    .split("/")
    .map((segment) => {
      let decoded: string;
      try {
        decoded = decodeURIComponent(segment);
      } catch {
        return segment;
      }
      let out = "";
      for (const char of decoded) out += UNRESERVED.test(char) || (/^[\p{L}\p{M}\p{N}]$/u.test(char) && !HIDDEN.test(char)) ? char : encodeChar(char);
      return out;
    })
    .join("/");
}

/**
 * A typed address in the stored form: `/en/old-page` (the language first, no domain, no trailing slash, no query or
 * fragment; percent-encoding normalised). `allowLocaleRoot`: a target may be a language's homepage (`/en`).
 */
export function normalizeSitePath(input: string, options: { allowLocaleRoot?: boolean } = {}): PathResult {
  const value = input.trim();
  if (!value) return { ok: false, message: "Enter an address, for example /en/old-page." };
  if (/^[a-z][a-z0-9+.-]*:/i.test(value) || value.startsWith("//")) return { ok: false, message: "Enter the address without the domain, for example /en/old-page." };
  if (!value.startsWith("/")) return { ok: false, message: "Start the address with a slash and the language, for example /en/old-page." };
  if (value.includes("?") || value.includes("#")) return { ok: false, message: "Leave out the query (?…) and the fragment (#…): a redirect matches the address alone." };
  if (/[\u0000-\u001f\u007f\s\\]/.test(value)) return { ok: false, message: "An address can't hold spaces, backslashes or control characters." };
  const trimmed = value.length > 1 ? value.replace(/\/+$/, "") : value;
  const raw = trimmed.split("/").slice(1);
  if (raw.some((s) => s === "")) return { ok: false, message: "An address can't hold empty parts (//)." };
  const [locale, ...rest] = raw;
  if (!(LOCALES as readonly string[]).includes(locale ?? "")) return { ok: false, message: "Start the address with the language: /en/… or /ar/…." };
  if (!rest.length && !options.allowLocaleRoot) return { ok: false, message: "Add the old page's address after the language, for example /en/old-page." };
  const segments: string[] = [];
  for (const segment of rest) {
    const canonical = canonicalSegment(segment);
    if (canonical === null) return { ok: false, message: "Part of this address can't be read (an incomplete %-code, or “.” / “..”)." };
    if (canonical === "hidden") return { ok: false, message: "An address can't hold control characters or invisible marks (characters that draw nothing), even as %-codes." };
    segments.push(canonical);
  }
  const path = `/${locale}${segments.map((s) => `/${s}`).join("")}`;
  if (path.length > 512) return { ok: false, message: "The address is too long (at most 512 characters once encoded)." };
  return { ok: true, path, locale: locale as Locale };
}

/** Slugs of the working records that become live addresses at the cutover (A3), and today's static ones. */
export interface LiveSlugs {
  services: ReadonlySet<string>;
  projects: ReadonlySet<string>;
  /** Generic pages (`/{locale}/{slug}`). */
  pages: ReadonlySet<string>;
}

const segmentsOf = (path: string) => path.split("/").slice(2);

/** Why a page of the website answers `path` (a normalised source), or null when none does. */
export function answeredBy(path: string, slugs: LiveSlugs): string | null {
  const segments = segmentsOf(path);
  if (segments.length === 1) {
    const [first] = segments;
    if (RESERVED_PAGE_SLUGS.has(first)) return "This address belongs to the website's own pages or files.";
    if (slugs.pages.has(first)) return "A page uses this address.";
  }
  if (segments.length === 2 && segments[0] === "services" && slugs.services.has(segments[1])) return "A service uses this address.";
  if (segments.length === 2 && segments[0] === "projects" && slugs.projects.has(segments[1])) return "A project uses this address.";
  return null;
}

const STATIC_FIRST_SEGMENTS: ReadonlySet<string> = new Set(
  Object.values(SITE_ROUTES)
    .filter((p) => p !== "/")
    .map((p) => p.slice(1)),
);

/**
 * Whether `path` (a normalised target) is a page of today's website: a language's homepage, a site page, a service's or
 * a project's page. Only these may be a redirect's address target (the record targets are chosen as records).
 */
export function isLiveAddress(path: string, live: { services: ReadonlySet<string>; projects: ReadonlySet<string> }): boolean {
  const segments = segmentsOf(path);
  if (segments.length === 0) return true;
  if (segments.length === 1) return STATIC_FIRST_SEGMENTS.has(segments[0]);
  if (segments.length === 2 && segments[0] === "services") return live.services.has(segments[1]);
  if (segments.length === 2 && segments[0] === "projects") return live.projects.has(segments[1]);
  return false;
}
