import Link from "next/link";
import type { ReactNode } from "react";
import { StepUpForm } from "@/components/admin/StepUp";
import { hasRecentAuth, requireActor } from "@/server/admin/guards";

/** Admin times are shown in Riyadh time (A1-DATABASE-SCHEMA §3.4); stored values are UTC. */
const DATE_TIME = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Riyadh", dateStyle: "medium", timeStyle: "short" });
export const formatTime = (value: Date | null | undefined) => (value ? `${DATE_TIME.format(value)}` : "—");
export const RIYADH_NOTE = "Times are Riyadh time (UTC+3).";

/** A short, human description of a browser's user agent (shown in session lists; never trusted). */
export function describeAgent(ua: string | null | undefined): string {
  if (!ua) return "Unknown device";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\//.test(ua)
      ? "Opera"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Chrome\//.test(ua)
          ? "Chrome"
          : /Safari\//.test(ua)
            ? "Safari"
            : "Browser";
  const os = /Windows/.test(ua)
    ? "Windows"
    : /Android/.test(ua)
      ? "Android"
      : /iPhone|iPad|iOS/.test(ua)
        ? "iOS"
        : /Mac OS X|Macintosh/.test(ua)
          ? "macOS"
          : /Linux/.test(ua)
            ? "Linux"
            : "unknown system";
  return `${browser} on ${os}`;
}

export interface Crumb {
  label: string;
  href?: string;
}

export function PageHeader({ title, crumbs = [], lead, actions }: { title: string; crumbs?: Crumb[]; lead?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="adm-page-head">
      <div>
        {crumbs.length ? (
          <nav className="adm-crumbs" aria-label="Breadcrumb">
            <ol>
              {crumbs.map((crumb) => (
                <li key={crumb.label}>{crumb.href ? <Link href={crumb.href}>{crumb.label}</Link> : <span aria-current="page">{crumb.label}</span>}</li>
              ))}
            </ol>
          </nav>
        ) : null}
        <h1>{title}</h1>
        {lead ? <p className="adm-muted">{lead}</p> : null}
      </div>
      {actions ? <div className="adm-actions">{actions}</div> : null}
    </div>
  );
}

export function Forbidden() {
  return (
    <section className="adm-card" aria-labelledby="forbidden-title">
      <h2 id="forbidden-title">You don&apos;t have access to this page</h2>
      <p className="adm-muted">Your roles do not include this area. If you need it, ask an Owner or Admin.</p>
      <div className="adm-actions">
        <Link className="adm-btn" href="/admin">
          Back to the dashboard
        </Link>
      </div>
    </section>
  );
}

/** Shows `children` only after a re-authentication within the last 10 minutes (the actions check it again). */
export async function StepUpGate({ reason, children }: { reason: string; children: ReactNode }) {
  const { actor, mfa } = await requireActor();
  if (hasRecentAuth(actor)) return <>{children}</>;
  return <StepUpForm mfa={mfa.enrolled} reason={reason} />;
}

export const ROLE_NAMES: Record<string, string> = { owner: "Owner", admin: "Admin", editor: "Editor", reviewer: "Reviewer" };

export function RoleBadges({ roles }: { roles: readonly string[] }) {
  if (roles.length === 0) return <span className="adm-muted">No role</span>;
  return (
    <span className="adm-badges">
      {roles.map((role) => (
        <span key={role} className="adm-badge">
          {ROLE_NAMES[role] ?? role}
        </span>
      ))}
    </span>
  );
}

export function StatusBadge({ status, locked }: { status: string; locked?: boolean }) {
  if (locked) return <span className="adm-badge is-danger">Locked</span>;
  if (status === "active") return <span className="adm-badge is-success">Active</span>;
  if (status === "invited") return <span className="adm-badge is-warning">Invited</span>;
  return <span className="adm-badge">Disabled</span>;
}
