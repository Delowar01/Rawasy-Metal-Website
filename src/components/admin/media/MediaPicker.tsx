"use client";
/**
 * Choose a media item for a public content slot (A4 brief §52–§53): a modal dialog with a search and a page of choices
 * the server offers — public-class items only (never a private item), not in the Trash, pending review, approved or
 * restricted, each non-approved one with its warning written out. Choosing only puts the item in the form; the save
 * decides again, and nothing is approved or published. Keyboard: every choice is a button; Escape closes; focus returns
 * to the button that opened it. It lives inside the content form, so it has no form of its own: its buttons never
 * submit, and Enter in its search searches instead of saving the page.
 */
import { useId, useRef, useState, type KeyboardEvent } from "react";
import { pickMediaAction } from "@/server/admin/actions/media";
import type { MediaCardModel, PickerState } from "@/server/admin/actions/media-model";
import { MediaBadges, MediaThumb } from "./MediaCard";
import { MediaUploader } from "./MediaUploader";

export function MediaPicker({
  label,
  title,
  kinds,
  canUpload,
  exclude = [],
  onChoose,
  disabled = false,
  describedBy,
}: {
  label: string;
  title: string;
  kinds: ("image" | "document")[];
  canUpload: boolean;
  /** Items already chosen in this place (not offered again). */
  exclude?: string[];
  onChoose: (card: MediaCardModel) => void;
  disabled?: boolean;
  describedBy?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const searchId = useId();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [state, setState] = useState<PickerState | null>(null);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState("");

  const load = async (query: string, wanted: number) => {
    setLoading(true);
    try {
      setState(await pickMediaAction({ q: query, kinds, page: wanted }));
      setPage(wanted);
    } catch {
      setState({ status: "error", message: "The media list could not be loaded. Try again." });
    } finally {
      setLoading(false);
    }
  };

  const open = () => {
    setNote("");
    dialog.current?.showModal();
    void load(q, 1);
  };
  const close = () => {
    dialog.current?.close();
    opener.current?.focus();
  };
  const choose = (card: MediaCardModel) => {
    onChoose(card);
    close();
  };
  /** Choose an item by id (just uploaded, or a duplicate): only if the server offers it for this slot. */
  const chooseById = async (id: string) => {
    const result = await pickMediaAction({ q: "", kinds, page: 1, id });
    const card = result.status === "ok" ? result.items[0] : undefined;
    if (card) choose(card);
    else setNote(kinds.includes("document") ? "That item can't be chosen here." : "That item can't be chosen here (this place takes images only).");
  };
  const onSearchKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void load(q, 1);
    }
  };

  const items = state?.status === "ok" ? state.items.filter((c) => !exclude.includes(c.id)) : [];
  return (
    <>
      <button ref={opener} type="button" className="adm-btn" onClick={open} disabled={disabled} aria-describedby={describedBy}>
        {label}
      </button>
      <dialog ref={dialog} className="adm-dialog adm-picker" aria-labelledby={titleId} onClose={() => opener.current?.focus()}>
        <div className="adm-dialog-body">
          <div className="adm-picker-head">
            <h2 id={titleId}>{title}</h2>
            <button type="button" className="adm-btn is-small" onClick={close}>
              Close
            </button>
          </div>
          <p className="adm-hint">
            Public-class media only. Pending and restricted items can be prepared in drafts, but only an approved item can ever be published (A8). Private documents are
            never offered.
          </p>
          <div className="adm-picker-search" role="search">
            <label className="adm-label" htmlFor={searchId}>
              Search media
            </label>
            <div className="adm-rel-add">
              <input id={searchId} type="search" className="adm-input" value={q} maxLength={100} onChange={(e) => setQ(e.target.value)} onKeyDown={onSearchKey} autoComplete="off" />
              <button type="button" className="adm-btn" onClick={() => void load(q, 1)}>
                Search
              </button>
            </div>
          </div>
          <p className="adm-hint" role="status" aria-live="polite">
            {loading ? "Loading…" : state?.status === "ok" ? `${state.total} item${state.total === 1 ? "" : "s"} can be chosen${q ? " for this search" : ""}.` : ""}
          </p>
          {state?.status === "error" ? (
            <div className="adm-alert is-error" role="alert">
              <p>{state.message}</p>
            </div>
          ) : null}
          {note ? (
            <div className="adm-alert is-warning" role="alert">
              <p>{note}</p>
            </div>
          ) : null}
          {items.length ? (
            <ul className="adm-picker-grid">
              {items.map((card) => (
                <li key={card.id}>
                  <button type="button" className="adm-pick" onClick={() => choose(card)}>
                    <MediaThumb card={card} size="md" />
                    <span className="adm-pick-text">
                      <span className="adm-pick-label">{card.label}</span>
                      {card.labelAr ? (
                        <span lang="ar" dir="rtl" className="adm-muted">
                          {card.labelAr}
                        </span>
                      ) : null}
                      <MediaBadges card={card} />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : state?.status === "ok" && !loading ? (
            <p className="adm-empty">Nothing to choose{q ? " for this search" : ""}.</p>
          ) : null}
          {state?.status === "ok" && state.pages > 1 ? (
            <div className="adm-actions">
              <button type="button" className="adm-btn is-small" disabled={page <= 1 || loading} onClick={() => void load(q, page - 1)}>
                Previous page
              </button>
              <span className="adm-hint">
                Page {page} of {state.pages}
              </span>
              <button type="button" className="adm-btn is-small" disabled={page >= state.pages || loading} onClick={() => void load(q, page + 1)}>
                Next page
              </button>
            </div>
          ) : null}
          {canUpload ? (
            <div className="adm-picker-upload">
              <MediaUploader
                purpose="new"
                label="Or upload a new file"
                accept={kinds.includes("document") ? undefined : "image/jpeg,image/png,image/webp,image/avif,.jpg,.jpeg,.png,.webp,.avif"}
                hint={`${kinds.includes("document") ? "JPEG, PNG, WebP, AVIF or PDF" : "JPEG, PNG, WebP or AVIF"}. It starts as pending review (not public) and is chosen here once uploaded.`}
                onUploaded={(item) => void chooseById(item.mediaId)}
                onUseExisting={(id) => void chooseById(id)}
              />
            </div>
          ) : null}
        </div>
      </dialog>
    </>
  );
}
