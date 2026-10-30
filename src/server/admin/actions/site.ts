"use server";
/**
 * Server Actions of the site controls (A6): settings, interface text, navigation, theme and redirects. Each starts with
 * the admin's own checks — the gate, the session, the request's origin and the permission (`actionContext`, refusals
 * audited) — before it reads its input, then hands the change to the site services (`src/server/site/`), which decide
 * the permission again inside their transaction, lock the aggregate root, check the version the form showed, validate
 * everything and audit the outcome. Inputs are small structured objects validated by strict schemas: nothing a client
 * sends about who acts, a version's authority, a status or a publication is used. Theme changes also need a recent
 * sign-in (step-up): the theme is the Owner's alone.
 */
import { actionContext, type ActionContext } from "../guards";
import { guarded } from "../context";
import type { SiteChange, SiteResult } from "@/server/site/common";
import { saveMenu, setUpNavigation } from "@/server/site/menus";
import { saveRedirect, setRedirectActive } from "@/server/site/redirects";
import { saveSettings, setUpSettings } from "@/server/site/settings";
import { resetTheme, setTokenOverride } from "@/server/site/theme";
import { saveUiText, setUpUiText } from "@/server/site/ui-text";
import type { SiteActionState } from "./site-model";

const changeOf = (context: ActionContext): SiteChange => ({
  deps: { pool: context.deps.pool, db: context.deps.db, clock: context.deps.clock },
  actor: context.actor,
  meta: context.meta,
});

const NOT_FOUND = "This item no longer exists. Reload the page.";

function stateOf(result: SiteResult): SiteActionState {
  switch (result.kind) {
    case "ok":
      return { status: "ok", message: result.summary, lockVersion: result.lockVersion, id: result.id };
    case "invalid":
      return { status: "error", message: result.message, issues: result.issues };
    case "stale":
      return { status: "error", message: result.message, issues: [], stale: true };
    case "denied":
      return { status: "error", message: result.message, issues: [] };
    case "not_found":
      return { status: "error", message: NOT_FOUND, issues: [] };
  }
}

/** The guard's refusal (signed out → the sign-in page; another origin, a missing permission or step-up → its message). */
const refusal = (state: { status: string; message?: string; stepUp?: boolean }): SiteActionState => ({
  status: "error",
  message: state.message ?? "This request was refused.",
  issues: [],
  ...(state.stepUp ? { stepUp: true as const } : {}),
});

async function run(action: string, permission: string, work: (change: SiteChange) => Promise<SiteResult>, options: { stepUp?: boolean } = {}): Promise<SiteActionState> {
  const ctx = await actionContext(action, { permission, stepUp: options.stepUp });
  if (!ctx.ok) return refusal(ctx.state);
  return stateOf(await guarded(() => work(changeOf(ctx.context))));
}

export async function setUpSettingsAction(): Promise<SiteActionState> {
  return run("site_settings.setup", "settings.edit", (change) => setUpSettings(change));
}

export async function saveSettingsAction(input: unknown): Promise<SiteActionState> {
  return run("site_settings.update", "settings.edit", (change) => saveSettings(change, input));
}

export async function setUpUiTextAction(): Promise<SiteActionState> {
  return run("ui_text.setup", "settings.edit", (change) => setUpUiText(change));
}

export async function saveUiTextAction(input: unknown): Promise<SiteActionState> {
  return run("ui_text.update", "settings.edit", (change) => saveUiText(change, input));
}

export async function setUpNavigationAction(): Promise<SiteActionState> {
  return run("menu.setup", "menus.edit", (change) => setUpNavigation(change));
}

export async function saveMenuAction(input: unknown): Promise<SiteActionState> {
  return run("menu.update", "menus.edit", (change) => saveMenu(change, input));
}

/**
 * Set one design-token override. No screen calls it while no token is approved (D-A6-3: the list is empty), so the build
 * registers no action for it and no request can reach it; once the Owner approves a token, its screen imports this.
 */
export async function setTokenOverrideAction(input: unknown): Promise<SiteActionState> {
  return run("theme.override", "theme.edit", (change) => setTokenOverride(change, input), { stepUp: true });
}

export async function resetThemeAction(input: unknown): Promise<SiteActionState> {
  return run("theme.reset", "theme.edit", (change) => resetTheme(change, input), { stepUp: true });
}

export async function saveRedirectAction(input: unknown): Promise<SiteActionState> {
  // Only the id is read first, to name the refusal as the service names the change (an id: an edit), as the toggle is
  // named by `active`.
  const id = (input as { id?: unknown } | null)?.id;
  return run(typeof id === "string" && id ? "redirect.update" : "redirect.create", "redirects.manage", (change) => saveRedirect(change, input));
}

export async function setRedirectActiveAction(input: { id: unknown; expectedVersion: unknown; active: unknown }): Promise<SiteActionState> {
  const active = input?.active === true;
  return run(active ? "redirect.activate" : "redirect.deactivate", "redirects.manage", (change) =>
    setRedirectActive(change, { id: input?.id, expectedVersion: input?.expectedVersion, active }),
  );
}
