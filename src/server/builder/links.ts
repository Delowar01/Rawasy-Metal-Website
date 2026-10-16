/**
 * Link targets of the page builder (A5 brief §49–§50; A1-CONTENT-MODEL §12): a button or a rich-text link names what it
 * points at, never a raw internal URL. A managed record is referred to by its type and id (resolved to its address when
 * rendered, dropped when it no longer exists); a page of the site by its system key; a part of the same page by its
 * anchor. External addresses are `https:` only; `mailto:` and `tel:` only where the field allows contact links.
 * `javascript:`, `data:` and every other scheme cannot be expressed at all: there is no free URL kind.
 *
 * Pure (no I/O): the registry, the Server Actions, the preview and the unit tests share it.
 */
import { z } from "zod";
import { httpsUrlProblem, normalizedHttpsUrl, textProblem } from "../cms/text.ts";

/** An in-page anchor: ASCII, lowercase, starting with a letter (the database checks the same). */
export const ANCHOR_RE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
export const ANCHOR_MAX = 64;

/** A ULID as the database stores it (Crockford base 32, upper case). */
export const ULID_RE = /^[0-9A-HJKMNP-TV-Z]{26}$/;

/** Pages of the site a link may name by key (the routes of `SYSTEM_PAGES` that have an address). */
export const SYSTEM_LINK_KEYS = ["home", "about", "services", "capabilities", "projects", "industries", "clients", "certificates", "contact", "privacy", "terms"] as const;
export type SystemLinkKey = (typeof SYSTEM_LINK_KEYS)[number];

export const SYSTEM_LINK_LABELS: Record<SystemLinkKey, string> = {
  home: "Homepage",
  about: "About",
  services: "Services overview",
  capabilities: "Capabilities & Machinery",
  projects: "Projects overview",
  industries: "Industries",
  clients: "Clients",
  certificates: "Certificates",
  contact: "Contact",
  privacy: "Privacy policy",
  terms: "Terms of use",
};

/** The kinds of target, in the order the editor offers them. */
export const LINK_KINDS = ["system", "page", "service", "project", "machine", "anchor", "external", "email", "phone"] as const;
export type LinkKind = (typeof LINK_KINDS)[number];

export const LINK_KIND_LABELS: Record<LinkKind, string> = {
  system: "A page of the site",
  page: "A generic page",
  service: "A service",
  project: "A project",
  machine: "A machine (Capabilities)",
  anchor: "A section of this page",
  external: "An external website (https)",
  email: "An email address",
  phone: "A phone number",
};

/** Contact kinds: allowed only where a field says so (A5 brief §14: "where the block permits contact links"). */
export const CONTACT_KINDS: readonly LinkKind[] = ["email", "phone"];
/** What a link field takes unless it says otherwise: everything but contact links. */
export const DEFAULT_LINK_KINDS: readonly LinkKind[] = ["system", "page", "service", "project", "machine", "anchor", "external"];

export type LinkTarget =
  | { type: "system"; key: SystemLinkKey; anchor?: string }
  | { type: "page"; id: string; anchor?: string }
  | { type: "service"; id: string; anchor?: string }
  | { type: "project"; id: string }
  | { type: "machine"; id: string }
  | { type: "anchor"; anchor: string }
  | { type: "external"; url: string }
  | { type: "email"; address: string }
  | { type: "phone"; number: string };

const anchor = z.string().max(ANCHOR_MAX).regex(ANCHOR_RE, "Use lowercase letters, digits and single hyphens, starting with a letter.");
const ulid = z.string().regex(ULID_RE, "Choose an item from the list.");

/** An email address as a mailto target: plain, one address, no parameters (no `?subject=…` injection). */
export const EMAIL_RE = /^[A-Za-z0-9.!#$%&'*+/=^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;
/** A phone number as a tel target: an optional +, then 6 to 15 digits (spaces and hyphens allowed between them). */
export const PHONE_RE = /^\+?[0-9](?:[ -]?[0-9]){5,14}$/;

export const linkTargetSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("system"), key: z.enum(SYSTEM_LINK_KEYS), anchor: anchor.optional() }).strict(),
  z.object({ type: z.literal("page"), id: ulid, anchor: anchor.optional() }).strict(),
  z.object({ type: z.literal("service"), id: ulid, anchor: anchor.optional() }).strict(),
  z.object({ type: z.literal("project"), id: ulid }).strict(),
  z.object({ type: z.literal("machine"), id: ulid }).strict(),
  z.object({ type: z.literal("anchor"), anchor }).strict(),
  z
    .object({
      type: z.literal("external"),
      url: z
        .string()
        .max(500)
        .superRefine((value, ctx) => {
          const problem = httpsUrlProblem(value) ?? (textProblem(value, { multiline: false }) ? "Enter a plain web address." : null);
          if (problem) ctx.addIssue({ code: "custom", message: problem });
        })
        .transform((value) => normalizedHttpsUrl(value)),
    })
    .strict(),
  z.object({ type: z.literal("email"), address: z.string().max(254).regex(EMAIL_RE, "Enter one email address (name@example.com).") }).strict(),
  z.object({ type: z.literal("phone"), number: z.string().max(24).regex(PHONE_RE, "Enter a phone number: digits, an optional + and spaces.") }).strict(),
]);

/** A link field's schema: one of `kinds`, or null when the field is optional. */
export function linkField(kinds: readonly LinkKind[], options: { required?: boolean } = {}) {
  const schema = linkTargetSchema.superRefine((target, ctx) => {
    if (!kinds.includes(target.type)) ctx.addIssue({ code: "custom", message: "This kind of link is not allowed here." });
  });
  return options.required ? schema : schema.nullable();
}

/** Every record a target names (for reference checks): its type and id. */
export function targetRecord(target: LinkTarget): { type: "page" | "service" | "project" | "machine"; id: string } | null {
  switch (target.type) {
    case "page":
    case "service":
    case "project":
    case "machine":
      return { type: target.type, id: target.id };
    default:
      return null;
  }
}

/** The anchor a target lands on in this page (same-page links), for the anchor-in-use warnings. */
export const sameAnchor = (target: LinkTarget): string | null => (target.type === "anchor" ? target.anchor : null);

/** The address of a contact target (never built from anything but the validated value). */
export function contactHref(target: LinkTarget): string | null {
  if (target.type === "email") return `mailto:${target.address}`;
  if (target.type === "phone") return `tel:${target.number.replace(/[ -]/g, "")}`;
  return null;
}

/** A short description of a target for the outline and the audit (never the whole address of an email or phone). */
export function describeTarget(target: LinkTarget): string {
  switch (target.type) {
    case "system":
      return `${SYSTEM_LINK_LABELS[target.key]}${target.anchor ? ` #${target.anchor}` : ""}`;
    case "page":
    case "service":
      return `${target.type} ${target.id}${target.anchor ? ` #${target.anchor}` : ""}`;
    case "project":
    case "machine":
      return `${target.type} ${target.id}`;
    case "anchor":
      return `#${target.anchor}`;
    case "external":
      return new URL(target.url).host;
    case "email":
      return "email address";
    case "phone":
      return "phone number";
  }
}
