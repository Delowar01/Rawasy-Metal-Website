/**
 * Slugs (A1-CONTENT-MODEL §3.4; A3 brief §10–§11): one slug per item, shared by English and Arabic, ASCII lowercase
 * words joined by single hyphens, 1–80 characters. A slug is never silently rewritten: an invalid one is refused with a
 * suggestion the person can accept. Generic pages may not take a reserved address; machines, projects and certificates
 * may not repeat an id of the page their slug anchors on (src/i18n/reserved-slugs.ts, the one source of truth). A
 * certificate's slug is its public anchor, so the certificate digit guard applies to it too (A3 security review).
 */
import { reservedAnchor, reservedPageSlug, type AnchorNamespace } from "../../i18n/reserved-slugs.ts";
import { hasRegistrationNumber } from "./text.ts";

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const SLUG_MAX = 80;
/** For the browser's own hint (the server checks again). */
export const SLUG_HTML_PATTERN = "[a-z0-9]+(-[a-z0-9]+)*";

export type SlugCheck = { ok: true; slug: string } | { ok: false; message: string; suggestion: string | null };

/** A suggestion from any text: Latin letters and digits kept, everything else a single hyphen, at most 80 characters. */
export function suggestSlug(value: string): string | null {
  const slug = value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX)
    .replace(/-+$/g, "");
  return slug && SLUG_PATTERN.test(slug) ? slug : null;
}

/**
 * Checks a slug as typed (surrounding spaces ignored). `namespace` adds the rules of where the slug is used: "page" for
 * generic pages (`/{locale}/{slug}`), or an anchor namespace.
 */
export function checkSlug(raw: string, namespace: "page" | AnchorNamespace | null): SlugCheck {
  const value = raw.trim();
  if (!value) return { ok: false, message: "Enter a slug (the address part).", suggestion: null };
  if (value.length > SLUG_MAX || !SLUG_PATTERN.test(value)) {
    const suggestion = suggestSlug(value);
    return {
      ok: false,
      message: "Use lowercase English letters, digits and single hyphens only (for example laser-cutting).",
      suggestion: suggestion && suggestion !== value ? suggestion : null,
    };
  }
  if (namespace === "page") {
    const reason = reservedPageSlug(value);
    if (reason) return { ok: false, message: `“${value}” can't be used: ${reason}.`, suggestion: null };
  } else if (namespace && reservedAnchor(namespace, value)) {
    return { ok: false, message: `“${value}” can't be used: the page that shows this item already uses it for one of its own parts.`, suggestion: null };
  }
  if (namespace === "certificate" && hasRegistrationNumber(value)) {
    return { ok: false, message: "A certificate's slug is part of its public address, so it can't hold a registration or certificate number (seven or more digits).", suggestion: null };
  }
  return { ok: true, slug: value };
}
