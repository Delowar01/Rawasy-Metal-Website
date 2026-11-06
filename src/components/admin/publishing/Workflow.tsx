"use client";
/**
 * The publishing steps of one item (A8.2): each a confirmation dialog (`ConfirmAction`) that sends the version this page
 * showed, so a step taken on an older page is refused rather than applied to a newer working copy. The server decides
 * every permission again; these buttons only appear for what the page found this person may do.
 */
import { revisionAction, workflowAction } from "@/server/admin/actions/publishing";
import { ConfirmAction } from "../ConfirmAction";

export interface WorkflowProps {
  type: string;
  id: string;
  version: number;
  one: string;
  label: string;
  publication: "unpublished" | "published" | "archived";
  draft: "none" | "draft" | "in_review";
  blocking: number;
  legal: boolean;
  review: boolean;
  linkedFrom: number;
  can: { submit: boolean; review: boolean; publish: boolean; unpublish: boolean; edit: boolean; withdraw: boolean };
}

const NOTE_MAX = 500;

function Note({ name, label, required = false, rows = 3, max = NOTE_MAX }: { name: string; label: string; required?: boolean; rows?: number; max?: number }) {
  const id = `wf-${name}`;
  return (
    <div className="adm-field">
      <label className="adm-label" htmlFor={id}>
        {label}
      </label>
      <textarea id={id} className="adm-input" name={name} rows={rows} maxLength={max} required={required} />
    </div>
  );
}

export function WorkflowButtons(props: WorkflowProps) {
  const { type, id, version, one, label, publication, draft, can } = props;
  const base = { type, id, version: String(version) };
  if (publication === "archived") return <p className="adm-hint">An archived {one} can&apos;t be published. Restore it from the archive first.</p>;
  const buttons = [];
  if (props.review && draft === "draft" && can.submit) {
    buttons.push(
      <ConfirmAction key="submit" action={workflowAction} label="Submit for review" title={`Submit “${label}” for review?`} confirmLabel="Submit for review" fields={{ ...base, step: "submit" }}>
        <p>A reviewer checks this version and publishes it or sends it back with a comment. Editing it meanwhile takes it out of review.</p>
        <Note name="message" label="Note for the reviewer (optional)" />
      </ConfirmAction>,
    );
  }
  if (draft === "in_review" && can.review) {
    buttons.push(
      <ConfirmAction key="request" action={workflowAction} label="Request changes" title={`Send “${label}” back?`} confirmLabel="Send back with comment" fields={{ ...base, step: "request_changes" }}>
        <p>It returns to its editors as a draft, with your comment.</p>
        <Note name="comment" label="What needs to change" required rows={5} max={2000} />
      </ConfirmAction>,
    );
  }
  if (draft === "in_review" && can.withdraw) {
    buttons.push(
      <ConfirmAction key="withdraw" action={workflowAction} label="Withdraw from review" title={`Withdraw “${label}” from review?`} confirmLabel="Withdraw" fields={{ ...base, step: "withdraw" }}>
        <p>It becomes a draft again. Nothing is published.</p>
      </ConfirmAction>,
    );
  }
  if (can.publish && draft !== "none") {
    const verb = draft === "in_review" ? "Approve and publish" : "Publish";
    buttons.push(
      <ConfirmAction key="publish" action={workflowAction} label={verb} title={`${verb} “${label}”?`} confirmLabel={verb} fields={{ ...base, step: "publish" }}>
        <p>
          This version becomes the live version in the database&apos;s public read model. The public website keeps showing today&apos;s approved pages until the
          content cutover (A9){draft === "in_review" ? "" : "; publishing without review is recorded in the audit log"}.
        </p>
        {props.blocking ? (
          <p className="adm-hint">
            The check below lists {props.blocking} problem{props.blocking === 1 ? "" : "s"} that will keep it from being published.
          </p>
        ) : null}
        {props.legal ? (
          <div className="adm-field">
            <label className="adm-label" htmlFor="wf-legalReviewer">
              The legal text has been reviewed by
            </label>
            <input id="wf-legalReviewer" className="adm-input" name="legalReviewer" type="text" maxLength={200} required autoComplete="off" />
            <p className="adm-hint">A legal page is published only after legal review; the name is kept in the version&apos;s history and the audit log.</p>
          </div>
        ) : null}
        <Note name="message" label="Change note (optional)" />
      </ConfirmAction>,
    );
  }
  if (publication === "published" && draft !== "none" && can.edit) {
    buttons.push(
      <ConfirmAction key="discard" action={workflowAction} label="Discard draft changes" title={`Discard the draft changes of “${label}”?`} confirmLabel="Discard changes" fields={{ ...base, step: "discard" }} danger>
        <p>The working copy goes back to the live version. The discarded draft stays in the history and can be restored.</p>
      </ConfirmAction>,
    );
  }
  if (publication === "published" && can.unpublish) {
    buttons.push(
      <ConfirmAction key="unpublish" action={workflowAction} label="Unpublish" title={`Unpublish “${label}”?`} confirmLabel="Unpublish" fields={{ ...base, step: "unpublish" }} danger>
        <p>The live version is taken out of the public read model; the working copy stays as a draft and can be published again.</p>
        {props.linkedFrom ? (
          <p className="adm-hint">
            {props.linkedFrom} live item{props.linkedFrom === 1 ? " links" : "s link"} to it and will leave it out.
          </p>
        ) : null}
      </ConfirmAction>,
    );
  }
  if (!buttons.length) return <p className="adm-hint">Nothing to do here with your permissions in this state.</p>;
  return <div className="adm-actions">{buttons}</div>;
}

export function RevisionButtons(props: { type: string; id: string; version: number; revision: { id: string; number: number; kind: string }; canRestore: boolean; canRollback: boolean; legal: boolean; live: boolean }) {
  const { type, id, version, revision } = props;
  const base = { type, id, version: String(version), revision: revision.id };
  return (
    <span className="adm-actions">
      {props.canRestore ? (
        <ConfirmAction small action={revisionAction} label="Restore" title={`Restore revision ${revision.number} into the working copy?`} confirmLabel="Restore this version" fields={{ ...base, mode: "restore" }}>
          <p>The working copy becomes this version (checked like a save). Nothing is published, and the current working copy stays in the history.</p>
        </ConfirmAction>
      ) : null}
      {props.canRollback && revision.kind === "publish" && !props.live ? (
        <ConfirmAction small action={revisionAction} label="Roll back to this" title={`Roll back to revision ${revision.number}?`} confirmLabel="Roll back and publish" fields={{ ...base, mode: "rollback" }} danger>
          <p>This published version is restored and published again, checked against today&apos;s rules (languages, media, flags, addresses).</p>
          {props.legal ? (
            <div className="adm-field">
              <label className="adm-label" htmlFor={`rb-legal-${revision.id}`}>
                The legal text has been reviewed by
              </label>
              <input id={`rb-legal-${revision.id}`} className="adm-input" name="legalReviewer" type="text" maxLength={200} required autoComplete="off" />
            </div>
          ) : null}
        </ConfirmAction>
      ) : null}
    </span>
  );
}
