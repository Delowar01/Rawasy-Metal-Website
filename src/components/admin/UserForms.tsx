"use client";
/** "Users & access" forms: invite a user, show a link that could not be emailed, and change a user's roles. */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useActionState, useEffect, useState } from "react";
import { inviteUserAction, resendInvitationAction, setUserRolesAction, type InviteState } from "@/server/admin/actions/users";
import { idle } from "@/server/admin/actions/state";
import { Field, FormAlert, SubmitButton } from "./forms";

export interface RoleOption {
  key: string;
  name: string;
  description: string;
  grantable: boolean;
}

function RoleChecks({ roles, selected }: { roles: RoleOption[]; selected: string[] }) {
  return (
    <fieldset className="adm-checks">
      <legend>Roles</legend>
      {roles.map((role) => (
        <label key={role.key} className="adm-check">
          <input type="checkbox" name="roles" value={role.key} defaultChecked={selected.includes(role.key)} disabled={!role.grantable} />
          <span>
            <strong>{role.name}</strong>
            <br />
            <span className="adm-hint">
              {role.description}
              {role.grantable ? "" : " (only an Owner can grant this role)"}
            </span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}

/** A single-use link shown once, when no email could be sent. */
function ManualLink({ link, email }: { link: string; email?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="adm-alert is-warning" role="status">
      <p>
        <strong>No email was sent</strong> — this site does not send email yet. Give this single-use link to {email ?? "the person"} through a channel
        you trust. It expires in 72 hours and is shown only now.
      </p>
      <p className="adm-secret">{link}</p>
      <div className="adm-actions">
        <button
          type="button"
          className="adm-btn is-small"
          onClick={async () => {
            await navigator.clipboard.writeText(link);
            setCopied(true);
          }}
        >
          {copied ? "Copied" : "Copy link"}
        </button>
      </div>
    </div>
  );
}

export function InviteUserForm({ roles }: { roles: RoleOption[] }) {
  const [state, action] = useActionState(inviteUserAction, idle as InviteState);
  if (state.status === "ok") {
    return (
      <div className="adm-form">
        {state.link ? (
          <ManualLink link={state.link} email={state.email} />
        ) : (
          <div className="adm-alert is-success" role="status">
            <p>
              Invitation sent to {state.email}. The link works once and expires in 72 hours.
              {state.delivered ? " (Local development: the message is in the mail sink.)" : ""}
            </p>
          </div>
        )}
        <div className="adm-actions">
          <Link className="adm-btn" href="/admin/users">
            Back to users
          </Link>
          {/* A full reload starts a fresh form. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a className="adm-btn" href="/admin/users/invite">
            Invite someone else
          </a>
        </div>
      </div>
    );
  }
  return (
    <form action={action} className="adm-form" noValidate>
      <FormAlert state={state} />
      <Field label="Email" name="email" type="email" autoComplete="off" required defaultValue={state.fields?.email} />
      <Field label="Name" name="displayName" autoComplete="off" required maxLength={120} defaultValue={state.fields?.displayName} />
      <RoleChecks roles={roles} selected={[]} />
      <div className="adm-actions">
        <SubmitButton pending="Inviting…">Send invitation</SubmitButton>
      </div>
    </form>
  );
}

export function ResendInvitation({ userId, email, version }: { userId: string; email: string; version: string }) {
  const [state, action] = useActionState(resendInvitationAction, idle as InviteState);
  return (
    <form action={action} className="adm-form">
      <input type="hidden" name="user" value={userId} />
      <input type="hidden" name="version" value={version} />
      {state.status === "ok" && state.link ? <ManualLink link={state.link} email={email} /> : null}
      {state.status === "ok" && !state.link ? (
        <div className="adm-alert is-success" role="status">
          <p>A new invitation was sent. The previous link no longer works.</p>
        </div>
      ) : null}
      <FormAlert state={state.status === "error" ? state : idle} />
      <div className="adm-actions">
        <SubmitButton variant="secondary" pending="Creating…">
          New invitation link
        </SubmitButton>
      </div>
    </form>
  );
}

/**
 * `version` is the account as this page shows it (status, roles, second factor): the server refuses the change if the
 * account has changed since — an invitation accepted, a role taken away meanwhile — so the change is decided on what
 * the page shows. The boxes always go with the version they were drawn for: they are rebuilt with it (sixth review: a
 * refresh after any other action on the page brings a new version, and boxes ticked for the older state must not be
 * sent with it), and the browser does not keep them (`autoComplete="off"`, seventh review: going back to a page it loads
 * again, or restoring a session, a browser would put the older ticks back beside the newer version).
 */
export function UserRolesForm({ userId, version, roles, selected }: { userId: string; version: string; roles: RoleOption[]; selected: string[] }) {
  const [state, action] = useActionState(setUserRolesAction, idle);
  const router = useRouter();
  useEffect(() => {
    if (state.status === "ok") router.refresh();
  }, [state, router]);
  return (
    <form action={action} className="adm-form" autoComplete="off">
      <FormAlert state={state} />
      <input type="hidden" name="user" value={userId} />
      <Fragment key={version}>
        <input type="hidden" name="version" value={version} />
        <RoleChecks roles={roles} selected={selected} />
      </Fragment>
      <p className="adm-hint">Saving a change signs the user out of every session.</p>
      <div className="adm-actions">
        <SubmitButton pending="Saving…">Save roles</SubmitButton>
      </div>
    </form>
  );
}
