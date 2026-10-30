/**
 * What the site-controls screens (A6) and their client components share: the actions' answer and the form models.
 * Types and plain data only (client components may import nothing else from the server).
 */

export interface SiteIssueModel {
  path: string;
  message: string;
}

export type SiteActionState =
  | { status: "idle" }
  | { status: "ok"; message: string; lockVersion: number; id: string }
  | { status: "error"; message: string; issues: SiteIssueModel[]; stale?: true; stepUp?: true };

export type LocaleKey = "en" | "ar";

export interface SettingsTextsModel {
  siteName: string;
  legalName: string;
  brandName: string;
  statement: string;
  addressLines: string[];
  addressFull: string;
  streetAddress: string;
  city: string;
  country: string;
  visionStatement: string;
  visionAims: string[];
  visionClosing: string;
  defaultSeoDescription: string;
}

export interface PhoneFormModel {
  id: string;
  display: string;
  e164: string;
  hasWhatsapp: boolean;
  isVisible: boolean;
}

export interface SettingsFormModel {
  lockVersion: number;
  websiteUrl: string;
  email: string;
  postalCode: string;
  geoLat: string;
  geoLng: string;
  geoIsApproximate: boolean;
  facebookUrl: string;
  mapsPlaceUrl: string;
  mapsQuery: string;
  countryCode: string;
  defaultOgImageMediaId: string;
  phones: PhoneFormModel[];
  texts: Record<LocaleKey, SettingsTextsModel>;
  /** "<Language> is complete", as stored (A3's box: the server plans the status from it and what changed). */
  complete: Record<LocaleKey, boolean>;
  /** The language is marked "Needs review" (the other one changed after it was confirmed). */
  needsReview: Record<LocaleKey, boolean>;
}

export interface MenuItemFormModel {
  id: string;
  linkType: "route" | "collection";
  route: string | null;
  label: Record<LocaleKey, string> | null;
  isVisible: boolean;
}

export interface MenuFormModel {
  key: string;
  name: string;
  description: string;
  lockVersion: number;
  minItems: number;
  maxItems: number;
  labelMax: number;
  pinned: { position: number; route: string } | null;
  alwaysShown: number[];
  fixed: boolean;
  items: MenuItemFormModel[];
}

export interface UiStringFormModel {
  key: string;
  description: string;
  maxLength: number;
  otherLanguage: boolean;
  value: Record<LocaleKey, string>;
  today: Record<LocaleKey, string>;
}

export interface UiGroupFormModel {
  key: string;
  name: string;
  description: string;
  strings: UiStringFormModel[];
}

export interface RedirectFormModel {
  id: string;
  lockVersion: number;
  sourcePath: string;
  targetType: "path" | "page" | "service" | "project";
  targetPath: string;
  targetId: string;
  statusCode: 307 | 308;
  note: string;
}

/** Shown on every A6 screen: nothing reaches visitors before publishing (A8) and the switch to the database (A9). */
export const SITE_WORKING_NOTE =
  "Working copy only: the public website keeps today's settings, menus and text until publishing exists (A8) and the website switches to the database (A9). The admin preview shows the working copy.";
