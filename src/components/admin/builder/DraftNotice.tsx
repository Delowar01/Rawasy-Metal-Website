"use client";
/**
 * What the page builder and the reusable section editor say about unsaved work (A5 final correction): a copy an earlier
 * visit kept in this tab (restore it, or — when it can't be applied over what is stored now — download or discard it),
 * and a save that was not made because the session had ended (the edits stay; sign in again in a new tab, then save).
 */

const when = (savedAt: number) => new Date(savedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });

export function KeptWorkNotice({
  savedAt,
  blocked,
  onRestore,
  onDiscard,
  download,
}: {
  savedAt: number;
  /** Why the copy can't be restored here (null: it can). */
  blocked: string | null;
  onRestore: () => void;
  onDiscard: () => void;
  /** The file offered when the copy can't be restored: its name and its contents. */
  download: { name: string; json: () => string };
}) {
  const save = () => {
    const url = URL.createObjectURL(new Blob([download.json()], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = download.name;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };
  const discard = () => {
    if (window.confirm("Discard the unsaved changes kept in this tab? They can't be brought back.")) onDiscard();
  };
  return (
    <div className="adm-alert is-warning adm-bld-notice" role="alert" data-kept-work={blocked ? "blocked" : "restorable"}>
      <p>
        <strong>Unsaved changes from {when(savedAt)} were kept in this browser tab.</strong>{" "}
        {blocked
          ? `They can't be restored here: ${blocked}`
          : "They were not saved — the page was left or reloaded, or your session ended first. Restore them to go on editing (then save), or discard them."}
      </p>
      {blocked ? <p>Download them to compare with what is stored now, or discard them. Nothing is changed until you decide.</p> : null}
      <div className="adm-actions">
        {blocked ? (
          <button type="button" className="adm-btn" onClick={save}>
            Download the kept changes
          </button>
        ) : (
          <button type="button" className="adm-btn is-primary" onClick={onRestore}>
            Restore unsaved changes
          </button>
        )}
        <button type="button" className="adm-btn" onClick={discard}>
          Discard them
        </button>
      </div>
    </div>
  );
}

export function SignedOutNotice({ reason, message, saveLabel }: { reason: "ended" | "other_user"; message: string; saveLabel: string }) {
  return (
    <div className="adm-alert is-warning adm-bld-notice" role="alert" data-signed-out={reason}>
      <p>
        <strong>{message}</strong> Your changes are still here, and a copy is kept in this browser tab.
      </p>
      {reason === "ended" ? (
        <>
          <p>Sign in again in a new tab, then come back to this tab and select “{saveLabel}”.</p>
          <div className="adm-actions">
            <a className="adm-btn" href="/admin/login?session_ended=1" target="_blank" rel="noopener noreferrer">
              Sign in again in a new tab
            </a>
          </div>
        </>
      ) : (
        <p>In the other tab, sign out and sign in again as yourself, then come back to this tab and select “{saveLabel}”.</p>
      )}
    </div>
  );
}
