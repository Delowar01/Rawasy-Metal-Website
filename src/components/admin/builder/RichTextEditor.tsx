"use client";
/**
 * The page builder's rich-text editor (A5 brief §14): the text is typed as plain text, block by block — paragraphs,
 * headings (levels 3 and 4), bulleted or numbered lists with one item per line — and formatting is applied to the
 * selected text with buttons (bold, italic, a structured link, a language mark). Nothing typed is ever read as markup:
 * a text box only holds text, pasted text arrives as text, and the document the field stores is built from the blocks
 * and the formatting ranges (`rich-edit.ts`). Each block lists its formatting with a remove button, so everything can be
 * seen and undone with the keyboard.
 */
import { useId, useRef, useState, type ReactNode } from "react";
import type { BuilderLocale, FieldModel } from "@/server/admin/actions/builder-model";
import { issuesAt, textDir, useEnv } from "./env";
import { LinkChooser, type LinkValue } from "./LinkChooser";
import {
  BLOCK_KINDS,
  blockKey,
  blocksToDoc,
  charCount,
  docToBlocks,
  retype,
  setRangeMark,
  shiftSpans,
  toggleMark,
  type BlockKind,
  type EditBlock,
  type Mark,
  type Span,
} from "./rich-edit";

type RichField = Extract<FieldModel, { kind: "rich" }>;

/** How a piece of formatting reads in the list under its block. */
function useMarkLabel() {
  const env = useEnv();
  return (mark: Mark): string => {
    if (mark.type === "bold") return "Bold";
    if (mark.type === "italic") return "Italic";
    if (mark.type === "lang") return mark.lang === "ar" ? "Arabic text" : "English text";
    const t = mark.target;
    const record = (list: { id: string; label: string }[]) => list.find((o) => o.id === t.id)?.label ?? "(no longer exists)";
    switch (t.type) {
      case "system":
        return `Link: ${env.links.system.find((s) => s.key === t.key)?.label ?? String(t.key)}${t.anchor ? ` #${String(t.anchor)}` : ""}`;
      case "page":
        return `Link: ${record(env.links.pages)}${t.anchor ? ` #${String(t.anchor)}` : ""}`;
      case "service":
        return `Link: ${record(env.links.services)}${t.anchor ? ` #${String(t.anchor)}` : ""}`;
      case "project":
        return `Link: ${record(env.links.projects)}`;
      case "machine":
        return `Link: ${record(env.links.machines)}`;
      case "anchor":
        return `Link: this page #${String(t.anchor)}`;
      case "external":
        return `Link: ${String(t.url)}`;
      case "email":
        return `Link: email ${String(t.address)}`;
      case "phone":
        return `Link: phone ${String(t.number)}`;
      default:
        return "Link";
    }
  };
}

/** One block as it will read: its text with its formatting (bold, italic, links underlined, language marked). */
function Reads({ block }: { block: EditBlock }) {
  const doc = blocksToDoc([block]);
  const first = doc.content[0];
  if (!first) return null;
  const inline = (nodes: { type: string; text?: string; marks?: Mark[] }[]): ReactNode[] =>
    nodes.map((node, i) => {
      if (node.type === "hard_break") return <br key={i} />;
      let out: ReactNode = node.text;
      for (const mark of node.marks ?? []) {
        if (mark.type === "bold") out = <strong>{out}</strong>;
        else if (mark.type === "italic") out = <em>{out}</em>;
        else if (mark.type === "link") out = <span className="adm-bld-rich-link">{out}</span>;
        else if (mark.type === "lang") out = <span lang={mark.lang} dir={mark.lang === "ar" ? "rtl" : "ltr"}>{out}</span>;
      }
      return <span key={i}>{out}</span>;
    });
  if (first.type === "bullet_list" || first.type === "ordered_list") {
    const List = first.type === "bullet_list" ? "ul" : "ol";
    return (
      <List className="adm-bld-rich-reads">
        {first.content.map((item, i) => (
          <li key={i}>{inline(item.content)}</li>
        ))}
      </List>
    );
  }
  return <p className="adm-bld-rich-reads">{inline(first.content as { type: string; text?: string; marks?: Mark[] }[])}</p>;
}

export function RichTextEditor({ field, value, onChange, locale, path }: { field: RichField; value: unknown; onChange: (v: unknown) => void; locale: BuilderLocale; path: string }) {
  const env = useEnv();
  const id = useId();
  const markLabel = useMarkLabel();
  const valueKey = JSON.stringify(value ?? null);
  // The blocks being edited, and the document they last produced (a different value from outside — undo, another
  // language — starts the blocks again from it).
  const [state, setState] = useState(() => ({ key: valueKey, blocks: docToBlocks(value) }));
  if (state.key !== valueKey) setState({ key: valueKey, blocks: docToBlocks(value) });
  const blocks = state.blocks;
  const areas = useRef(new Map<string, HTMLTextAreaElement>());
  const [status, setStatus] = useState("");
  const [linking, setLinking] = useState<{ key: string; start: number; end: number; target: LinkValue | null } | null>(null);
  const kinds = BLOCK_KINDS.filter((k) => (!k.heading || field.headings) && (!k.list || field.lists));

  const commit = (next: EditBlock[]) => {
    const doc = blocksToDoc(next);
    setState({ key: JSON.stringify(doc), blocks: next });
    onChange(doc);
  };
  const setBlock = (key: string, recipe: (b: EditBlock) => EditBlock) => commit(blocks.map((b) => (b.key === key ? recipe(b) : b)));
  const selection = (key: string): [number, number] | null => {
    const area = areas.current.get(key);
    if (!area || area.selectionStart === area.selectionEnd) {
      setStatus("Select some text in this block first.");
      return null;
    }
    setStatus("");
    return [area.selectionStart, area.selectionEnd];
  };
  const format = (block: EditBlock, type: "bold" | "italic") => {
    const range = selection(block.key);
    if (range) setBlock(block.key, (b) => ({ ...b, spans: toggleMark(b.spans, range[0], range[1], type) }));
  };
  const language = (block: EditBlock, lang: "en" | "ar" | null) => {
    const range = selection(block.key);
    if (range) setBlock(block.key, (b) => ({ ...b, spans: setRangeMark(b.spans, range[0], range[1], "lang", lang ? { type: "lang", lang } : null) }));
  };
  const startLink = (block: EditBlock) => {
    const range = selection(block.key);
    if (range) setLinking({ key: block.key, start: range[0], end: range[1], target: null });
  };
  const removeSpan = (block: EditBlock, span: Span) => setBlock(block.key, (b) => ({ ...b, spans: b.spans.filter((s) => s !== span) }));
  const move = (from: number, to: number) => {
    if (to < 0 || to >= blocks.length) return;
    const next = [...blocks];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    commit(next);
  };
  const add = (kind: BlockKind) => commit([...blocks, { key: blockKey(), kind, text: "", spans: [] }]);
  const chars = charCount(blocks);
  const problems = issuesAt(env, path);

  return (
    <fieldset className="adm-bld-rich" data-path={path} aria-describedby={`${id}-hint`}>
      <legend className="adm-label">
        {field.label}
        {field.required ? <span className="adm-muted"> (needed for complete)</span> : null}
        <span className="adm-bld-count">
          {chars} / {field.maxChars}
        </span>
      </legend>
      <p className="adm-hint" id={`${id}-hint`}>
        Type plain text. To format, select text in a block, then use its buttons. Blank lines start a new paragraph.
      </p>
      {problems.map((m, i) => (
        <p key={i} className="adm-hint adm-error" role="alert">
          {m}
        </p>
      ))}
      <p className="adm-sr-only" role="status" aria-live="polite">
        {status}
      </p>
      {status ? <p className="adm-hint adm-bld-warn">{status}</p> : null}
      <ol className="adm-bld-rich-blocks">
        {blocks.map((block, index) => {
          const kindLabel = BLOCK_KINDS.find((k) => k.value === block.kind)?.label ?? "Paragraph";
          const name = `Block ${index + 1}`;
          return (
            <li key={block.key} className="adm-bld-rich-block">
              <div className="adm-bld-rich-head">
                <label className="adm-sr-only" htmlFor={`${id}-${block.key}-kind`}>
                  {name}: kind
                </label>
                <select
                  id={`${id}-${block.key}-kind`}
                  className="adm-input adm-bld-rich-kind"
                  value={block.kind}
                  disabled={env.disabled}
                  onChange={(e) => setBlock(block.key, (b) => retype(b, e.target.value as BlockKind))}
                >
                  {kinds.map((k) => (
                    <option key={k.value} value={k.value}>
                      {k.label}
                    </option>
                  ))}
                </select>
                <span className="adm-bld-list-buttons">
                  <button type="button" className="adm-btn is-small" disabled={env.disabled || index === 0} onClick={() => move(index, index - 1)} aria-label={`Move ${name} up`}>
                    Up
                  </button>
                  <button type="button" className="adm-btn is-small" disabled={env.disabled || index === blocks.length - 1} onClick={() => move(index, index + 1)} aria-label={`Move ${name} down`}>
                    Down
                  </button>
                  <button type="button" className="adm-btn is-small" disabled={env.disabled} onClick={() => commit(blocks.filter((b) => b.key !== block.key))} aria-label={`Remove ${name}`}>
                    Remove
                  </button>
                </span>
              </div>
              <label className="adm-sr-only" htmlFor={`${id}-${block.key}`}>
                {name} ({kindLabel})
              </label>
              <textarea
                id={`${id}-${block.key}`}
                ref={(el) => {
                  if (el) areas.current.set(block.key, el);
                  else areas.current.delete(block.key);
                }}
                className="adm-input adm-textarea"
                rows={block.kind === "h3" || block.kind === "h4" ? 1 : 3}
                value={block.text}
                disabled={env.disabled}
                onChange={(e) => {
                  const heading = block.kind === "h3" || block.kind === "h4";
                  const text = heading ? e.target.value.replace(/\n/g, " ") : e.target.value;
                  setBlock(block.key, (b) => ({ ...b, text, spans: shiftSpans(b.spans, b.text, text) }));
                }}
                {...textDir(locale)}
              />
              <div className="adm-bld-rich-tools" role="group" aria-label={`${name}: formatting of the selected text`}>
                <button type="button" className="adm-btn is-small" disabled={env.disabled} onClick={() => format(block, "bold")}>
                  Bold
                </button>
                <button type="button" className="adm-btn is-small" disabled={env.disabled} onClick={() => format(block, "italic")}>
                  Italic
                </button>
                {field.links.length ? (
                  <button type="button" className="adm-btn is-small" disabled={env.disabled} onClick={() => startLink(block)}>
                    Link…
                  </button>
                ) : null}
                <button type="button" className="adm-btn is-small" disabled={env.disabled} onClick={() => language(block, locale === "ar" ? "en" : "ar")}>
                  Mark as {locale === "ar" ? "English" : "Arabic"}
                </button>
              </div>
              {linking?.key === block.key ? (
                <div className="adm-bld-rich-linking">
                  <p className="adm-hint">Link “{block.text.slice(linking.start, linking.end).slice(0, 60)}”</p>
                  <LinkChooser
                    kinds={field.links}
                    value={linking.target}
                    onChange={(target) => setLinking({ ...linking, target })}
                    required
                    label="Link target"
                    idBase={`${id}-${block.key}-link`}
                  />
                  <div className="adm-actions">
                    <button
                      type="button"
                      className="adm-btn is-primary is-small"
                      disabled={!linking.target}
                      onClick={() => {
                        const target = linking.target;
                        if (target) setBlock(block.key, (b) => ({ ...b, spans: setRangeMark(b.spans, linking.start, linking.end, "link", { type: "link", target }) }));
                        setLinking(null);
                      }}
                    >
                      Apply the link
                    </button>
                    <button type="button" className="adm-btn is-small" onClick={() => setLinking(null)}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}
              {block.spans.length ? (
                <>
                  <ul className="adm-bld-rich-marks" aria-label={`${name}: formatting`}>
                    {block.spans.map((span, i) => (
                      <li key={i}>
                        <span>
                          {markLabel(span.mark)}: “{block.text.slice(span.start, span.end).slice(0, 40)}”
                        </span>
                        <button type="button" className="adm-btn is-small" disabled={env.disabled} onClick={() => removeSpan(block, span)}>
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                  <div className="adm-bld-rich-preview" {...textDir(locale)}>
                    <span className="adm-sr-only">Reads as: </span>
                    <Reads block={block} />
                  </div>
                </>
              ) : null}
            </li>
          );
        })}
      </ol>
      <div className="adm-actions">
        {kinds.map((k) => (
          <button key={k.value} type="button" className="adm-btn is-small" disabled={env.disabled} onClick={() => add(k.value)}>
            {k.add}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
