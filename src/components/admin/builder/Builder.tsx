"use client";
/**
 * The page builder (A5 brief §28–§35, §44–§47, §54–§58): one page's or service's layout as a working copy — the outline
 * of its sections with their states, the block library, the live preview of the saved layout and the inspector of the
 * selected section — saved explicitly as one change (Saved / Unsaved changes / Saving / Error). Edits stay in this
 * browser tab until saved; undo and redo cover this session's unsaved operations only (a save or a reload starts a new
 * history; saved history and restore are A8's revisions). The server decides every permission, structure rule and value
 * again on save, against the layout version this builder opened: a layout changed meanwhile is refused with the exact
 * stale message and nothing is merged.
 *
 * Unsaved work is never lost to a session that ends (A5 final correction): a save made without a live session — or from
 * a browser signed in as someone else by then — is answered in the page (the edits stay; sign in again in a new tab,
 * then save), and while the builder is dirty a copy of the working copy is kept in this tab (`useDraft`), offered back
 * the next time this person opens this layout here — restored only onto the version it was made from.
 *
 * Desktop: outline, preview and inspector side by side. Narrower screens: one of them at a time, chosen with tabs.
 */
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  createReusableFromSectionAction,
  detachSectionAction,
  initializeLayoutAction,
  saveLayoutAction,
} from "@/server/admin/actions/builder";
import type { BlockModel, BuilderLocale, BuilderModel, BuilderSaveState, SectionData } from "@/server/admin/actions/builder-model";
import type { MediaCardModel } from "@/server/admin/actions/media-model";
import type { PreviewToBuilder } from "@/server/admin/actions/preview-protocol";
import { LocaleBadge } from "../cms/ContentEditor";
import { useUnsavedChanges } from "../cms/useUnsavedChanges";
import { Canvas, DEVICES, previewUrl, type PreviewDevice } from "./Canvas";
import { keepLayout, readKeptLayout, restoreLayout } from "./draft";
import { KeptWorkNotice, SignedOutNotice } from "./DraftNotice";
import { FieldEnvProvider, type FieldEnv } from "./env";
import {
  ANCHOR_PATTERN,
  anchorsOf,
  copyWithNewIds,
  holdsContent,
  initialSections,
  LANGUAGE,
  layoutKey,
  layoutPayload,
  newRef,
  newSectionData,
  sectionsLinkingTo,
  type Devices,
  type WorkingSection,
} from "./model";
import { SectionEditor } from "./SectionEditor";
import { useDraft } from "./useDraft";
import { useStickyBar } from "./useStickyBar";

type Issue = { ref?: string; path?: string; message: string };
type SaveView =
  | { status: "idle" }
  | { status: "saving" }
  | { status: "saved"; message: string }
  | { status: "stale"; message: string }
  | { status: "signed_out"; message: string; reason: "ended" | "other_user" }
  | { status: "error"; message: string; issues: Issue[] };
type Panel = "outline" | "preview" | "edit";
type Done = "saved" | "setup" | "detached" | "copied" | "linked";

const DEVICE_NAMES: Record<keyof Devices, string> = { desktop: "Desktop", tablet: "Tablet", mobile: "Phone" };
const HISTORY_LIMIT = 100;
const NEEDS_CLEAN = "Save or undo your changes first: this acts on the saved layout at once.";

/** `viewer`: the id of the person this builder was opened for (its saves name them; its kept copy is theirs). */
export function Builder({ model, initialSection, viewer }: { model: BuilderModel; initialSection: string | null; viewer: string }) {
  const router = useRouter();
  const id = useId();
  const opened = useMemo(() => initialSections(model), [model]);
  const openedKey = useMemo(() => layoutKey(opened), [opened]);
  const [sections, setSections] = useState<WorkingSection[]>(opened);
  const [past, setPast] = useState<WorkingSection[][]>([]);
  const [future, setFuture] = useState<WorkingSection[][]>([]);
  const lastEdit = useRef<string | null>(null);
  const [selected, setSelected] = useState<string | null>(initialSection && model.sections.some((s) => s.id === initialSection) ? initialSection : null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [locale, setLocale] = useState<BuilderLocale>("en");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [device, setDevice] = useState<PreviewDevice>("desktop");
  const [panel, setPanel] = useState<Panel>("outline");
  const [save, setSave] = useState<SaveView>({ status: "idle" });
  const [media, setMedia] = useState<Record<string, MediaCardModel>>(model.media);
  const [frameNotes, setFrameNotes] = useState<Record<string, string[]>>({});
  const [status, setStatus] = useState("");
  const [removing, setRemoving] = useState<WorkingSection | null>(null);
  const [busy, setBusy] = useState(false);
  // After a save, until the stored layout replaces this working copy (a new version remounts the builder), nothing more
  // can be edited here: an edit made in between would be dropped by that reload.
  const [reloading, setReloading] = useState(false);
  const removeDialog = useRef<HTMLDialogElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const tabs = useRef<HTMLDivElement>(null);
  useStickyBar(root, bar);

  const sectionsKey = layoutKey(sections);
  const dirty = sectionsKey !== openedKey;

  // The copy of this working copy kept in the tab, and the one an earlier visit kept (until restored or discarded).
  const keeper = useDraft({
    user: viewer,
    kind: model.owner.type,
    id: model.owner.id,
    base: model.lockVersion,
    enabled: model.can.content && !model.owner.archived,
    dirty,
    version: sectionsKey,
    payload: () => keepLayout(sections, media),
    read: readKeptLayout,
  });
  // Leaving through a link asks first; confirmed, the edits are dropped as the question says (the kept copy too).
  useUnsavedChanges(dirty, undefined, keeper.drop);
  const kept = keeper.pending;
  const keptBlocked = !kept
    ? null
    : kept.base !== model.lockVersion
      ? `this layout was saved again since then (version ${kept.base}, now ${model.lockVersion}), and restoring them would overwrite the newer version.`
      : !restoreLayout(kept.payload.sections, opened, new Set(Object.keys(model.blocks)), () => "new:check")
        ? "they no longer match this layout's sections."
        : null;

  // Nor while a save or an immediate action is on its way (it carries the working copy as it was when it started), nor
  // while a kept copy waits for the person to restore or discard it.
  const locked = reloading || save.status === "saving" || busy || kept !== null;

  const blockOf = (s: WorkingSection): BlockModel | undefined => model.blocks[s.blockType];
  const current = sections.find((s) => s.ref === selected) ?? null;
  const issues: Issue[] = save.status === "error" ? save.issues : [];
  const issuesOf = (ref: string) => issues.filter((i) => i.ref === ref);

  // --- History ---------------------------------------------------------------------------------------------------------------

  // Typing in one field is one step of the history until another field or operation comes between.
  const apply = (next: WorkingSection[], editKey?: string) => {
    const coalesce = editKey !== undefined && lastEdit.current === editKey;
    if (!coalesce) {
      setPast((p) => [...p.slice(-(HISTORY_LIMIT - 1)), sections]);
      setFuture([]);
    }
    lastEdit.current = editKey ?? null;
    setSections(next);
    if (save.status === "saved") setSave({ status: "idle" });
  };
  const undo = () => {
    const previous = past[past.length - 1];
    if (!previous) return;
    setFuture((f) => [sections, ...f].slice(0, HISTORY_LIMIT));
    setPast((p) => p.slice(0, -1));
    lastEdit.current = null;
    setSections(previous);
    setStatus("Undone.");
  };
  const redo = () => {
    const next = future[0];
    if (!next) return;
    setPast((p) => [...p, sections]);
    setFuture((f) => f.slice(1));
    lastEdit.current = null;
    setSections(next);
    setStatus("Redone.");
  };
  // Ctrl/Cmd+Z and Shift+Ctrl/Cmd+Z outside text fields (a text field keeps its own undo).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "z") return;
      const target = event.target as HTMLElement | null;
      if (target && (target.closest("input, textarea, select, [contenteditable]") || target.isContentEditable)) return;
      event.preventDefault();
      if (locked) return;
      if (event.shiftKey) redo();
      else undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // --- Operations on the working copy ---------------------------------------------------------------------------------------

  const patch = (ref: string, change: Partial<WorkingSection>, editKey?: string) => apply(sections.map((s) => (s.ref === ref ? { ...s, ...change } : s)), editKey);
  const updateData = (ref: string, recipe: (d: SectionData) => SectionData, editKey: string) => {
    const s = sections.find((x) => x.ref === ref);
    if (!s?.data) return;
    patch(ref, { data: recipe(s.data), dataChanged: true }, `${ref}:${editKey}`);
  };
  const move = (ref: string, by: -1 | 1) => {
    const index = sections.findIndex((s) => s.ref === ref);
    const to = index + by;
    if (index < 0 || to < 0 || to >= sections.length) return;
    const next = [...sections];
    const [moved] = next.splice(index, 1);
    next.splice(to, 0, moved);
    apply(next);
    setStatus(`Moved “${moved.label}” to position ${to + 1} of ${next.length}.`);
  };
  const duplicate = (s: WorkingSection) => {
    const block = blockOf(s);
    const copy: WorkingSection = {
      ref: newRef(),
      id: null,
      blockType: s.blockType,
      label: s.label,
      visible: s.visible,
      devices: { ...s.devices },
      anchor: null,
      locked: false,
      reusable: s.reusable,
      ...(s.id ? { duplicateOf: s.id } : s.reusableId ? { reusableId: s.reusableId } : {}),
      data: s.data && block ? copyWithNewIds(block, s.data) : null,
      // A stored section's copy is made by the server from what is stored; a new section's copy carries its data, and so
      // does the copy of a stored section with unsaved edits (the copy shows them, so it must store them).
      dataChanged: !s.reusableId && !s.reusable && (!s.id || s.dataChanged),
      model: null,
    };
    const index = sections.findIndex((x) => x.ref === s.ref);
    apply([...sections.slice(0, index + 1), copy, ...sections.slice(index + 1)]);
    setSelected(copy.ref);
    setStatus(`Duplicated “${s.label}”${s.reusable ? " as another link to the same reusable section" : ""}.`);
  };
  const add = (block: BlockModel) => {
    const s: WorkingSection = {
      ref: newRef(),
      id: null,
      blockType: block.key,
      label: block.label,
      visible: true,
      devices: { desktop: true, tablet: true, mobile: true },
      anchor: block.anchor === "fixed" ? block.fixedAnchor : null,
      locked: false,
      reusable: null,
      data: newSectionData(block),
      dataChanged: true,
      model: null,
    };
    insert(s);
    setStatus(`Added “${block.label}”. Edit it, then save.`);
  };
  const link = (reusable: BuilderModel["reusables"][number]) => {
    const s: WorkingSection = {
      ref: newRef(),
      id: null,
      blockType: reusable.blockType,
      label: reusable.blockLabel,
      visible: true,
      devices: { desktop: true, tablet: true, mobile: true },
      anchor: null,
      locked: false,
      reusable: { id: reusable.id, name: reusable.name, archived: false, href: `/admin/reusable-sections/${reusable.id}` },
      reusableId: reusable.id,
      data: null,
      dataChanged: false,
      model: null,
    };
    insert(s);
    setStatus(`Linked the reusable section “${reusable.name}”.`);
  };
  const insert = (s: WorkingSection) => {
    const index = current ? sections.findIndex((x) => x.ref === current.ref) : sections.length - 1;
    apply([...sections.slice(0, index + 1), s, ...sections.slice(index + 1)]);
    setSelected(s.ref);
  };
  const remove = (s: WorkingSection) => {
    apply(sections.filter((x) => x.ref !== s.ref));
    if (selected === s.ref) setSelected(null);
    setStatus(`Removed “${s.label}” from the layout. Undo brings it back until you save.`);
  };
  const askRemove = (s: WorkingSection) => {
    if (!holdsContent(blockOf(s), s.data).length && !s.reusable) return remove(s);
    setRemoving(s);
    removeDialog.current?.showModal();
  };

  // --- What each section may do here ------------------------------------------------------------------------------------------

  type Op = "move" | "hide" | "remove" | "duplicate" | "anchor" | "edit";
  const can = (s: WorkingSection, op: Op): { allowed: boolean; reason?: string } => {
    if (s.model) return s.model.ops[op];
    // A section added in this session: the block's own structure rules and this person's permissions.
    const block = blockOf(s);
    if (op === "edit") return model.can.content ? { allowed: true } : { allowed: false, reason: "You can view this layout but not edit it." };
    if (!model.can.structure) return { allowed: false, reason: model.structureNote ?? "You can't change this layout's structure." };
    if (!block) return { allowed: false, reason: "Unknown block." };
    if (op === "move") return block.structure.movable ? { allowed: true } : { allowed: false, reason: "This block keeps its place." };
    if (op === "hide") return block.structure.hideable ? { allowed: true } : { allowed: false, reason: "This block can't be hidden." };
    if (op === "remove") return block.structure.removable ? { allowed: true } : { allowed: false, reason: "This block can't be removed." };
    if (op === "duplicate") return block.structure.duplicable && block.max > sections.filter((x) => x.blockType === s.blockType).length ? { allowed: true } : { allowed: false, reason: "This page already has as many of this block as it may." };
    return block.anchor === "editable" ? { allowed: true } : { allowed: false, reason: block.anchor === "fixed" ? "This block's anchor is fixed." : "This block has no anchor." };
  };

  // --- Save and the immediate actions -----------------------------------------------------------------------------------------

  // `done` names what the screen confirms once it has reloaded the stored layout (fixed wording on the server side).
  const afterSave = (result: BuilderSaveState, done: Done) => {
    if (result.status === "ok") {
      // The builder opens again with the saved layout (a new version: a new history), the selection kept in the address;
      // the version in the address makes every save a new address, so the stored layout is always read again.
      const keep = selected && result.ids[selected] ? result.ids[selected] : selected;
      setSave({ status: "saved", message: result.message });
      const url = new URL(window.location.href);
      if (keep && !keep.startsWith("new:")) url.searchParams.set("section", keep);
      else url.searchParams.delete("section");
      url.searchParams.set("done", done);
      url.searchParams.set("v", String(result.lockVersion));
      if (result.lockVersion !== model.lockVersion) {
        // Stored: the kept copy goes, and nothing more is kept from this working copy (the stored version replaces it).
        keeper.saved();
        setReloading(true);
        // Should the reload not arrive (a lost connection), editing comes back rather than staying locked.
        window.setTimeout(() => setReloading(false), 20_000);
      }
      router.replace(`${url.pathname}${url.search}`, { scroll: false });
    } else if (result.status === "stale") setSave({ status: "stale", message: result.message });
    else if (result.status === "signed_out") setSave({ status: "signed_out", message: result.message, reason: result.reason });
    else setSave({ status: "error", message: result.message, issues: result.issues ?? [] });
  };
  const saveLayout = async () => {
    if (!dirty || save.status === "saving") return;
    setSave({ status: "saving" });
    try {
      afterSave(await saveLayoutAction(JSON.stringify(layoutPayload(model.owner, model.lockVersion, sections)), viewer), "saved");
    } catch {
      setSave({ status: "error", message: "The save didn't reach the server. Check the connection and try again; your changes are still here.", issues: [] });
    }
  };
  const immediate = async (done: Done, run: () => Promise<BuilderSaveState>) => {
    setBusy(true);
    try {
      afterSave(await run(), done);
    } catch {
      setSave({ status: "error", message: "The request didn't reach the server. Try again.", issues: [] });
    } finally {
      setBusy(false);
    }
  };
  const ownerRef = { type: model.owner.type, id: model.owner.id };

  const restoreKept = () => {
    const next = kept && !keptBlocked ? restoreLayout(kept.payload.sections, opened, new Set(Object.keys(model.blocks)), newRef) : null;
    if (!kept || !next) return;
    // Items chosen before the copy was kept: their cards come back with it (the page's own cards win).
    setMedia((m) => ({ ...Object.fromEntries(kept.payload.media.map((card) => [card.id, card])), ...m }));
    apply(next);
    setSelected(null);
    keeper.restored();
    setStatus("Restored the unsaved changes kept in this tab. Review them, then save.");
  };
  const keptFile = () => ({
    name: `unsaved-layout-${model.owner.slug ?? model.owner.id}-${kept ? new Date(kept.savedAt).toISOString().slice(0, 16).replace(/[:T]/g, "") : ""}.json`,
    json: () =>
      JSON.stringify(
        {
          kind: "RAWASY admin: unsaved page layout",
          record: { type: model.owner.type, id: model.owner.id, label: model.owner.label },
          keptAt: kept ? new Date(kept.savedAt).toISOString() : null,
          madeOnVersion: kept?.base ?? null,
          storedVersionNow: model.lockVersion,
          sections: kept?.payload.sections ?? [],
          media: kept?.payload.media ?? [],
        },
        null,
        2,
      ),
  });

  // On a narrow screen (one panel at a time) a choice made far down the outline opens the inspector at its top.
  const showPanel = (next: Panel) => {
    setPanel(next);
    const el = tabs.current;
    if (!el || getComputedStyle(el).display === "none") return;
    const top = el.getBoundingClientRect().top;
    if (top < 64 || top > window.innerHeight) window.scrollBy({ top: top - 72, behavior: "instant" });
  };

  // --- The preview's messages ---------------------------------------------------------------------------------------------------

  const onFrameMessage = (message: PreviewToBuilder) => {
    if (message.type === "ready") setFrameNotes(message.notes);
    if (message.type === "pick") {
      setSelected(message.id);
      showPanel("edit");
    }
    if (message.type === "locale") setLocale(message.locale);
    if (message.type === "theme") setTheme(message.theme);
    if (message.type === "link") setStatus(message.href === "form" ? "Forms don't send anything from the preview." : `Links don't open from the preview (${message.href}).`);
  };

  // --- The fields' environment ------------------------------------------------------------------------------------------------

  const anchors = anchorsOf(sections, model.blocks);
  const env: FieldEnv = {
    options: model.options,
    links: model.links,
    media,
    remember: (card) => setMedia((m) => ({ ...m, [card.id]: card })),
    canUpload: model.canUpload,
    anchors,
    disabled: !model.can.content || save.status === "saving" || reloading || kept !== null,
    issues: current ? issuesOf(current.ref) : [],
  };

  const saveText =
    save.status === "saving"
      ? "Saving…"
      : reloading
        ? "Saved: loading it…"
        : save.status === "error"
          ? "Error: not saved"
          : save.status === "stale"
            ? "Changed elsewhere: not saved"
            : save.status === "signed_out"
              ? "Signed out: not saved"
              : dirty
                ? "Unsaved changes"
                : "Saved";

  return (
    <div className="adm-bld" data-panel={panel} ref={root}>
      <div className="adm-bld-top" role="group" aria-label="Builder controls" ref={bar}>
        <div className="adm-bld-top-group">
          <button type="button" className="adm-btn is-small" onClick={undo} disabled={!past.length || locked} aria-keyshortcuts="Control+Z">
            Undo
          </button>
          <button type="button" className="adm-btn is-small" onClick={redo} disabled={!future.length || locked} aria-keyshortcuts="Control+Shift+Z">
            Redo
          </button>
          <span className="adm-bld-save" data-state={save.status === "idle" ? (dirty ? "dirty" : "saved") : save.status} role="status" aria-live="polite">
            {saveText}
          </span>
          <button type="button" className="adm-btn is-primary" onClick={() => void saveLayout()} disabled={!dirty || save.status === "saving" || reloading || !model.can.content}>
            {save.status === "saving" ? "Saving…" : "Save layout"}
          </button>
        </div>
        <div className="adm-bld-top-group is-preview">
          <label className="adm-sr-only" htmlFor={`${id}-locale`}>
            Preview language
          </label>
          <select id={`${id}-locale`} className="adm-input adm-bld-select" value={locale} onChange={(e) => setLocale(e.target.value as BuilderLocale)}>
            <option value="en">English</option>
            <option value="ar">Arabic</option>
          </select>
          <label className="adm-sr-only" htmlFor={`${id}-device`}>
            Preview width
          </label>
          <select id={`${id}-device`} className="adm-input adm-bld-select" value={device} onChange={(e) => setDevice(e.target.value as PreviewDevice)}>
            {DEVICES.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
          <label className="adm-sr-only" htmlFor={`${id}-theme`}>
            Preview theme
          </label>
          <select id={`${id}-theme`} className="adm-input adm-bld-select" value={theme} onChange={(e) => setTheme(e.target.value as "light" | "dark")}>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
          <a className="adm-btn is-small" href={previewUrl(model.owner.previewHref, locale, theme, device, false)} target="_blank" rel="noopener">
            Open preview in a new tab
          </a>
        </div>
      </div>
      <p className="adm-sr-only" role="status" aria-live="polite">
        {status}
      </p>
      {status ? <p className="adm-hint adm-bld-status">{status}</p> : null}
      {kept ? (
        <KeptWorkNotice
          savedAt={kept.savedAt}
          blocked={keptBlocked}
          onRestore={restoreKept}
          onDiscard={() => {
            keeper.discard();
            setStatus("Discarded the unsaved changes kept in this tab.");
          }}
          download={keptFile()}
        />
      ) : null}
      {save.status === "signed_out" ? <SignedOutNotice reason={save.reason} message={save.message} saveLabel="Save layout" /> : null}
      {save.status === "stale" ? (
        <div className="adm-alert is-warning adm-bld-notice" role="alert">
          <p>{save.message}</p>
          <p>
            Your edits are still here. Reloading shows the latest saved layout; your edits are not applied to it, but a copy stays in this tab and is
            offered for download after the reload.
          </p>
          <button type="button" className="adm-btn" onClick={() => window.confirm("Reload the latest version? Your edits are not applied to it; a copy stays in this tab for download.") && window.location.reload()}>
            Reload the latest version
          </button>
        </div>
      ) : null}
      {save.status === "error" ? (
        <div className="adm-alert is-error" role="alert">
          <p>{save.message}</p>
          {issues.filter((i) => !i.ref || !sections.some((s) => s.ref === i.ref)).length ? (
            <ul>
              {issues
                .filter((i) => !i.ref || !sections.some((s) => s.ref === i.ref))
                .map((i, n) => (
                  <li key={n}>{i.message}</li>
                ))}
            </ul>
          ) : null}
          {issues.some((i) => i.ref && sections.some((s) => s.ref === i.ref)) ? <p>The sections marked “Needs attention” in the outline say what to change.</p> : null}
        </div>
      ) : null}

      <div className="adm-bld-tabs adm-bld-panels-tabs" role="group" aria-label="Builder view" ref={tabs}>
        {(["outline", "preview", "edit"] as Panel[]).map((p) => (
          <button key={p} type="button" className="adm-btn is-small" aria-pressed={panel === p} onClick={() => setPanel(p)}>
            {p === "outline" ? "Outline" : p === "preview" ? "Preview" : "Edit"}
          </button>
        ))}
      </div>

      <div className="adm-bld-grid" inert={locked}>
        {/* Outline and library */}
        <section className="adm-bld-panel adm-bld-outline" data-panel="outline" aria-labelledby={`${id}-outline`}>
          <h2 id={`${id}-outline`}>Sections</h2>
          {model.structureNote ? (
            <p className="adm-bld-lock">
              <strong>Locked structure</strong> — {model.structureNote}
            </p>
          ) : null}
          {model.warnings.length ? (
            <ul className="adm-bld-warnings">
              {model.warnings.map((w, i) => (
                <li key={i}>{w.message}</li>
              ))}
            </ul>
          ) : null}
          {!sections.length ? (
            <div className="adm-empty">
              <p>This layout is not set up yet.</p>
              {model.can.initialize ? (
                <button type="button" className="adm-btn is-primary" disabled={busy || dirty} onClick={() => void immediate("setup", () => initializeLayoutAction({ owner: ownerRef, expectedVersion: model.lockVersion }, viewer))}>
                  Set up this layout
                </button>
              ) : (
                <p className="adm-hint">An Owner or Admin sets it up (its required sections, empty).</p>
              )}
            </div>
          ) : (
            <ol className="adm-bld-cards">
              {sections.map((s, index) => (
                <OutlineCard
                  key={s.ref}
                  s={s}
                  block={blockOf(s)}
                  index={index}
                  total={sections.length}
                  selected={selected === s.ref}
                  attention={issuesOf(s.ref).length > 0}
                  structural={model.can.structure}
                  pageNote={model.structureNote}
                  can={(op) => can(s, op)}
                  onSelect={() => {
                    setSelected(s.ref);
                    showPanel("edit");
                  }}
                  onHover={(on) => setHovered(on && s.id ? s.id : null)}
                  onMove={(by) => move(s.ref, by)}
                  onDuplicate={() => duplicate(s)}
                  onToggle={() => patch(s.ref, { visible: !s.visible })}
                  onRemove={() => askRemove(s)}
                />
              ))}
            </ol>
          )}
          {model.can.structure && model.library.length ? <Library model={model} sections={sections} onAdd={add} onLink={link} /> : null}
        </section>

        {/* Preview */}
        <section className="adm-bld-panel adm-bld-preview" data-panel="preview" aria-label="Preview">
          {dirty ? <p className="adm-hint adm-bld-warn">The preview shows the last saved layout. Save to see your changes in it.</p> : null}
          <Canvas
            href={model.owner.previewHref}
            title={`Preview of ${model.owner.label}`}
            locale={locale}
            theme={theme}
            device={device}
            version={model.lockVersion}
            selected={current?.id ?? null}
            hovered={hovered}
            onMessage={onFrameMessage}
          />
        </section>

        {/* Inspector */}
        <section className="adm-bld-panel adm-bld-inspector" data-panel="edit" aria-labelledby={`${id}-inspector`}>
          <h2 id={`${id}-inspector`}>{current ? current.label : "Edit"}</h2>
          {!current ? (
            <p className="adm-hint">Choose a section in the outline or in the preview to edit it.</p>
          ) : (
            <FieldEnvProvider env={env}>
              <Inspector
                key={current.ref}
                s={current}
                block={blockOf(current)}
                model={model}
                sections={sections}
                locale={locale}
                setLocale={setLocale}
                can={(op) => can(current, op)}
                frameNotes={current.id ? (frameNotes[current.id] ?? []) : []}
                issues={issuesOf(current.ref)}
                dirty={dirty}
                busy={busy}
                patch={(change, editKey) => patch(current.ref, change, editKey)}
                update={(recipe, editKey) => updateData(current.ref, recipe, editKey)}
                onDetach={() =>
                  void immediate("detached", () => detachSectionAction({ owner: ownerRef, expectedVersion: model.lockVersion, sectionId: current.id }, viewer))
                }
                onCreateReusable={(name, mode) =>
                  void immediate(mode === "copy" ? "copied" : "linked", () => createReusableFromSectionAction({ owner: ownerRef, expectedVersion: model.lockVersion, sectionId: current.id, name, mode }, viewer))
                }
              />
            </FieldEnvProvider>
          )}
        </section>
      </div>

      <dialog ref={removeDialog} className="adm-dialog" aria-labelledby={`${id}-remove-title`} onClose={() => setRemoving(null)}>
        <div className="adm-dialog-body">
          <h2 id={`${id}-remove-title`}>Remove “{removing?.label}”?</h2>
          <p>
            {removing?.reusable
              ? "It shows a reusable section; removing it removes only this link (the reusable section stays)."
              : `It holds ${holdsContent(removing ? blockOf(removing) : undefined, removing?.data ?? null).join(", ")}.`}{" "}
            Until you save, Undo brings it back. A saved removal is kept in the layout&apos;s history once revisions exist (A8).
          </p>
          <div className="adm-actions">
            <button
              type="button"
              className="adm-btn is-danger"
              onClick={() => {
                if (removing) remove(removing);
                removeDialog.current?.close();
              }}
            >
              Remove the section
            </button>
            <button type="button" className="adm-btn" onClick={() => removeDialog.current?.close()}>
              Keep it
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
}

// --- The outline ---------------------------------------------------------------------------------------------------------------

function OutlineCard({
  s,
  block,
  index,
  total,
  selected,
  attention,
  structural,
  pageNote,
  can,
  onSelect,
  onHover,
  onMove,
  onDuplicate,
  onToggle,
  onRemove,
}: {
  s: WorkingSection;
  block: BlockModel | undefined;
  index: number;
  total: number;
  selected: boolean;
  attention: boolean;
  /** Whether this person may change the layout's structure at all (otherwise the card offers Edit only). */
  structural: boolean;
  /** The layout's own lock note, shown once above the outline (not repeated on each card). */
  pageNote: string | null;
  can: (op: "move" | "hide" | "remove" | "duplicate" | "edit") => { allowed: boolean; reason?: string };
  onSelect: () => void;
  onHover: (on: boolean) => void;
  onMove: (by: -1 | 1) => void;
  onDuplicate: () => void;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const id = useId();
  const ops = { move: can("move"), hide: can("hide"), remove: can("remove"), duplicate: can("duplicate") };
  // "Edit" when the inspector lets this person change something here (texts and settings, or where it shows).
  const editable = can("edit").allowed || ops.hide.allowed;
  const reasons = [...new Set(Object.values(ops).flatMap((o) => (o.allowed || !o.reason || o.reason === pageNote ? [] : [o.reason])))];
  const devices = (Object.keys(DEVICE_NAMES) as (keyof Devices)[]).filter((d) => s.devices[d]);
  const warnings = (s.model?.warnings.length ?? 0) + (s.model?.missing.length ? 1 : 0) + (s.model?.problem ? 1 : 0);
  return (
    <li className="adm-bld-card" data-selected={selected ? "" : undefined} data-hidden={s.visible ? undefined : ""} onMouseEnter={() => onHover(true)} onMouseLeave={() => onHover(false)}>
      <div className="adm-bld-card-head">
        <span className="adm-bld-card-pos" aria-hidden>
          {index + 1}
        </span>
        <span className="adm-bld-card-title">
          <button type="button" className="adm-link-btn" onClick={onSelect} aria-current={selected ? "true" : undefined} aria-describedby={`${id}-meta`}>
            {s.label}
          </button>
          <span className="adm-muted adm-bld-card-type">
            {block ? `${block.categoryLabel} · ${s.blockType}` : s.blockType}
            {s.anchor ? ` · #${s.anchor}` : block?.anchor === "fixed" && block.fixedAnchor ? ` · #${block.fixedAnchor}` : ""}
          </span>
        </span>
      </div>
      <div className="adm-badges" id={`${id}-meta`}>
        {!s.visible ? <span className="adm-badge is-warning">Hidden</span> : null}
        {s.id === null ? <span className="adm-badge is-info">New, not saved</span> : null}
        {s.model ? (
          <>
            <LocaleBadge locale="en" state={s.model.status.en} />
            <LocaleBadge locale="ar" state={s.model.status.ar} />
          </>
        ) : null}
        <span className="adm-badge">{devices.length === 3 ? "All screens" : devices.length ? devices.map((d) => DEVICE_NAMES[d]).join(" · ") : "No screen"}</span>
        {s.reusable ? <span className="adm-badge is-info">Reusable: {s.reusable.name}</span> : null}
        {s.locked ? <span className="adm-badge">Locked</span> : null}
        {warnings ? (
          <span className="adm-badge is-warning">
            {warnings} warning{warnings === 1 ? "" : "s"}
          </span>
        ) : null}
        {attention ? <span className="adm-badge is-danger">Needs attention</span> : null}
        {s.dataChanged && s.id ? <span className="adm-badge is-info">Edited</span> : null}
      </div>
      <div className="adm-bld-card-actions">
        <button type="button" className="adm-btn is-small" onClick={onSelect} aria-label={`${editable ? "Edit" : "View"} “${s.label}”`}>
          {editable ? "Edit" : "View"}
        </button>
        {structural ? (
          <>
            <button type="button" className="adm-btn is-small" disabled={!ops.move.allowed || index === 0} onClick={() => onMove(-1)} aria-label={`Move “${s.label}” up`}>
              Up
            </button>
            <button type="button" className="adm-btn is-small" disabled={!ops.move.allowed || index === total - 1} onClick={() => onMove(1)} aria-label={`Move “${s.label}” down`}>
              Down
            </button>
            <button type="button" className="adm-btn is-small" disabled={!ops.duplicate.allowed} onClick={onDuplicate} aria-label={`Duplicate “${s.label}”`}>
              Duplicate
            </button>
            <button type="button" className="adm-btn is-small" disabled={!ops.hide.allowed} onClick={onToggle} aria-label={`${s.visible ? "Hide" : "Show"} “${s.label}”`}>
              {s.visible ? "Hide" : "Show"}
            </button>
            <button type="button" className="adm-btn is-small" disabled={!ops.remove.allowed} onClick={onRemove} aria-label={`Remove “${s.label}”`}>
              Remove
            </button>
          </>
        ) : null}
      </div>
      {reasons.length ? (
        <p className="adm-bld-lock">
          <strong>Locked structure</strong> — {reasons.join(" ")}
        </p>
      ) : null}
    </li>
  );
}

// --- The block library -----------------------------------------------------------------------------------------------------------

function Library({ model, sections, onAdd, onLink }: { model: BuilderModel; sections: WorkingSection[]; onAdd: (block: BlockModel) => void; onLink: (r: BuilderModel["reusables"][number]) => void }) {
  const id = useId();
  const groups = new Map<string, BlockModel[]>();
  for (const key of model.library) {
    const block = model.blocks[key];
    if (!block) continue;
    groups.set(block.categoryLabel, [...(groups.get(block.categoryLabel) ?? []), block]);
  }
  const full = (block: BlockModel) => sections.filter((s) => s.blockType === block.key).length >= block.max;
  return (
    <details className="adm-bld-library">
      <summary>Add a block</summary>
      <p className="adm-hint">A new block is added after the selected section (or at the end). Only blocks this page allows are listed.</p>
      {[...groups.entries()].map(([group, blocks]) => (
        <section key={group} aria-labelledby={`${id}-${group}`}>
          <h3 id={`${id}-${group}`}>{group}</h3>
          <ul className="adm-bld-lib-list">
            {blocks.map((block) => (
              <li key={block.key}>
                <span className="adm-bld-lib-text">
                  <span className="adm-bld-lib-name">{block.label}</span>
                  <span className="adm-hint">{full(block) ? `This page already has ${block.max === 1 ? "one" : `${block.max}`}, the most it may.` : block.description}</span>
                </span>
                <button type="button" className="adm-btn is-small" disabled={full(block)} onClick={() => onAdd(block)} aria-label={`Add “${block.label}”`}>
                  Add
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {model.reusables.length ? (
        <section aria-labelledby={`${id}-reusable`}>
          <h3 id={`${id}-reusable`}>Reusable sections</h3>
          <p className="adm-hint">A linked section shows the reusable section&apos;s own settings and texts; editing it changes every page that links it.</p>
          <ul className="adm-bld-lib-list">
            {model.reusables.map((r) => (
              <li key={r.id}>
                <span className="adm-bld-lib-text">
                  <span className="adm-bld-lib-name">{r.name}</span>
                  <span className="adm-hint">{r.blockLabel}</span>
                </span>
                <button type="button" className="adm-btn is-small" onClick={() => onLink(r)} aria-label={`Link “${r.name}”`}>
                  Link
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </details>
  );
}

// --- The inspector -------------------------------------------------------------------------------------------------------------------

function Inspector({
  s,
  block,
  model,
  sections,
  locale,
  setLocale,
  can,
  frameNotes,
  issues,
  dirty,
  busy,
  patch,
  update,
  onDetach,
  onCreateReusable,
}: {
  s: WorkingSection;
  block: BlockModel | undefined;
  model: BuilderModel;
  sections: WorkingSection[];
  locale: BuilderLocale;
  setLocale: (l: BuilderLocale) => void;
  can: (op: "move" | "hide" | "remove" | "duplicate" | "anchor" | "edit") => { allowed: boolean; reason?: string };
  frameNotes: string[];
  issues: Issue[];
  dirty: boolean;
  busy: boolean;
  patch: (change: Partial<WorkingSection>, editKey?: string) => void;
  update: (recipe: (d: SectionData) => SectionData, editKey: string) => void;
  onDetach: () => void;
  onCreateReusable: (name: string, mode: "copy" | "link") => void;
}) {
  const id = useId();
  const [name, setName] = useState(s.label);
  const hide = can("hide");
  const anchorOp = can("anchor");
  const edit = can("edit");
  const deviceKeys = Object.keys(DEVICE_NAMES) as (keyof Devices)[];
  const onlyDevice = deviceKeys.filter((d) => s.devices[d]).length === 1;
  const stored = s.model?.anchor ?? null;
  const linking = stored && stored !== s.anchor ? sectionsLinkingTo(sections, stored, s.ref) : [];
  const anchorProblem = s.anchor && !ANCHOR_PATTERN.test(s.anchor) ? "Use lowercase letters, digits and single hyphens, starting with a letter." : s.anchor && anchorsOf(sections.filter((x) => x.ref !== s.ref), model.blocks).includes(s.anchor) ? "Another section of this page uses this anchor." : null;
  const general = issues.filter((i) => !i.path || i.path === "section" || i.path === "blockType");
  const changed = s.dataChanged && Boolean(s.model);
  const move = can("move");
  const lockText = s.locked || (!move.allowed && move.reason) ? (move.reason ?? "This section keeps its place.") : null;

  return (
    <div className="adm-bld-inspect">
      {block ? <p className="adm-hint">{block.description}</p> : null}
      {lockText ? (
        <p className="adm-bld-lock">
          <strong>Locked structure</strong> — {lockText}
        </p>
      ) : null}
      {s.model?.problem ? (
        <div className="adm-alert is-warning" role="note">
          <p>{s.model.problem}</p>
        </div>
      ) : null}
      {general.map((i, n) => (
        <p key={n} className="adm-hint adm-error" role="alert">
          {i.message}
        </p>
      ))}

      <section className="adm-bld-group" aria-labelledby={`${id}-where`}>
        <h3 id={`${id}-where`}>Where it shows</h3>
        <label className="adm-check" htmlFor={`${id}-visible`}>
          <input id={`${id}-visible`} type="checkbox" checked={s.visible} disabled={!hide.allowed} onChange={(e) => patch({ visible: e.target.checked })} aria-describedby={`${id}-visible-hint`} />
          <span>Show this section</span>
        </label>
        <p className="adm-hint" id={`${id}-visible-hint`}>
          {hide.allowed ? "A hidden section stays in the outline (marked Hidden) and is left out of the page." : hide.reason === lockText ? "Locked: see above." : hide.reason}
        </p>
        <fieldset className="adm-bld-devices" disabled={!hide.allowed || !s.visible}>
          <legend className="adm-label">Screens</legend>
          {deviceKeys.map((d) => (
            <label key={d} className="adm-check" htmlFor={`${id}-${d}`}>
              <input
                id={`${id}-${d}`}
                type="checkbox"
                checked={s.devices[d]}
                disabled={s.devices[d] && onlyDevice}
                onChange={(e) => patch({ devices: { ...s.devices, [d]: e.target.checked } })}
              />
              <span>{DEVICE_NAMES[d]}</span>
            </label>
          ))}
          <p className="adm-hint">At least one screen stays on while the section is shown (hide the section instead). Tablet: up to 1023 px; phone: up to 639 px.</p>
        </fieldset>
        {block?.anchor === "editable" ? (
          <div className="adm-field">
            <label className="adm-label" htmlFor={`${id}-anchor`}>
              Anchor (the section&apos;s address on the page, #…)
            </label>
            <input
              id={`${id}-anchor`}
              className="adm-input"
              dir="ltr"
              value={s.anchor ?? ""}
              disabled={!anchorOp.allowed}
              maxLength={64}
              onChange={(e) => patch({ anchor: e.target.value.trim() || null }, "anchor")}
              aria-describedby={`${id}-anchor-hint`}
              aria-invalid={anchorProblem ? true : undefined}
            />
            <p className="adm-hint" id={`${id}-anchor-hint`}>
              {anchorOp.allowed ? "Optional. Lowercase letters, digits and hyphens; unique on this page." : anchorOp.reason}
            </p>
            {anchorProblem ? <p className="adm-hint adm-error">{anchorProblem}</p> : null}
            {linking.length ? (
              <p className="adm-hint adm-bld-warn">
                {linking.map((x) => `“${x.label}”`).join(", ")} link{linking.length === 1 ? "s" : ""} to #{stored}: change {linking.length === 1 ? "that link" : "those links"} too, or keep the anchor.
              </p>
            ) : null}
          </div>
        ) : block?.anchor === "fixed" && block.fixedAnchor ? (
          <p className="adm-hint">Anchor #{block.fixedAnchor}: required by this page (links elsewhere go to it), so it can&apos;t be changed.</p>
        ) : null}
      </section>

      {s.reusable ? (
        <section className="adm-bld-group" aria-labelledby={`${id}-linked`}>
          <h3 id={`${id}-linked`}>Reusable section</h3>
          <p>
            This section shows the reusable section “{s.reusable.name}”{s.reusable.archived ? " (archived)" : ""}. Its settings and texts are edited there and change every page that links it.
          </p>
          <div className="adm-actions">
            {model.can.reusableEdit ? (
              <a className="adm-btn" href={s.reusable.href}>
                Edit the reusable section
              </a>
            ) : null}
            {s.id && s.model?.ops.detach.allowed ? (
              <button type="button" className="adm-btn" disabled={dirty || busy} onClick={onDetach} aria-describedby={dirty ? `${id}-detach-hint` : undefined}>
                Detach (make a local copy)
              </button>
            ) : null}
          </div>
          {s.id && s.model?.ops.detach.allowed ? (
            <p className="adm-hint" id={`${id}-detach-hint`}>
              {dirty ? NEEDS_CLEAN : "Detaching copies its current settings and texts into this page's own section; later edits to the reusable section no longer reach it."}
            </p>
          ) : null}
        </section>
      ) : null}

      {s.data && block && edit.allowed ? (
        <SectionEditor block={block} data={s.data} status={s.model?.status ?? null} locale={locale} setLocale={setLocale} update={update} changed={changed} />
      ) : !s.reusable ? (
        <p className="adm-hint">{edit.reason ?? (s.data ? "This section can't be edited here." : "This section's data can't be read; it can't be edited here.")}</p>
      ) : null}

      {block?.reusable && s.id && !s.reusable && model.can.reusableEdit && model.can.structure ? (
        <section className="adm-bld-group" aria-labelledby={`${id}-make`}>
          <h3 id={`${id}-make`}>Make it reusable</h3>
          <p className="adm-hint">
            A copy keeps this section as it is and adds the reusable section to the library. “Create and link” turns this section into a link to the new reusable section. Nothing is linked unless you
            choose it.
          </p>
          <label className="adm-label" htmlFor={`${id}-name`}>
            Name of the reusable section
          </label>
          <input id={`${id}-name`} className="adm-input" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
          <div className="adm-actions">
            <button type="button" className="adm-btn" disabled={dirty || busy || !name.trim()} onClick={() => onCreateReusable(name, "copy")}>
              Create reusable copy
            </button>
            <button type="button" className="adm-btn" disabled={dirty || busy || !name.trim()} onClick={() => onCreateReusable(name, "link")}>
              Create and link
            </button>
          </div>
          {dirty ? <p className="adm-hint">{NEEDS_CLEAN}</p> : null}
        </section>
      ) : null}

      {s.model?.warnings.length || s.model?.missing.length || frameNotes.length ? (
        <section className="adm-bld-group" aria-labelledby={`${id}-notes`}>
          <h3 id={`${id}-notes`}>Notes</h3>
          <ul className="adm-bld-warnings">
            {s.model?.missing.length ? <li>Not set yet: {s.model.missing.join(", ")}.</li> : null}
            {s.model?.warnings.map((w, i) => (
              <li key={`w${i}`}>{w}</li>
            ))}
            {frameNotes.map((n, i) => (
              <li key={`n${i}`}>In the preview ({LANGUAGE[locale]}): {n}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
