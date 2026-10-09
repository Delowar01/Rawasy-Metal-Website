import type { Metadata } from "next";
import { ConfirmAction } from "@/components/admin/ConfirmAction";
import { revokeOtherSessionsAction, revokeOwnSessionAction } from "@/server/admin/actions/account";
import { authDeps, guarded } from "@/server/admin/context";
import { requireActor } from "@/server/admin/guards";
import { listLiveSessions } from "@/server/auth/sessions";
import { describeAgent, formatTime, PageHeader, RIYADH_NOTE } from "../../../_components/parts";

export const metadata: Metadata = { title: "Sessions" };

export default async function SessionsPage() {
  const { actor, mfa } = await requireActor();
  const deps = authDeps();
  const sessions = await guarded(() => listLiveSessions(deps.db, actor.user.id, deps.clock()));
  const others = sessions.filter((s) => s.id !== actor.session.id);
  // A sign-in that passed the password but not yet the second step (it ends 10 minutes after it started).
  const halfway = (session: (typeof sessions)[number]) => mfa.enrolled && !session.mfaVerifiedAt;
  return (
    <>
      <PageHeader
        title="Sessions"
        crumbs={[{ label: "My account", href: "/admin/account" }, { label: "Sessions" }]}
        lead="Where your account is signed in. Sessions end after 2 hours without activity, or 12 hours after signing in."
        actions={
          others.length ? (
            <ConfirmAction
              action={revokeOtherSessionsAction}
              label="Sign out all other sessions"
              title="Sign out all other sessions?"
              confirmLabel="Sign them out"
              fields={{}}
              danger
            >
              <p>Every session except this one ends at once.</p>
            </ConfirmAction>
          ) : null
        }
      />
      <section className="adm-card" aria-labelledby="sessions-title">
        <div className="adm-card-head">
          <h2 id="sessions-title">Active sessions</h2>
          <span className="adm-hint">{RIYADH_NOTE}</span>
        </div>
        <ul className="adm-list">
          {sessions.map((session) => (
            <li key={session.id}>
              <span>
                <strong>{describeAgent(session.userAgent)}</strong>
                {session.id === actor.session.id ? <span className="adm-badge is-success">This session</span> : null}
                {halfway(session) ? <span className="adm-badge is-warning">Second step not completed</span> : null}
                <br />
                {halfway(session) ? (
                  <span className="adm-muted">
                    Your password was entered here, but not the authentication code. If this wasn&apos;t you, change your password.
                    <br />
                  </span>
                ) : null}
                <span className="adm-muted">
                  {session.ip ?? "Address unknown"} · last active {formatTime(session.lastSeenAt)} · ends {formatTime(session.absoluteExpiresAt)} at the
                  latest
                </span>
              </span>
              {session.id === actor.session.id ? null : (
                <ConfirmAction
                  action={revokeOwnSessionAction}
                  label="Sign out"
                  title="Sign out this session?"
                  confirmLabel="Sign it out"
                  fields={{ session: session.id }}
                  small
                >
                  <p>
                    {describeAgent(session.userAgent)} ({session.ip ?? "address unknown"}) will need to sign in again.
                  </p>
                </ConfirmAction>
              )}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
