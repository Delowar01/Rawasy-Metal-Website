"use client";
/**
 * Media folders (A4 brief §36): create, rename, nest (move under another folder or to the top), reorder among siblings,
 * and delete only an empty folder. Folders only organise the library — they never change an address. Forms and buttons
 * only (no dragging); every change is decided again by the server (`media.edit`), which refuses cycles, duplicate
 * sibling names and path separators.
 */
import { useRouter } from "next/navigation";
import { useActionState, useId, useState } from "react";
import { createFolderAction, deleteFolderAction, moveFolderAction, renameFolderAction, reorderFolderAction } from "@/server/admin/actions/media";
import { idle, type ActionState } from "@/server/admin/actions/state";
import { ConfirmAction } from "../ConfirmAction";
import { FormAlert, SubmitButton } from "../forms";

export interface FolderView {
  id: string;
  name: string;
  parentId: string | null;
  depth: number;
  path: string;
  children: number;
  items: number;
}

function useRefreshing(action: (state: ActionState, form: FormData) => Promise<ActionState>) {
  const router = useRouter();
  return useActionState(async (previous: ActionState, form: FormData) => {
    const result = await action(previous, form);
    if (result.status === "ok") router.refresh();
    return result;
  }, idle);
}

function FolderRow({ folder, folders, canEdit, first, last }: { folder: FolderView; folders: FolderView[]; canEdit: boolean; first: boolean; last: boolean }) {
  const uid = useId();
  const [renameState, rename] = useRefreshing(renameFolderAction);
  const [moveState, move] = useRefreshing(moveFolderAction);
  const [orderState, reorder] = useRefreshing(reorderFolderAction);
  const [name, setName] = useState(folder.name);
  // A folder can't move under itself or one of its own subfolders.
  const descendant = (candidate: FolderView) => candidate.path === folder.path || candidate.path.startsWith(`${folder.path} / `);
  const targets = folders.filter((f) => !descendant(f) && f.id !== folder.parentId);
  return (
    <li className={`adm-folder is-depth-${Math.min(folder.depth, 5)}`}>
      <div className="adm-folder-head">
        <strong>{folder.name}</strong>
        <span className="adm-hint">
          {folder.path} · {folder.items} item{folder.items === 1 ? "" : "s"}
          {folder.children ? ` · ${folder.children} subfolder${folder.children === 1 ? "" : "s"}` : ""}
        </span>
        <a className="adm-btn is-small" href={`/admin/media?folder=${folder.id}`}>
          Open in the library<span className="adm-sr-only">: {folder.name}</span>
        </a>
      </div>
      {canEdit ? (
        <div className="adm-folder-tools">
          <form action={rename} className="adm-rel-add">
            <input type="hidden" name="id" value={folder.id} />
            <label className="adm-sr-only" htmlFor={`${uid}-name`}>
              New name for {folder.name}
            </label>
            <input id={`${uid}-name`} name="name" className="adm-input" value={name} maxLength={200} onChange={(e) => setName(e.target.value)} autoComplete="off" />
            <SubmitButton variant="secondary" pending="Renaming…">
              Rename
            </SubmitButton>
          </form>
          <form action={move} className="adm-rel-add">
            <input type="hidden" name="id" value={folder.id} />
            <label className="adm-sr-only" htmlFor={`${uid}-parent`}>
              Move {folder.name} to
            </label>
            <select id={`${uid}-parent`} name="parent" className="adm-input" defaultValue="">
              <option value="">Move to…</option>
              {folder.parentId ? <option value="top">The top level</option> : null}
              {targets.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.path}
                </option>
              ))}
            </select>
            <SubmitButton variant="secondary" pending="Moving…">
              Move
            </SubmitButton>
          </form>
          <div className="adm-actions">
            <form action={reorder}>
              <input type="hidden" name="id" value={folder.id} />
              <input type="hidden" name="direction" value="up" />
              <button type="submit" className="adm-btn is-small" disabled={first} aria-label={`Move ${folder.name} up`}>
                Up
              </button>
            </form>
            <form action={reorder}>
              <input type="hidden" name="id" value={folder.id} />
              <input type="hidden" name="direction" value="down" />
              <button type="submit" className="adm-btn is-small" disabled={last} aria-label={`Move ${folder.name} down`}>
                Down
              </button>
            </form>
            {folder.items === 0 && folder.children === 0 ? (
              <ConfirmAction action={deleteFolderAction} label="Delete" title={`Delete the folder “${folder.name}”?`} confirmLabel="Delete the folder" fields={{ id: folder.id }} danger small>
                <p>The folder is empty. Deleting it changes nothing else.</p>
              </ConfirmAction>
            ) : (
              <span className="adm-hint">Only an empty folder can be deleted.</span>
            )}
          </div>
          <FormAlert state={renameState} />
          <FormAlert state={moveState} />
          <FormAlert state={orderState} />
        </div>
      ) : null}
    </li>
  );
}

export function FolderManager({ folders, canEdit }: { folders: FolderView[]; canEdit: boolean }) {
  const uid = useId();
  const [createState, create] = useRefreshing(createFolderAction);
  const siblingsOf = (folder: FolderView) => folders.filter((f) => f.parentId === folder.parentId);
  return (
    <div className="adm-folders">
      {folders.length === 0 ? (
        <p className="adm-muted">No folders yet.</p>
      ) : (
        <ul className="adm-folder-list">
          {folders.map((folder) => {
            const siblings = siblingsOf(folder);
            return <FolderRow key={folder.id} folder={folder} folders={folders} canEdit={canEdit} first={siblings[0]?.id === folder.id} last={siblings[siblings.length - 1]?.id === folder.id} />;
          })}
        </ul>
      )}
      {canEdit ? (
        <form action={create} className="adm-form adm-flag-add">
          <div className="adm-field">
            <label className="adm-label" htmlFor={`${uid}-new`}>
              New folder name
            </label>
            <input id={`${uid}-new`} name="name" className="adm-input" maxLength={200} required autoComplete="off" aria-describedby={`${uid}-new-hint`} />
            <p className="adm-hint" id={`${uid}-new-hint`}>
              Plain text on one line, without / or \. Unique among its neighbours.
            </p>
          </div>
          <div className="adm-field">
            <label className="adm-label" htmlFor={`${uid}-under`}>
              Inside
            </label>
            <select id={`${uid}-under`} name="parent" className="adm-input" defaultValue="">
              <option value="">The top level</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.path}
                </option>
              ))}
            </select>
          </div>
          <FormAlert state={createState} />
          <div className="adm-actions">
            <SubmitButton pending="Creating…">Create folder</SubmitButton>
          </div>
        </form>
      ) : (
        <p className="adm-hint">Your roles let you view folders, not change them.</p>
      )}
    </div>
  );
}
