"use client";
/**
 * Chooses a link target (A5 brief §49–§50): a page of the site by its key, a managed record by its id (resolved when the
 * page is drawn), a section of this page by its anchor, or an https address, an email address or a phone number where
 * the field allows them. Never a free URL: `javascript:`, `data:` and other schemes cannot be entered at all.
 */
import type { LinkKindName } from "@/server/admin/actions/builder-model";
import { useEnv } from "./env";

export type LinkValue = Record<string, unknown> & { type: LinkKindName };

/** A link target chooser: what it opens (a page of the site, a record, a section of this page, an https address…). */
export function LinkChooser({
  kinds,
  value,
  onChange,
  required,
  label,
  idBase,
}: {
  kinds: LinkKindName[];
  value: LinkValue | null;
  onChange: (v: LinkValue | null) => void;
  required: boolean;
  label: string;
  idBase: string;
}) {
  const env = useEnv();
  const kindLabel = (kind: LinkKindName) => env.links.kinds.find((k) => k.value === kind)?.label ?? kind;
  const first = (kind: LinkKindName): LinkValue => {
    switch (kind) {
      case "system":
        return { type: "system", key: env.links.system[0]?.key ?? "home" };
      case "page":
        return { type: "page", id: env.links.pages.find((p) => !p.archived)?.id ?? "" };
      case "service":
        return { type: "service", id: env.links.services.find((p) => !p.archived)?.id ?? "" };
      case "project":
        return { type: "project", id: env.links.projects.find((p) => !p.archived)?.id ?? "" };
      case "machine":
        return { type: "machine", id: env.links.machines.find((p) => !p.archived)?.id ?? "" };
      case "anchor":
        return { type: "anchor", anchor: env.anchors[0] ?? "" };
      case "external":
        return { type: "external", url: "https://" };
      case "email":
        return { type: "email", address: "" };
      case "phone":
        return { type: "phone", number: "" };
    }
  };
  const records = (kind: LinkKindName) =>
    kind === "page" ? env.links.pages : kind === "service" ? env.links.services : kind === "project" ? env.links.projects : kind === "machine" ? env.links.machines : [];
  const set = (patch: Record<string, unknown>) => value && onChange({ ...value, ...patch } as LinkValue);
  const anchorInput = value && (value.type === "system" || value.type === "page" || value.type === "service") && (
    <>
      <label className="adm-label" htmlFor={`${idBase}-anchor`}>
        Section of that page (optional anchor)
      </label>
      <input
        id={`${idBase}-anchor`}
        className="adm-input"
        dir="ltr"
        value={typeof value.anchor === "string" ? value.anchor : ""}
        disabled={env.disabled}
        placeholder="for example quote"
        onChange={(e) => {
          const anchor = e.target.value.trim().toLowerCase();
          const next = { ...value } as Record<string, unknown>;
          if (anchor) next.anchor = anchor;
          else delete next.anchor;
          onChange(next as LinkValue);
        }}
      />
    </>
  );
  return (
    <div className="adm-bld-link" role="group" aria-label={label}>
      <label className="adm-label" htmlFor={`${idBase}-kind`}>
        Opens
      </label>
      <select
        id={`${idBase}-kind`}
        className="adm-input"
        value={value?.type ?? ""}
        disabled={env.disabled}
        onChange={(e) => onChange(e.target.value ? first(e.target.value as LinkKindName) : null)}
      >
        {!required || !value ? <option value="">{required ? "Choose…" : "Nothing (no link)"}</option> : null}
        {kinds.map((kind) => (
          <option key={kind} value={kind}>
            {kindLabel(kind)}
          </option>
        ))}
      </select>
      {value?.type === "system" ? (
        <>
          <label className="adm-label" htmlFor={`${idBase}-target`}>
            Page
          </label>
          <select id={`${idBase}-target`} className="adm-input" value={String(value.key ?? "")} disabled={env.disabled} onChange={(e) => set({ key: e.target.value })}>
            {env.links.system.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </>
      ) : null}
      {value && (value.type === "page" || value.type === "service" || value.type === "project" || value.type === "machine") ? (
        <>
          <label className="adm-label" htmlFor={`${idBase}-target`}>
            {kindLabel(value.type)}
          </label>
          <select id={`${idBase}-target`} className="adm-input" value={String(value.id ?? "")} disabled={env.disabled} onChange={(e) => set({ id: e.target.value })}>
            <option value="">Choose…</option>
            {records(value.type).map((o) => (
              <option key={o.id} value={o.id} disabled={o.archived && o.id !== value.id}>
                {o.label}
                {o.archived ? " (archived)" : ""}
              </option>
            ))}
          </select>
        </>
      ) : null}
      {anchorInput}
      {value?.type === "anchor" ? (
        <>
          <label className="adm-label" htmlFor={`${idBase}-target`}>
            Section of this page
          </label>
          <select id={`${idBase}-target`} className="adm-input" value={String(value.anchor ?? "")} disabled={env.disabled} onChange={(e) => set({ anchor: e.target.value })}>
            <option value="">Choose…</option>
            {env.anchors.map((a) => (
              <option key={a} value={a}>
                #{a}
              </option>
            ))}
          </select>
        </>
      ) : null}
      {value?.type === "external" ? (
        <>
          <label className="adm-label" htmlFor={`${idBase}-target`}>
            Address (https only)
          </label>
          <input id={`${idBase}-target`} className="adm-input" type="url" dir="ltr" value={String(value.url ?? "")} disabled={env.disabled} onChange={(e) => set({ url: e.target.value.trim() })} />
        </>
      ) : null}
      {value?.type === "email" ? (
        <>
          <label className="adm-label" htmlFor={`${idBase}-target`}>
            Email address
          </label>
          <input id={`${idBase}-target`} className="adm-input" type="email" dir="ltr" value={String(value.address ?? "")} disabled={env.disabled} onChange={(e) => set({ address: e.target.value.trim() })} />
        </>
      ) : null}
      {value?.type === "phone" ? (
        <>
          <label className="adm-label" htmlFor={`${idBase}-target`}>
            Phone number
          </label>
          <input id={`${idBase}-target`} className="adm-input" type="tel" dir="ltr" value={String(value.number ?? "")} disabled={env.disabled} onChange={(e) => set({ number: e.target.value })} />
        </>
      ) : null}
    </div>
  );
}
