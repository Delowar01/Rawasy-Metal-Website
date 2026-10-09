import Link from "next/link";
import type { ReactNode } from "react";
import { SignOutButton } from "@/components/admin/AuthForms";
import { MenuCloser, NavLink, SessionKeeper } from "@/components/admin/Shell";
import { requireActor } from "@/server/admin/guards";
import { ROLE_NAMES } from "../_components/parts";

const Icon = ({ d }: { d: string }) => (
  <svg className="adm-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);

const ICONS = {
  dashboard: "M4 13h6V4H4zM14 20h6v-9h-6zM4 20h6v-4H4zM14 7h6V4h-6z",
  users: "M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19M10 10.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6M20 19v-1.5a3.5 3.5 0 0 0-2.5-3.35M15.5 4.6a3 3 0 0 1 0 5.8",
  roles: "M12 3l7 3v5c0 4.5-3 8.2-7 10-4-1.8-7-5.5-7-10V6zM9 12l2 2 4-4",
  account: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8M5 20a7 7 0 0 1 14 0",
  security: "M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6zM12 15v2",
  sessions: "M4 5h16v11H4zM8 20h8M12 16v4",
  website: "M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5",
};

function Navigation({ permissions }: { permissions: ReadonlySet<string> }) {
  return (
    <nav className="adm-nav" aria-label="Admin sections">
      <div className="adm-nav-group">
        <NavLink href="/admin" exact>
          <Icon d={ICONS.dashboard} />
          Dashboard
        </NavLink>
      </div>
      {permissions.has("users.view") ? (
        <div className="adm-nav-group">
          <p className="adm-nav-title">Users &amp; access</p>
          <NavLink href="/admin/users" exact>
            <Icon d={ICONS.users} />
            Users
          </NavLink>
          {permissions.has("roles.view") ? (
            <NavLink href="/admin/users/roles">
              <Icon d={ICONS.roles} />
              Roles &amp; permissions
            </NavLink>
          ) : null}
        </div>
      ) : null}
      <div className="adm-nav-group">
        <p className="adm-nav-title">My account</p>
        <NavLink href="/admin/account" exact>
          <Icon d={ICONS.account} />
          Profile &amp; password
        </NavLink>
        <NavLink href="/admin/account/security">
          <Icon d={ICONS.security} />
          Two-factor authentication
        </NavLink>
        <NavLink href="/admin/account/sessions">
          <Icon d={ICONS.sessions} />
          Sessions
        </NavLink>
      </div>
    </nav>
  );
}

/** The signed-in admin: top bar, sidebar (a menu on phones), main area. Pages check the session again themselves. */
export default async function ShellLayout({ children }: { children: ReactNode }) {
  const { actor, mfa } = await requireActor();
  const initials = actor.user.displayName
    .split(/\s+/)
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div className="adm-app">
      <a className="adm-skip" href="#main">
        Skip to content
      </a>
      <header className="adm-top">
        <details className="adm-menu" data-adm-menu="">
          <summary className="adm-btn is-ghost">
            <svg className="adm-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
            Menu
          </summary>
          <div className="adm-menu-panel">
            <Navigation permissions={actor.permissions} />
            {/* Phones: the top bar has no room for "View website", so it sits at the end of the menu. */}
            <a className="adm-nav-link adm-menu-site" href="/" target="_blank" rel="noopener">
              <Icon d={ICONS.website} />
              View website<span className="adm-sr-only"> (opens in a new tab)</span>
            </a>
          </div>
        </details>
        <Link className="adm-brand" href="/admin" aria-label="RAWASY Admin — dashboard">
          <span className="adm-brand-mark" aria-hidden="true">
            R
          </span>
          <span>
            RAWASY
            <small>Admin</small>
          </span>
        </Link>
        <div className="adm-top-end">
          <a className="adm-btn is-ghost is-small adm-top-site" href="/" target="_blank" rel="noopener">
            View website<span className="adm-sr-only"> (opens in a new tab)</span>
          </a>
          <details className="adm-account" data-adm-menu="">
            <summary className="adm-btn is-ghost" aria-label={`Account: ${actor.user.displayName}`}>
              <span className="adm-avatar" aria-hidden="true">
                {initials || "?"}
              </span>
            </summary>
            <div className="adm-account-panel">
              <div className="adm-account-who">
                <strong>{actor.user.displayName}</strong>
                <span className="adm-muted">{actor.user.email}</span>
                <span className="adm-muted">
                  {actor.roles.map((r) => ROLE_NAMES[r] ?? r).join(", ") || "No role"} · 2FA {mfa.enrolled ? "on" : "off"}
                </span>
              </div>
              <Link className="adm-nav-link" href="/admin/account">
                Profile &amp; password
              </Link>
              <Link className="adm-nav-link" href="/admin/account/security">
                Two-factor authentication
              </Link>
              <Link className="adm-nav-link" href="/admin/account/sessions">
                Sessions
              </Link>
              <SignOutButton />
            </div>
          </details>
        </div>
      </header>
      <div className="adm-body">
        <aside className="adm-side">
          <div className="adm-side-inner">
            <Navigation permissions={actor.permissions} />
          </div>
        </aside>
        <main id="main" className="adm-main" tabIndex={-1}>
          <div className="adm-main-inner">{children}</div>
        </main>
      </div>
      <SessionKeeper rotateAt={actor.session.createdAt.getTime() + 30 * 60_000} />
      <MenuCloser />
    </div>
  );
}
