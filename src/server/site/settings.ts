/**
 * Company & website settings (A6.1; A1 `site_settings`, `site_setting_translations`, `company_phones`): the working copy
 * of the company's identity, contact details, address, social link, map and global SEO defaults, both languages.
 *
 * - Read: every signed-in role (`content.view`); change: `settings.edit` (Owner, Admin), re-decided in the transaction.
 * - Set-up copies today's website (`static-source.ts`) into the empty row the seed created — once, audited. Nothing is
 *   invented: fields today's site does not have (RAWASY's own map link, a site-wide SEO description, a default share
 *   image) start empty.
 * - A save is the full state of the form, decided on the settings' version as the form showed it ("changed after you
 *   opened them…"). Both languages are required (the shell shows every field in both); each language's status is A3's
 *   plan (`planTranslationStatus`) from what changed and the form's "<language> is complete" and "does not affect the
 *   other language" boxes — never a status sent by the browser — and its completion is stamped only when it is
 *   confirmed. Phones keep their ids; the WhatsApp number is the first visible phone that has WhatsApp (today's rule,
 *   `primaryWhatsApp`).
 * - Validation: A3's plain text; https addresses (A3) — the website, Facebook on facebook.com, the map link on Google
 *   Maps; E.164 phone numbers; one email address; a newly chosen default share image an approved public image that A4
 *   delivers (its `public_media` row: no blocking flag), D-A6-7. Addresses are decided on the parsed URL (host, scheme,
 *   no credentials) and stored as typed (trimmed): the browser parses the same text the same way.
 * The public website never reads this (T1 = Option B); the admin preview does.
 */
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "../db/client.ts";
import { companyPhones, siteSettingTranslations, siteSettings } from "../db/schema-site.ts";
import { EMAIL_RE, ULID_RE } from "../builder/links.ts";
import { planTranslationStatus } from "../cms/completeness.ts";
import { mediaTargetStates } from "../cms/media-refs.ts";
import { contentTransaction, instantOf, rowsOf } from "../cms/store.ts";
import { httpsUrlProblem, plainText, storedLines } from "../cms/text.ts";
import { ulid } from "../security/ids.ts";
import {
  bumpSiteRoot,
  FREE_RANGE,
  INVALID,
  lockSettingsRoot,
  refuse,
  siteAudit,
  stale,
  STALE_SETTINGS,
  versionSchema,
  zodIssues,
  type SiteChange,
  type SiteIssue,
  type SiteResult,
} from "./common.ts";
import { LOCALES, SETTINGS_LIMITS, type Locale } from "./registry.ts";
import { staticSettings, type SettingsTexts, type SettingsValues } from "./static-source.ts";

export type TranslationStatus = "draft" | "complete" | "needs_review";

export interface PhoneModel {
  id: string;
  display: string;
  e164: string;
  hasWhatsapp: boolean;
  isVisible: boolean;
}

export interface SettingsModel {
  setUp: boolean;
  lockVersion: number;
  values: Omit<SettingsValues, "phones"> & { phones: PhoneModel[]; defaultOgImageMediaId: string };
  status: Record<Locale, TranslationStatus | null>;
  primaryWhatsappPhoneId: string | null;
  updatedAt: Date | null;
}

const EMPTY_TEXTS: SettingsTexts = {
  siteName: "",
  legalName: "",
  brandName: "",
  statement: "",
  addressLines: [],
  addressFull: "",
  streetAddress: "",
  city: "",
  country: "",
  visionStatement: "",
  visionAims: [],
  visionClosing: "",
  defaultSeoDescription: "",
};

const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));

/** The working copy as stored (set up or not). */
export async function readSettings(db: Db): Promise<SettingsModel> {
  const [root] = await rowsOf<Record<string, unknown>>(db, sql`SELECT * FROM site_settings WHERE id = 'site'`);
  if (!root) throw new Error("The site settings row is missing (migration 0007).");
  const translations = await rowsOf<Record<string, unknown>>(db, sql`SELECT * FROM site_setting_translations WHERE settings_id = 'site'`);
  const phones = await rowsOf<Record<string, unknown>>(db, sql`SELECT * FROM company_phones WHERE settings_id = 'site' ORDER BY position`);
  const texts = { en: { ...EMPTY_TEXTS }, ar: { ...EMPTY_TEXTS } } as Record<Locale, SettingsTexts>;
  const status: Record<Locale, TranslationStatus | null> = { en: null, ar: null };
  for (const row of translations) {
    const locale = String(row.locale) as Locale;
    if (!(LOCALES as readonly string[]).includes(locale)) continue;
    status[locale] = String(row.translation_status) as TranslationStatus;
    texts[locale] = {
      siteName: str(row.site_name),
      legalName: str(row.legal_name),
      brandName: str(row.brand_name),
      statement: str(row.statement),
      addressLines: storedLines(typeof row.address_lines === "string" ? JSON.parse(row.address_lines) : row.address_lines),
      addressFull: str(row.address_full),
      streetAddress: str(row.street_address),
      city: str(row.city),
      country: str(row.country),
      visionStatement: str(row.vision_statement),
      visionAims: storedLines(typeof row.vision_aims === "string" ? JSON.parse(row.vision_aims) : row.vision_aims),
      visionClosing: str(row.vision_closing),
      defaultSeoDescription: str(row.default_seo_description),
    };
  }
  return {
    setUp: status.en !== null && status.ar !== null,
    lockVersion: Number(root.lock_version),
    primaryWhatsappPhoneId: root.primary_whatsapp_phone_id ? String(root.primary_whatsapp_phone_id) : null,
    updatedAt: instantOf(root.updated_at),
    status,
    values: {
      websiteUrl: str(root.website_url),
      email: str(root.email),
      postalCode: str(root.postal_code),
      geoLat: root.geo_lat === null || root.geo_lat === undefined ? "" : String(Number(root.geo_lat)),
      geoLng: root.geo_lng === null || root.geo_lng === undefined ? "" : String(Number(root.geo_lng)),
      geoIsApproximate: Boolean(Number(root.geo_is_approximate)),
      facebookUrl: str(root.facebook_url),
      mapsPlaceUrl: str(root.maps_place_url),
      mapsQuery: str(root.maps_query),
      defaultOgImageMediaId: str(root.default_og_image_media_id),
      phones: phones.map((p) => ({
        id: String(p.id),
        display: String(p.display),
        e164: String(p.e164),
        hasWhatsapp: Boolean(Number(p.has_whatsapp)),
        isVisible: Boolean(Number(p.is_visible)),
      })),
      texts,
    },
  };
}

// --- Validation ----------------------------------------------------------------------------------------------------------

const E164 = /^\+[1-9][0-9]{6,14}$/;
const FACEBOOK_HOSTS = new Set(["facebook.com", "www.facebook.com", "m.facebook.com", "web.facebook.com"]);
const MAPS_HOSTS = new Set(["www.google.com", "google.com", "maps.google.com", "maps.app.goo.gl", "goo.gl"]);
/** Hosts that serve more than maps: only their /maps addresses are Google Maps (maps.google.com and the share links' maps.app.goo.gl are maps only). */
const MAPS_UNDER_PATH = new Set(["www.google.com", "google.com", "goo.gl"]);
/** The map link's column (Google Maps place links run past 255 characters). */
export const MAPS_URL_MAX = 500;

/** An https address on one of `hosts`, or the problem (decided on the parsed URL: what a browser opens). */
export function allowListedUrlProblem(value: string, hosts: ReadonlySet<string>, what: string, max = 255): string | null {
  const problem = httpsUrlProblem(value, max);
  if (problem) return problem;
  if (!hosts.has(new URL(value).hostname.toLowerCase())) return `Enter a ${what} address (${[...hosts].join(", ")}).`;
  return null;
}

/** RAWASY's own Google Maps link: a maps host, and on hosts that serve more than maps a /maps address; or the problem. */
export function mapsUrlProblem(value: string): string | null {
  const problem = allowListedUrlProblem(value, MAPS_HOSTS, "Google Maps", MAPS_URL_MAX);
  if (problem) return problem;
  const url = new URL(value);
  if (MAPS_UNDER_PATH.has(url.hostname.toLowerCase()) && !/^\/maps(\/|$)/.test(url.pathname)) {
    return "Enter a Google Maps address (https://www.google.com/maps/…, or a share link https://maps.app.goo.gl/…).";
  }
  return null;
}

const required = (max: number, multiline = false) =>
  plainText(max, { multiline }).refine((v) => v.length > 0, { message: "Required in both languages." });

const linesArray = (min: number, max: number, length: number) =>
  z
    .array(plainText(length))
    .max(max, { message: `Use at most ${max} lines.` })
    .transform((lines) => lines.filter(Boolean))
    .refine((lines) => lines.length >= min, { message: min === 1 ? "Add at least one line." : `Add at least ${min} lines.` });

const textsSchema = z
  .object({
    siteName: required(80),
    legalName: required(200),
    brandName: required(80),
    statement: required(600),
    addressLines: linesArray(SETTINGS_LIMITS.addressLines.min, SETTINGS_LIMITS.addressLines.max, SETTINGS_LIMITS.addressLines.length),
    addressFull: required(300),
    streetAddress: required(200),
    city: required(80),
    country: required(80),
    visionStatement: required(600),
    visionAims: linesArray(0, SETTINGS_LIMITS.visionAims.max, SETTINGS_LIMITS.visionAims.length),
    visionClosing: required(300),
    defaultSeoDescription: plainText(320),
  })
  .strict();

const phoneSchema = z
  .object({
    id: z.union([z.literal(""), z.string().regex(ULID_RE)]),
    display: required(32),
    e164: z
      .string()
      .max(40)
      .transform((v) => v.replace(/[\s-]/g, ""))
      .refine((v) => E164.test(v), { message: "Enter the number in international form: +966 followed by the number." }),
    hasWhatsapp: z.boolean(),
    isVisible: z.boolean(),
  })
  .strict();

const decimalText = (min: number, max: number) =>
  z
    .string()
    .max(20)
    .transform((v) => v.trim())
    .refine((v) => v === "" || (/^-?\d{1,3}(\.\d{1,6})?$/.test(v) && Number(v) >= min && Number(v) <= max), { message: `A number from ${min} to ${max}, at most 6 decimals.` });

export const settingsInputSchema = z
  .object({
    expectedVersion: versionSchema,
    websiteUrl: z
      .string()
      .max(300)
      .transform((v) => v.trim())
      .superRefine((v, ctx) => {
        const problem = httpsUrlProblem(v);
        if (problem) ctx.addIssue({ code: "custom", message: problem });
      }),
    email: z
      .string()
      .max(254)
      .transform((v) => v.trim())
      .refine((v) => EMAIL_RE.test(v), { message: "Enter one email address (name@example.com)." }),
    postalCode: z
      .string()
      .max(16)
      .transform((v) => v.trim())
      .refine((v) => v === "" || /^[A-Za-z0-9 -]{1,16}$/.test(v), { message: "Letters, digits, spaces and hyphens only." }),
    geoLat: decimalText(-90, 90),
    geoLng: decimalText(-180, 180),
    geoIsApproximate: z.boolean(),
    facebookUrl: z
      .string()
      .max(300)
      .transform((v) => v.trim())
      .superRefine((v, ctx) => {
        const problem = v ? allowListedUrlProblem(v, FACEBOOK_HOSTS, "Facebook") : null;
        if (problem) ctx.addIssue({ code: "custom", message: problem });
      }),
    mapsPlaceUrl: z
      .string()
      .max(2000)
      .transform((v) => v.trim())
      .superRefine((v, ctx) => {
        const problem = v ? mapsUrlProblem(v) : null;
        if (problem) ctx.addIssue({ code: "custom", message: problem });
      }),
    mapsQuery: required(255),
    defaultOgImageMediaId: z.union([z.literal(""), z.string().regex(ULID_RE)]),
    phones: z.array(phoneSchema).max(SETTINGS_LIMITS.phones.max, { message: `At most ${SETTINGS_LIMITS.phones.max} phone numbers.` }),
    texts: z.object({ en: textsSchema, ar: textsSchema }).strict(),
    /** "<Language> is complete" (A3's box): an intent the status plan weighs, never the stored status itself. */
    complete: z.object({ en: z.boolean(), ar: z.boolean() }).strict(),
    /** "This change does not affect the other language" (A3's box). */
    otherUnaffected: z.boolean(),
  })
  .strict()
  .superRefine((input, ctx) => {
    if (input.phones.length < SETTINGS_LIMITS.phones.min) ctx.addIssue({ code: "custom", path: ["phones"], message: "Add at least one phone number." });
    if (!input.phones.some((p) => p.isVisible && p.hasWhatsapp)) ctx.addIssue({ code: "custom", path: ["phones"], message: "At least one shown number must have WhatsApp: the website's WhatsApp links use it." });
    const numbers = input.phones.map((p) => p.e164);
    if (new Set(numbers).size !== numbers.length) ctx.addIssue({ code: "custom", path: ["phones"], message: "Each number once." });
    const ids = input.phones.map((p) => p.id).filter(Boolean);
    if (new Set(ids).size !== ids.length) ctx.addIssue({ code: "custom", path: ["phones"], message: "The phone list couldn't be read. Reload the page." });
    if ((input.geoLat === "") !== (input.geoLng === "")) ctx.addIssue({ code: "custom", path: ["geoLat"], message: "Give both coordinates, or neither." });
  });

export type SettingsInput = z.input<typeof settingsInputSchema>;

/** The default share image must be an approved, public, ready image that is not in the Trash (A4; D-A6-7). */
async function shareImageProblem(tx: Db, id: string, keptFrom: string): Promise<string | null> {
  if (!id) return null;
  const isNew = id !== keptFrom;
  const state = (await mediaTargetStates(tx, [id], { lock: isNew })).get(id);
  if (!state || state.visibility !== "public") return "The chosen media item can't be used here. Reload the page and choose another.";
  if (state.kind !== "image") return "Choose an image here.";
  if (!isNew) return null;
  if (state.trashed) return "The chosen image is in the Trash. Choose another.";
  if (state.usageStatus !== "approved") return "Choose an approved image: approve it in the media library first.";
  if (!state.ready) return "The chosen image has no ready file yet. Choose another.";
  // A4's one deliverability rule decides the rest (no blocking flag, unknown flags block): its public_media row, read with
  // a share lock after the item's (the order of A4's own changes), so a flag added meanwhile is seen.
  const [deliverable] = await rowsOf<{ media_id: string }>(tx, sql`SELECT media_id FROM public_media WHERE media_id = ${id} LOCK IN SHARE MODE`);
  if (!deliverable) return "This image isn't delivered to the website now (a blocking flag or a restriction). Choose an approved image without one.";
  return null;
}

// --- Writes ---------------------------------------------------------------------------------------------------------------

/** One language's row: its status from the plan; its completion stamped only when confirmed now (kept otherwise, cleared for a draft). */
async function writeTranslation(tx: Db, locale: Locale, texts: SettingsTexts, status: TranslationStatus, completedNow: boolean, actorId: string, now: Date) {
  const completion = status === "draft" ? { completedAt: null, completedBy: null } : completedNow ? { completedAt: now, completedBy: actorId } : {};
  const values = {
    siteName: texts.siteName,
    legalName: texts.legalName,
    brandName: texts.brandName,
    statement: texts.statement,
    addressLines: texts.addressLines,
    addressFull: texts.addressFull,
    streetAddress: texts.streetAddress,
    city: texts.city,
    country: texts.country,
    visionStatement: texts.visionStatement,
    visionAims: texts.visionAims,
    visionClosing: texts.visionClosing,
    defaultSeoDescription: texts.defaultSeoDescription || null,
    translationStatus: status,
    ...completion,
    updatedAt: now,
    updatedBy: actorId,
  };
  await tx
    .insert(siteSettingTranslations)
    .values({ settingsId: "site", locale, ...values })
    .onDuplicateKeyUpdate({ set: values });
}

/** Copy today's website into the empty settings (once). */
export async function setUpSettings(change: SiteChange): Promise<SiteResult> {
  const { deps, actor } = change;
  return contentTransaction(deps, actor, async (tx, now): Promise<SiteResult> => {
    const root = await lockSettingsRoot(tx);
    if (!root) return { kind: "not_found" };
    const event = { action: "site_settings.setup", type: "site_settings" as const, id: "site", label: "Site settings" };
    if (!actor.permissions.has("settings.edit")) return refuse(tx, change, now, event, "Setting up the site settings needs a permission you don't hold.");
    const current = await readSettings(tx);
    if (current.setUp) return { kind: "ok", id: "site", lockVersion: root.lockVersion, summary: "The settings were already set up." };
    const source = staticSettings();
    const phoneIds = source.phones.map(() => ulid(now.getTime()));
    await tx.update(siteSettings).set({ primaryWhatsappPhoneId: null }).where(eq(siteSettings.id, "site"));
    await tx.delete(companyPhones).where(eq(companyPhones.settingsId, "site"));
    for (const [i, phone] of source.phones.entries()) {
      await tx.insert(companyPhones).values({ id: phoneIds[i], settingsId: "site", position: i + 1, ...phone });
    }
    const primary = source.phones.findIndex((p) => p.isVisible && p.hasWhatsapp);
    await tx
      .update(siteSettings)
      .set({
        websiteUrl: source.websiteUrl,
        email: source.email,
        postalCode: source.postalCode || null,
        geoLat: source.geoLat || null,
        geoLng: source.geoLng || null,
        geoIsApproximate: source.geoIsApproximate,
        facebookUrl: source.facebookUrl || null,
        mapsPlaceUrl: null,
        mapsQuery: source.mapsQuery,
        primaryWhatsappPhoneId: primary >= 0 ? phoneIds[primary] : null,
        defaultOgImageMediaId: null,
      })
      .where(eq(siteSettings.id, "site"));
    for (const locale of LOCALES) await writeTranslation(tx, locale, source.texts[locale], "complete", true, actor.user.id, now);
    await bumpSiteRoot(tx, "site_settings", "id", "site", actor.user.id, now);
    await siteAudit(tx, change, now, { ...event, summary: "Set up the site settings from today's website (company, contact, address, social link, map search; both languages).", changes: { phones: source.phones.length } });
    return { kind: "ok", id: "site", lockVersion: root.lockVersion + 1, summary: "The settings now hold today's website. Nothing changed for visitors." };
  });
}

const TEXT_KEYS = Object.keys(EMPTY_TEXTS) as (keyof SettingsTexts)[];
/** Whether a language's texts differ, field by field. */
const textsChanged = (a: SettingsTexts, b: SettingsTexts) => TEXT_KEYS.some((key) => JSON.stringify(a[key]) !== JSON.stringify(b[key]));

const COMPARED: (keyof SettingsModel["values"])[] = ["websiteUrl", "email", "postalCode", "geoLat", "geoLng", "geoIsApproximate", "facebookUrl", "mapsPlaceUrl", "mapsQuery", "defaultOgImageMediaId"];

/** Save the settings form (its full state), decided on the version it showed. */
export async function saveSettings(change: SiteChange, raw: unknown): Promise<SiteResult> {
  const parsed = settingsInputSchema.safeParse(raw);
  if (!parsed.success) return { kind: "invalid", message: INVALID, issues: zodIssues(parsed.error) };
  const input = parsed.data;
  const { deps, actor } = change;
  return contentTransaction(deps, actor, async (tx, now): Promise<SiteResult> => {
    const root = await lockSettingsRoot(tx);
    if (!root) return { kind: "not_found" };
    const event = { action: "site_settings.update", type: "site_settings" as const, id: "site", label: "Site settings" };
    if (!actor.permissions.has("settings.edit")) return refuse(tx, change, now, event, "Editing the site settings needs a permission you don't hold.");
    if (root.lockVersion !== input.expectedVersion) return stale(tx, change, now, event, input.expectedVersion, root.lockVersion, STALE_SETTINGS);
    const stored = await readSettings(tx);
    if (!stored.setUp) return { kind: "invalid", message: "Set up the settings from today's website first.", issues: [] };
    const issues: SiteIssue[] = [];
    const storedIds = new Set(stored.values.phones.map((p) => p.id));
    if (input.phones.some((p) => p.id && !storedIds.has(p.id))) issues.push({ path: "phones", message: "The phone list changed. Reload the page." });
    const media = await shareImageProblem(tx, input.defaultOgImageMediaId, stored.values.defaultOgImageMediaId);
    if (media) issues.push({ path: "defaultOgImageMediaId", message: media });
    if (issues.length) return { kind: "invalid", message: INVALID, issues };

    // Phones: keep ids, renumber through a free range, the WhatsApp number derived.
    const kept = new Set(input.phones.map((p) => p.id).filter(Boolean));
    await tx.update(siteSettings).set({ primaryWhatsappPhoneId: null }).where(eq(siteSettings.id, "site"));
    for (const phone of stored.values.phones) if (!kept.has(phone.id)) await tx.delete(companyPhones).where(eq(companyPhones.id, phone.id));
    await tx.execute(sql`UPDATE company_phones SET position = position + ${FREE_RANGE} WHERE settings_id = 'site'`);
    const ids: string[] = [];
    for (const [i, phone] of input.phones.entries()) {
      const values = { position: i + 1, display: phone.display, e164: phone.e164, hasWhatsapp: phone.hasWhatsapp, isVisible: phone.isVisible };
      if (phone.id) {
        await tx.update(companyPhones).set(values).where(eq(companyPhones.id, phone.id));
        ids.push(phone.id);
      } else {
        const id = ulid(now.getTime());
        await tx.insert(companyPhones).values({ id, settingsId: "site", ...values });
        ids.push(id);
      }
    }
    const primary = input.phones.findIndex((p) => p.isVisible && p.hasWhatsapp);
    await tx
      .update(siteSettings)
      .set({
        websiteUrl: input.websiteUrl,
        email: input.email,
        postalCode: input.postalCode || null,
        geoLat: input.geoLat || null,
        geoLng: input.geoLng || null,
        geoIsApproximate: input.geoIsApproximate,
        facebookUrl: input.facebookUrl || null,
        mapsPlaceUrl: input.mapsPlaceUrl || null,
        mapsQuery: input.mapsQuery,
        primaryWhatsappPhoneId: ids[primary] ?? null,
        defaultOgImageMediaId: input.defaultOgImageMediaId || null,
      })
      .where(eq(siteSettings.id, "site"));
    // Each language's status: A3's plan (both languages are required, so each exists and is filled once valid).
    const changed = { en: textsChanged(input.texts.en, stored.values.texts.en), ar: textsChanged(input.texts.ar, stored.values.texts.ar) };
    const plan = planTranslationStatus({
      previous: stored.status,
      changed,
      marked: input.complete,
      filled: { en: true, ar: true },
      exists: { en: true, ar: true },
      otherUnaffected: input.otherUnaffected,
    });
    const changedLocales: Locale[] = [];
    for (const locale of LOCALES) {
      const status = plan.status[locale] ?? "draft";
      if (changed[locale] || stored.status[locale] !== status) changedLocales.push(locale);
      await writeTranslation(tx, locale, input.texts[locale], status, plan.completedNow[locale], actor.user.id, now);
    }
    await bumpSiteRoot(tx, "site_settings", "id", "site", actor.user.id, now);
    const fields = COMPARED.filter((key) => String(stored.values[key]) !== String((input as Record<string, unknown>)[key] ?? ""));
    const phoneFacts = (p: { display: string; e164: string; hasWhatsapp: boolean; isVisible: boolean }) => [p.display, p.e164, p.hasWhatsapp, p.isVisible];
    const phonesChanged = JSON.stringify(stored.values.phones.map(phoneFacts)) !== JSON.stringify(input.phones.map(phoneFacts));
    await siteAudit(tx, change, now, {
      ...event,
      summary: `Edited the site settings${fields.length || phonesChanged || changedLocales.length ? ` (${[...fields, ...(phonesChanged ? ["phones"] : []), ...changedLocales.map((l) => (l === "en" ? "English" : "Arabic"))].join(", ")})` : " (no change)"}.`,
      changes: { fields, phones: phonesChanged, locales: changedLocales },
    });
    return { kind: "ok", id: "site", lockVersion: root.lockVersion + 1, summary: "Saved. The preview shows the change; visitors still see today's website." };
  });
}
