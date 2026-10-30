/**
 * The A6 tables of the A1 schema (A1-DATABASE-SCHEMA §7 "Navigation, site settings, theme, interface text and
 * redirects"): the working copies of the site's global controls — the company and website settings (singleton 'site',
 * with its translations, phone numbers and the interface text), the four menu slots of the design with their items, the
 * theme (singleton 'theme') with its design-token overrides, and the redirects. A3 left them to A6 (schema-cms.ts).
 *
 * The public website never reads these tables before the A9 cutover (T1 = Option B): the admin edits them and A5's
 * private preview shows them. A6 writes only working states (unpublished · draft); A8 publishes.
 *
 * Unchanged from A1 except, as in A3–A5, where noted (A6 report, item 3):
 * - `menu_items.link_type` adds 'route' with its `route_key`: a site page by its route key (`about`, `contact` …), the
 *   only target the approved design's menus hold today. A1's other kinds stay in the type for later phases.
 * - `redirects.lock_version`: a redirect is decided on the version its form showed, like an aggregate root.
 * - `redirects.target_path` is ASCII (same-site paths only in A6; A1: VARCHAR(512)).
 * - checks added for what the application validates too: the singleton ids, positions >= 1, a phone's E.164 form, an
 *   interface text's maximum length, a redirect's source address, status code and target columns.
 *
 * Source of truth for `drizzle-kit generate`; queries use Drizzle's core builder only.
 */
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  customType,
  decimal,
  foreignKey,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  primaryKey,
  smallint,
  text,
  uniqueIndex,
  varchar,
  type AnyMySqlColumn,
} from "drizzle-orm/mysql-core";
import { asciiColumn, instant, jsonColumn, localeColumn, ulidColumn } from "./columns.ts";
import { actorKeys, pages, projects, pub, rootConstraints, services, translationConstraints, tr, ts } from "./schema-cms.ts";
import { mediaAssets } from "./schema-media.ts";

/** A fixed-length ASCII key: CHAR(n) ASCII, case-sensitive (the singletons' ids, a country code). */
const asciiChar = customType<{ data: string; driverData: string; config: { length: number }; configRequired: true }>({
  dataType: (config) => `char(${config.length}) CHARACTER SET ascii COLLATE ascii_bin`,
});

export const SITE_SETTINGS_ID = "site";
export const THEME_ID = "theme";

/** A1's link kinds, plus 'route' (a site page by its route key). */
export const MENU_LINK_TYPES = ["route", "page", "service", "project", "collection", "external", "phone", "email", "whatsapp"] as const;
export const TOKEN_SCHEMES = ["all", "light", "dark"] as const;
export const REDIRECT_TARGET_TYPES = ["path", "page", "service", "project"] as const;
export const REDIRECT_REASONS = ["slug_change", "manual", "import"] as const;

/** A redirect's source: a localized address, ASCII path segments (unreserved characters or %XX), no trailing slash. */
export const SOURCE_PATH_PATTERN = "^/(en|ar)(/([A-Za-z0-9._~-]|%[0-9A-F]{2})+)+$";
/** A registry key of a design token ("color.accent", "radius.card"). */
export const TOKEN_KEY_PATTERN = "^[a-z][a-z0-9]*(\\.[a-z][a-z0-9_]*)+$";

const regexp = (column: Parameters<typeof sql>[1], pattern: string) => sql`${column} REGEXP ${sql.raw(`'${pattern.replaceAll("\\", "\\\\")}'`)}`;

// --- Company and website settings (one aggregate with the interface text) -----------------------------------------------

/** The settings row and its phones refer to each other: a typed reference keeps TypeScript's inference acyclic. */
const companyPhoneId = (): AnyMySqlColumn => companyPhones.id;

/** The company, contact and SEO defaults (singleton 'site'); its translations, phones and interface text belong to it. */
export const siteSettings = mysqlTable(
  "site_settings",
  {
    id: asciiChar("id", { length: 4 }).primaryKey(),
    websiteUrl: varchar("website_url", { length: 255 }).notNull(),
    email: varchar("email", { length: 254 }).notNull(),
    postalCode: varchar("postal_code", { length: 16 }),
    countryCode: asciiChar("country_code", { length: 2 }).notNull(),
    /** Approximate only (district level); never invented. */
    geoLat: decimal("geo_lat", { precision: 9, scale: 6 }),
    geoLng: decimal("geo_lng", { precision: 9, scale: 6 }),
    geoIsApproximate: boolean("geo_is_approximate").notNull().default(true),
    facebookUrl: varchar("facebook_url", { length: 255 }),
    /** RAWASY's own Google Maps place link: empty until RAWASY confirms it. */
    mapsPlaceUrl: varchar("maps_place_url", { length: 500 }),
    /** The address search the map uses today. */
    mapsQuery: varchar("maps_query", { length: 255 }).notNull(),
    primaryWhatsappPhoneId: ulidColumn("primary_whatsapp_phone_id"),
    defaultOgImageMediaId: ulidColumn("default_og_image_media_id"),
    ...pub(),
    ...ts(),
  },
  (t) => [
    ...rootConstraints("site_settings", t, { slug: false, softDelete: false }),
    foreignKey({ name: "fk_site_settings_og_image", columns: [t.defaultOgImageMediaId], foreignColumns: [mediaAssets.id] }).onDelete("restrict"),
    foreignKey({ name: "fk_site_settings_whatsapp", columns: [t.primaryWhatsappPhoneId], foreignColumns: [companyPhoneId()] }).onDelete("restrict"),
    check("ck_site_settings_id", sql`${t.id} = 'site'`),
  ],
);

/** Localized company facts and defaults. */
export const siteSettingTranslations = mysqlTable(
  "site_setting_translations",
  {
    settingsId: asciiChar("settings_id", { length: 4 }).notNull(),
    locale: localeColumn("locale").notNull(),
    siteName: varchar("site_name", { length: 80 }).notNull(),
    legalName: varchar("legal_name", { length: 200 }).notNull(),
    brandName: varchar("brand_name", { length: 80 }).notNull(),
    statement: text("statement").notNull(),
    /** Ordered list of at most 4 short lines (validated). */
    addressLines: jsonColumn("address_lines").notNull(),
    addressFull: varchar("address_full", { length: 300 }).notNull(),
    streetAddress: varchar("street_address", { length: 200 }).notNull(),
    city: varchar("city", { length: 80 }).notNull(),
    country: varchar("country", { length: 80 }).notNull(),
    visionStatement: text("vision_statement").notNull(),
    /** Ordered list of sentences (validated). */
    visionAims: jsonColumn("vision_aims").notNull(),
    visionClosing: varchar("vision_closing", { length: 300 }).notNull(),
    defaultSeoDescription: varchar("default_seo_description", { length: 320 }),
    ...tr(),
  },
  (t) => translationConstraints("site_setting_translations", t, "settingsId", siteSettings.id),
);

/** The company's phone numbers, in order, with WhatsApp availability. */
export const companyPhones = mysqlTable(
  "company_phones",
  {
    id: ulidColumn("id").primaryKey(),
    settingsId: asciiChar("settings_id", { length: 4 }).notNull(),
    position: int("position", { unsigned: true }).notNull(),
    display: varchar("display", { length: 32 }).notNull(),
    e164: asciiColumn("e164", { length: 16 }).notNull(),
    hasWhatsapp: boolean("has_whatsapp").notNull(),
    isVisible: boolean("is_visible").notNull().default(true),
  },
  (t) => [
    uniqueIndex("uq_company_phones_position").on(t.settingsId, t.position),
    foreignKey({ name: "fk_company_phones_settings", columns: [t.settingsId], foreignColumns: [siteSettings.id] }).onDelete("cascade"),
    check("ck_company_phones_position", sql`${t.position} >= 1`),
    check("ck_company_phones_e164", regexp(t.e164, "^\\+[1-9][0-9]{6,14}$")),
  ],
);

/** Interface text keys (defined in code; added and removed by migration only). */
export const uiStrings = mysqlTable(
  "ui_strings",
  {
    key: asciiColumn("key", { length: 100 }).primaryKey(),
    settingsId: asciiChar("settings_id", { length: 4 }).notNull(),
    groupKey: asciiColumn("group_key", { length: 32 }).notNull(),
    description: varchar("description", { length: 300 }),
    maxLength: smallint("max_length", { unsigned: true }).notNull(),
  },
  (t) => [
    index("ix_ui_strings_group").on(t.groupKey),
    foreignKey({ name: "fk_ui_strings_settings", columns: [t.settingsId], foreignColumns: [siteSettings.id] }).onDelete("cascade"),
    check("ck_ui_strings_max_length", sql`${t.maxLength} BETWEEN 1 AND 500`),
  ],
);

/** Interface text per language. */
export const uiStringTranslations = mysqlTable(
  "ui_string_translations",
  {
    stringKey: asciiColumn("string_key", { length: 100 }).notNull(),
    locale: localeColumn("locale").notNull(),
    value: varchar("value", { length: 500 }).notNull(),
    ...tr(),
  },
  (t) => translationConstraints("ui_string_translations", t, "stringKey", uiStrings.key),
);

// --- Menus -----------------------------------------------------------------------------------------------------------

/** The menu slots of the design (fixed: header_main, header_services, footer_company, footer_legal). */
export const menus = mysqlTable(
  "menus",
  {
    key: asciiColumn("key", { length: 32 }).primaryKey(),
    name: varchar("name", { length: 80 }).notNull(),
    ...pub(),
    ...ts(),
  },
  (t) => rootConstraints("menus", t, { slug: false, softDelete: false }),
);

/** A menu's entries (one level in A6: the approved design draws no nested items). */
export const menuItems = mysqlTable(
  "menu_items",
  {
    id: ulidColumn("id").primaryKey(),
    menuKey: asciiColumn("menu_key", { length: 32 }).notNull(),
    parentId: ulidColumn("parent_id"),
    position: int("position", { unsigned: true }).notNull(),
    linkType: mysqlEnum("link_type", MENU_LINK_TYPES).notNull(),
    routeKey: asciiColumn("route_key", { length: 32 }),
    pageId: ulidColumn("page_id"),
    serviceId: ulidColumn("service_id"),
    projectId: ulidColumn("project_id"),
    collection: asciiColumn("collection", { length: 32 }),
    anchor: asciiColumn("anchor", { length: 64 }),
    url: varchar("url", { length: 500 }),
    openInNewTab: boolean("open_in_new_tab").notNull().default(false),
    isVisible: boolean("is_visible").notNull().default(true),
    showDesktop: boolean("show_desktop").notNull().default(true),
    showMobile: boolean("show_mobile").notNull().default(true),
    ...ts(),
  },
  (t) => [
    uniqueIndex("uq_menu_items_position").on(t.menuKey, t.parentId, t.position),
    foreignKey({ name: "fk_menu_items_menu", columns: [t.menuKey], foreignColumns: [menus.key] }).onDelete("cascade"),
    foreignKey({ name: "fk_menu_items_parent", columns: [t.parentId], foreignColumns: [t.id] }).onDelete("cascade"),
    foreignKey({ name: "fk_menu_items_page", columns: [t.pageId], foreignColumns: [pages.id] }).onDelete("restrict"),
    foreignKey({ name: "fk_menu_items_service", columns: [t.serviceId], foreignColumns: [services.id] }).onDelete("restrict"),
    foreignKey({ name: "fk_menu_items_project", columns: [t.projectId], foreignColumns: [projects.id] }).onDelete("restrict"),
    ...actorKeys("menu_items", t, ["createdBy", "updatedBy"]),
    check("ck_menu_items_position", sql`${t.position} >= 1`),
    check("ck_menu_items_devices", sql`${t.showDesktop} OR ${t.showMobile}`),
    check(
      "ck_menu_items_target",
      sql`(${t.linkType} = 'route') = (${t.routeKey} IS NOT NULL)
        AND (${t.linkType} = 'page') = (${t.pageId} IS NOT NULL)
        AND (${t.linkType} = 'service') = (${t.serviceId} IS NOT NULL)
        AND (${t.linkType} = 'project') = (${t.projectId} IS NOT NULL)
        AND (${t.linkType} = 'collection') = (${t.collection} IS NOT NULL)
        AND (${t.linkType} IN ('external', 'phone', 'email', 'whatsapp')) = (${t.url} IS NOT NULL)`,
    ),
  ],
);

/** A menu item's label (and dropdown description) per language. */
export const menuItemTranslations = mysqlTable(
  "menu_item_translations",
  {
    itemId: ulidColumn("item_id").notNull(),
    locale: localeColumn("locale").notNull(),
    label: varchar("label", { length: 80 }).notNull(),
    description: varchar("description", { length: 200 }),
    ...tr(),
  },
  (t) => translationConstraints("menu_item_translations", t, "itemId", menuItems.id),
);

// --- Theme -------------------------------------------------------------------------------------------------------------

/** The theme's aggregate root (singleton 'theme'): its design-token overrides belong to it. */
export const themeSettings = mysqlTable(
  "theme_settings",
  {
    id: asciiChar("id", { length: 5 }).primaryKey(),
    ...pub(),
    ...ts(),
  },
  (t) => [...rootConstraints("theme_settings", t, { slug: false, softDelete: false }), check("ck_theme_settings_id", sql`${t.id} = 'theme'`)],
);

/** Controlled overrides of design tokens (registry keys only, validated values; empty = the approved design). */
export const designTokenOverrides = mysqlTable(
  "design_token_overrides",
  {
    themeId: asciiChar("theme_id", { length: 5 }).notNull(),
    tokenKey: asciiColumn("token_key", { length: 64 }).notNull(),
    scheme: mysqlEnum("scheme", TOKEN_SCHEMES).notNull(),
    value: varchar("value", { length: 100 }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.themeId, t.tokenKey, t.scheme] }),
    foreignKey({ name: "fk_design_token_overrides_theme", columns: [t.themeId], foreignColumns: [themeSettings.id] }).onDelete("cascade"),
    check("ck_design_token_overrides_key", regexp(t.tokenKey, TOKEN_KEY_PATTERN)),
  ],
);

// --- Redirects ---------------------------------------------------------------------------------------------------------

/** Old addresses that move (308 permanent, 307 temporary). Stored and validated in A6; resolved from the A9 cutover. */
export const redirects = mysqlTable(
  "redirects",
  {
    id: ulidColumn("id").primaryKey(),
    sourcePath: asciiColumn("source_path", { length: 512 }).notNull(),
    targetType: mysqlEnum("target_type", REDIRECT_TARGET_TYPES).notNull(),
    targetPath: asciiColumn("target_path", { length: 512 }),
    targetPageId: ulidColumn("target_page_id"),
    targetServiceId: ulidColumn("target_service_id"),
    targetProjectId: ulidColumn("target_project_id"),
    statusCode: smallint("status_code", { unsigned: true }).notNull(),
    isActive: boolean("is_active").notNull().default(true),
    reason: mysqlEnum("reason", REDIRECT_REASONS).notNull(),
    note: varchar("note", { length: 300 }),
    /** Updated at most once a day per row, from the cutover (A9). */
    lastHitAt: instant("last_hit_at"),
    lockVersion: int("lock_version", { unsigned: true }).notNull().default(0),
    ...ts(),
  },
  (t) => [
    uniqueIndex("uq_redirects_source").on(t.sourcePath),
    index("ix_redirects_active").on(t.isActive),
    foreignKey({ name: "fk_redirects_page", columns: [t.targetPageId], foreignColumns: [pages.id] }).onDelete("restrict"),
    foreignKey({ name: "fk_redirects_service", columns: [t.targetServiceId], foreignColumns: [services.id] }).onDelete("restrict"),
    foreignKey({ name: "fk_redirects_project", columns: [t.targetProjectId], foreignColumns: [projects.id] }).onDelete("restrict"),
    ...actorKeys("redirects", t, ["createdBy", "updatedBy"]),
    check("ck_redirects_status", sql`${t.statusCode} IN (307, 308)`),
    check("ck_redirects_source", regexp(t.sourcePath, SOURCE_PATH_PATTERN)),
    check(
      "ck_redirects_target",
      sql`(${t.targetType} = 'path') = (${t.targetPath} IS NOT NULL)
        AND (${t.targetType} = 'page') = (${t.targetPageId} IS NOT NULL)
        AND (${t.targetType} = 'service') = (${t.targetServiceId} IS NOT NULL)
        AND (${t.targetType} = 'project') = (${t.targetProjectId} IS NOT NULL)`,
    ),
  ],
);
