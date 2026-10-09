/**
 * Roles, permission keys and the permission matrix, as code (A1-SECURITY-RBAC §5.1–§5.4). The seed migration
 * `drizzle/0001_seed_access_control.sql` was generated from this file (`scripts/generate-access-seed.mjs`), and the
 * integration tests check that the database holds exactly these rows. A later change to the matrix is a new migration.
 *
 * Interpretations of A1 §5.3 (reported in the A2 report; the Owner may change them):
 * - Certificates: the matrix gives only edit (Owner, Admin) and publish (Owner; Admin ⚑ not allowed). The other
 *   certificate keys follow those two: submit and restore with edit (Owner, Admin); review, publish_reviewed, archive
 *   and delete with publish (Owner only).
 * - `media.view` is not a matrix row: every role may view the media library (reviewers review pages that use media).
 * - "Project flags — add" (all roles) has no key in §5.4; it is left to A3, which builds project editing.
 * - ⚑ defaults are applied as proposed: Admin may publish directly; Admin may view and manage enquiries; Admin may not
 *   publish certificates or handle private documents; Editors may not see enquiries.
 */

export type RoleKey = "owner" | "admin" | "editor" | "reviewer";

export interface RoleDefinition {
  key: RoleKey;
  name: string;
  description: string;
  rank: number;
}

export const ROLES: readonly RoleDefinition[] = [
  { key: "owner", name: "Owner", description: "Full control, including Admins, security settings, backups and purges.", rank: 100 },
  { key: "admin", name: "Admin", description: "Manages content, media and settings, and Editors and Reviewers.", rank: 80 },
  { key: "editor", name: "Editor", description: "Edits drafts and media and submits them for review.", rank: 40 },
  { key: "reviewer", name: "Reviewer", description: "Reviews submitted drafts and publishes reviewed work.", rank: 30 },
];

export const ROLE_KEYS = ROLES.map((role) => role.key);

/** Roles whose members must use two-factor authentication (A2 locked default: Owner and Admin). */
export const MFA_REQUIRED_ROLES: readonly RoleKey[] = ["owner", "admin"];

export interface PermissionDefinition {
  key: string;
  resource: string;
  action: string;
  description: string;
  /** Needs a password (and 2FA) confirmation within the last 10 minutes (A1-SECURITY-RBAC §3.7). */
  isSensitive: boolean;
}

const CONTENT_RESOURCES: Record<string, string> = {
  pages: "pages",
  services: "services",
  machines: "machinery",
  projects: "projects",
  project_categories: "project categories",
  industries: "industries",
  clients: "clients",
  certificates: "certificates",
  orderings: "orderings",
  reusable_sections: "reusable sections",
};

const CONTENT_ACTIONS: Record<string, string> = {
  edit: "Edit drafts of",
  submit: "Submit for review:",
  review: "Review (comment, request changes):",
  publish: "Publish directly:",
  publish_reviewed: "Publish after review (not one's own submission):",
  archive: "Unpublish and archive:",
  delete: "Move to the Trash:",
  restore: "Restore a revision into the draft:",
};

const SENSITIVE = new Set([
  "users.invite",
  "users.edit",
  "users.disable",
  "users.delete",
  "users.sessions_revoke",
  "roles.manage",
  "security.settings",
  "private_documents.view",
  "enquiries.export",
  "theme.publish",
  "legal.publish",
  "purge.any",
  "backups.run",
  "cache.refresh",
  "cache.clear_images",
]);

const permission = (key: string, description: string): PermissionDefinition => {
  const [resource, action] = key.split(".");
  return { key, resource, action, description, isSensitive: SENSITIVE.has(key) };
};

export const PERMISSIONS: readonly PermissionDefinition[] = [
  permission("content.view", "View drafts and history."),
  permission("preview.use", "Preview unpublished work."),
  permission("dashboard.view", "See the dashboard."),
  permission("users.view", "See the list of users."),
  permission("users.invite", "Invite users (lower rank only, except the Owner)."),
  permission("users.edit", "Change a user's name, roles and lock (lower rank only, except the Owner)."),
  permission("users.disable", "Disable and enable users (lower rank only, except the Owner)."),
  permission("users.delete", "Delete users."),
  permission("users.sessions_revoke", "Sign other users out of their sessions (lower rank only, except the Owner)."),
  permission("roles.view", "See roles and their permissions."),
  permission("roles.manage", "Change roles and their permissions."),
  permission("security.settings", "Change security settings (2FA enforcement, session policy)."),
  ...Object.entries(CONTENT_RESOURCES).flatMap(([resource, label]) =>
    Object.entries(CONTENT_ACTIONS).map(([action, verb]) => permission(`${resource}.${action}`, `${verb} ${label}.`)),
  ),
  permission("pages.create_generic", "Create generic pages."),
  permission("projects.clear_flags", "Clear project flags."),
  permission("legal.edit", "Edit the legal pages."),
  permission("legal.publish", "Publish the legal pages (with legal-review confirmation)."),
  permission("media.view", "See the media library."),
  permission("media.upload", "Upload media."),
  permission("media.edit", "Edit media metadata and organize media."),
  permission("media.flag", "Add a flag to media or restrict it."),
  permission("media.approve", "Approve media for public use and clear blocking flags."),
  permission("media.view_original", "Download original files."),
  permission("media.delete", "Move media to the Trash."),
  permission("private_documents.view", "View and download private documents."),
  permission("private_documents.upload", "Upload private documents."),
  permission("private_documents.delete", "Delete private documents."),
  permission("purge.any", "Permanently delete anything in the Trash."),
  permission("menus.edit", "Edit menus."),
  permission("menus.publish", "Publish menus."),
  permission("settings.edit", "Edit site settings and interface text."),
  permission("settings.publish", "Publish site settings and interface text."),
  permission("theme.edit", "Edit the theme (design tokens)."),
  permission("theme.publish", "Publish the theme."),
  permission("seo.advanced", "Change robots, canonical overrides and sitemap inclusion."),
  permission("redirects.view", "See redirects."),
  permission("redirects.manage", "Manage redirects."),
  permission("forms.edit", "Edit form copy and fields."),
  permission("forms.publish", "Publish forms."),
  permission("forms.delivery_mode", "Change a form's delivery mode."),
  permission("enquiries.view", "See enquiries."),
  permission("enquiries.manage", "Change enquiry status, add notes and assign."),
  permission("enquiries.export", "Export enquiries as CSV."),
  permission("enquiries.delete", "Delete enquiries."),
  permission("audit.view", "See the audit log."),
  permission("audit.export", "Export the audit log."),
  permission("backups.view", "See backup status."),
  permission("backups.run", "Run a backup now."),
  permission("cache.refresh", "Refresh the whole site's cache."),
  permission("cache.clear_images", "Clear the image cache."),
];

export type PermissionKey = string;

const forResources = (resources: string[], actions: string[]) =>
  resources.flatMap((resource) => actions.map((action) => `${resource}.${action}`));

const GENERAL_CONTENT = ["services", "machines", "projects", "project_categories", "industries", "clients", "orderings", "reusable_sections"];
const EDITABLE = ["pages", ...GENERAL_CONTENT];

const everyone = [
  "content.view",
  "preview.use",
  "dashboard.view",
  "media.view",
  "media.flag",
  "redirects.view",
];

const editor = [
  ...everyone,
  ...forResources(EDITABLE, ["edit", "submit", "restore"]),
  "pages.create_generic",
  "media.upload",
  "media.edit",
];

const reviewer = [...everyone, ...forResources(EDITABLE, ["review", "publish_reviewed"])];

const admin = [
  ...everyone,
  "users.view",
  "users.invite",
  "users.edit",
  "users.disable",
  "users.sessions_revoke",
  "roles.view",
  ...forResources(EDITABLE, ["edit", "submit", "review", "publish", "publish_reviewed", "archive", "delete", "restore"]),
  "pages.create_generic",
  "projects.clear_flags",
  "legal.edit",
  "certificates.edit",
  "certificates.submit",
  "certificates.restore",
  "media.upload",
  "media.edit",
  "media.approve",
  "media.view_original",
  "media.delete",
  "menus.edit",
  "menus.publish",
  "settings.edit",
  "settings.publish",
  "seo.advanced",
  "redirects.manage",
  "forms.edit",
  "forms.publish",
  "enquiries.view",
  "enquiries.manage",
  "audit.view",
  "cache.refresh",
];

/** Role → permission keys (the matrix of A1-SECURITY-RBAC §5.3). The Owner holds every key. */
export const ROLE_PERMISSIONS: Readonly<Record<RoleKey, readonly string[]>> = {
  owner: PERMISSIONS.map((p) => p.key),
  admin,
  editor,
  reviewer,
};

export const PERMISSION_KEYS: ReadonlySet<string> = new Set(PERMISSIONS.map((p) => p.key));
export const SENSITIVE_PERMISSIONS: ReadonlySet<string> = new Set(PERMISSIONS.filter((p) => p.isSensitive).map((p) => p.key));

export const roleRank = (key: string): number => ROLES.find((role) => role.key === key)?.rank ?? 0;

/** A user's rank: the highest rank among their roles (0 without any). */
export const rankOf = (roleKeys: readonly string[]): number => roleKeys.reduce((max, key) => Math.max(max, roleRank(key)), 0);

/** The union of the permissions of the given roles. */
export function permissionsOf(roleKeys: readonly string[]): Set<string> {
  const out = new Set<string>();
  for (const key of roleKeys) for (const p of ROLE_PERMISSIONS[key as RoleKey] ?? []) out.add(p);
  return out;
}

export const requiresMfa = (roleKeys: readonly string[]) => roleKeys.some((key) => MFA_REQUIRED_ROLES.includes(key as RoleKey));
