"use client";
/**
 * One menu slot's editor (A6.2): its items in order, each a page of the website with its label in English and Arabic
 * and whether it is shown; Move up / Move down / Remove buttons and "Add a page" (no dragging, as A4/A5). The design's
 * shape is shown where it applies: the header's Services item stays third and its first three always show; the
 * Services menu's items are fixed (its collection lists the live services; only the link's label changes). The server
 * checks every rule again.
 */
import { useState } from "react";
import { useUnsavedChanges } from "@/components/admin/cms/useUnsavedChanges";
import { saveMenuAction } from "@/server/admin/actions/site";
import type { MenuFormModel, MenuItemFormModel } from "@/server/admin/actions/site-model";
import { SaveAlert, useSiteSave } from "./useSiteSave";

export function MenuEditor({ model, routes, canEdit }: { model: MenuFormModel; routes: { key: string; name: string }[]; canEdit: boolean }) {
  const [items, setItems] = useState<MenuItemFormModel[]>(() => model.items.map((i) => ({ ...i, label: i.label ? { ...i.label } : null })));
  const { pending, state, submit, reload, issue } = useSiteSave(saveMenuAction, `/admin/navigation?saved=${model.key}`);
  const dirty = JSON.stringify(items) !== JSON.stringify(model.items);
  useUnsavedChanges(canEdit && dirty);
  const disabled = !canEdit || pending;
  const nameOf = (route: string | null) => routes.find((r) => r.key === route)?.name ?? "—";
  const pinnedAt = (i: number) => model.pinned !== null && model.pinned.position === i + 1;
  const isPinned = (item: MenuItemFormModel) => model.pinned !== null && item.route === model.pinned.route;
  const update = (index: number, change: Partial<MenuItemFormModel>) => setItems((list) => list.map((item, i) => (i === index ? { ...item, ...change } : item)));
  const move = (index: number, by: -1 | 1) =>
    setItems((list) => {
      const next = [...list];
      const [item] = next.splice(index, 1);
      next.splice(index + by, 0, item);
      return next;
    });
  const free = routes.filter((r) => !items.some((i) => i.route === r.key) && !(model.pinned && r.key === model.pinned.route));
  const prefix = `menu-${model.key}`;

  return (
    <form
      className="adm-card adm-site-menu"
      aria-labelledby={`${prefix}-title`}
      autoComplete="off"
      onSubmit={(e) => {
        e.preventDefault();
        if (canEdit) submit({ key: model.key, expectedVersion: model.lockVersion, items: items.map((i) => ({ id: i.id, route: i.route, label: i.label, isVisible: i.isVisible })) });
      }}
    >
      <div className="adm-card-head">
        <h2 id={`${prefix}-title`}>{model.name}</h2>
      </div>
      <p className="adm-hint">{model.description}</p>
      {!model.fixed ? (
        <p className="adm-hint">
          {model.minItems}–{model.maxItems} items; labels at most {model.labelMax} characters in each language.
        </p>
      ) : null}
      <SaveAlert state={state} onReload={reload} />
      {issue("items") && !issue("items.0") ? <p className="adm-hint adm-error">{issue("items")}</p> : null}
      <ol className="adm-site-rows">
        {items.map((item, i) => {
          const id = `${prefix}-${i}`;
          if (item.linkType === "collection") {
            return (
              <li key={item.id} className="adm-site-row">
                <strong>The live services</strong>
                <p className="adm-hint">Each service with its own name and tagline, in the services&apos; order (the six services of today&apos;s website until publishing, A8, and the switch, A9).</p>
              </li>
            );
          }
          const fixedRoute = model.fixed || isPinned(item);
          const routeError = issue(`items.${i}.route`);
          return (
            <li key={item.id || `new-${i}`} className="adm-site-row">
              <div className="adm-site-row-head">
                <span className="adm-order-pos" aria-hidden="true">
                  {i + 1}
                </span>
                {fixedRoute ? (
                  <span>
                    <strong>{nameOf(item.route)}</strong>
                    {pinnedAt(i) ? <span className="adm-muted"> — opens the Services menu; stays third</span> : null}
                  </span>
                ) : (
                  <div className="adm-field">
                    <label className="adm-label" htmlFor={`${id}-route`}>
                      Page
                    </label>
                    <select
                      id={`${id}-route`}
                      className="adm-input"
                      value={item.route ?? ""}
                      disabled={disabled}
                      aria-invalid={routeError ? true : undefined}
                      aria-describedby={routeError ? `${id}-route-error` : undefined}
                      onChange={(e) => update(i, { route: e.target.value })}
                    >
                      {[...routes.filter((r) => r.key === item.route), ...free].map((r) => (
                        <option key={r.key} value={r.key}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                    {routeError ? (
                      <p className="adm-hint adm-error" id={`${id}-route-error`}>
                        {routeError}
                      </p>
                    ) : null}
                  </div>
                )}
              </div>
              <div className="adm-site-pair">
                {(["en", "ar"] as const).map((locale) => {
                  const error = issue(`items.${i}.label.${locale}`);
                  const value = item.label?.[locale] ?? "";
                  return (
                    <div className="adm-field" key={locale}>
                      <label className="adm-label" htmlFor={`${id}-${locale}`}>
                        Label ({locale === "en" ? "English" : "Arabic"})
                      </label>
                      <input
                        id={`${id}-${locale}`}
                        className="adm-input"
                        value={value}
                        dir={locale === "ar" ? "rtl" : "ltr"}
                        lang={locale}
                        disabled={disabled}
                        aria-invalid={error ? true : undefined}
                        aria-describedby={`${id}-${locale}-count${error ? ` ${id}-${locale}-error` : ""}`}
                        onChange={(e) => update(i, { label: { en: item.label?.en ?? "", ar: item.label?.ar ?? "", [locale]: e.target.value } })}
                      />
                      <p className="adm-hint adm-site-count" id={`${id}-${locale}-count`}>
                        {[...value].length} / {model.labelMax}
                      </p>
                      {error ? (
                        <p className="adm-hint adm-error" id={`${id}-${locale}-error`}>
                          {error}
                        </p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
              {!model.fixed ? (
                <div className="adm-site-checks">
                  <label className="adm-check">
                    <input type="checkbox" checked={item.isVisible} disabled={disabled || model.alwaysShown.includes(i + 1)} onChange={(e) => update(i, { isVisible: e.target.checked })} />
                    Shown{model.alwaysShown.includes(i + 1) ? " (always, in this place)" : ""}
                  </label>
                </div>
              ) : null}
              {canEdit && !model.fixed ? (
                <div className="adm-actions adm-site-actions">
                  <button type="button" className="adm-btn is-small" disabled={disabled || i === 0 || isPinned(item) || pinnedAt(i - 1)} onClick={() => move(i, -1)}>
                    Move up<span className="adm-sr-only"> {nameOf(item.route)}</span>
                  </button>
                  <button type="button" className="adm-btn is-small" disabled={disabled || i === items.length - 1 || isPinned(item) || pinnedAt(i + 1)} onClick={() => move(i, 1)}>
                    Move down<span className="adm-sr-only"> {nameOf(item.route)}</span>
                  </button>
                  <button type="button" className="adm-btn is-small is-danger" disabled={disabled || isPinned(item) || items.length <= model.minItems} onClick={() => setItems((list) => list.filter((_, n) => n !== i))}>
                    Remove<span className="adm-sr-only"> {nameOf(item.route)}</span>
                  </button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
      {canEdit && !model.fixed && items.length < model.maxItems && free.length ? (
        <div className="adm-actions">
          <button type="button" className="adm-btn" disabled={disabled} onClick={() => setItems((list) => [...list, { id: "", linkType: "route", route: free[0].key, label: { en: "", ar: "" }, isVisible: true }])}>
            Add a page
          </button>
        </div>
      ) : null}
      {canEdit ? (
        <div className="adm-savebar adm-site-menu-bar">
          <span className="adm-savebar-status" role="status">
            {pending ? "Saving…" : dirty ? "Unsaved changes" : "No unsaved changes"}
          </span>
          <button type="submit" className="adm-btn is-primary" disabled={pending} aria-disabled={pending}>
            {pending ? "Saving…" : `Save ${model.name.toLowerCase()}`}
          </button>
        </div>
      ) : null}
    </form>
  );
}
