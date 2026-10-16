import { Fragment, type ReactNode } from "react";
import { getDictionary } from "@/i18n/dictionaries";
import { LINK_KINDS } from "@/server/builder/links";
import { isListBlock, readRich, type RichInlineNode } from "@/server/builder/richtext";
import { resolveLink } from "@/server/builder/view";
import type { RenderContext } from "./context";

/**
 * A rich-text document as React elements (A1-CONTENT-MODEL §12; A5 brief §14): paragraphs, headings 3–4, bulleted and
 * numbered lists, line breaks; bold, italic, links and language marks. The document is read again through the rich-text
 * schema (any shape, node, mark or scheme outside the model reads as an empty document), and every element is built by
 * React from plain strings — never HTML. Links come from their structured targets (`resolveLink`); a link whose target no
 * longer exists keeps its words without the link. A language mark sets `lang` and the direction.
 */
export function RichText({ value, ctx, className = "", prose = "gb-prose" }: { value: unknown; ctx: RenderContext; className?: string; prose?: string }) {
  // The structure check only: the field's own rules (which links, headings, lists, lengths) were applied when it was saved.
  const doc = readRich(value, { links: LINK_KINDS });
  if (!doc.content.length) return null;
  const external = getDictionary(ctx.locale).a11y.externalLink;

  const inline = (nodes: RichInlineNode[]) =>
    nodes.map((node, i) => {
      if (node.type === "hard_break") return <br key={i} />;
      let element: ReactNode = node.text;
      const marks = node.marks ?? [];
      if (marks.some((m) => m.type === "bold")) element = <strong>{element}</strong>;
      if (marks.some((m) => m.type === "italic")) element = <em>{element}</em>;
      const lang = marks.find((m) => m.type === "lang");
      if (lang?.type === "lang") element = <span lang={lang.lang} dir={lang.lang === "ar" ? "rtl" : "ltr"}>{element}</span>;
      const link = marks.find((m) => m.type === "link");
      if (link?.type === "link") {
        const resolved = resolveLink(link.target, ctx.locale, ctx.records, ctx.hrefOf);
        if (resolved)
          element = resolved.external ? (
            <a href={resolved.href} target="_blank" rel="noopener noreferrer">
              {element}
              <span className="gb-sr"> ({external})</span>
            </a>
          ) : (
            <a href={resolved.href}>{element}</a>
          );
      }
      return <Fragment key={i}>{element}</Fragment>;
    });

  return (
    <div className={`${prose} ${className}`.trim()}>
      {doc.content.map((block, i) => {
        if (isListBlock(block)) {
          const items = block.content.map((item, j) => <li key={j}>{inline(item.content)}</li>);
          return block.type === "ordered_list" ? <ol key={i}>{items}</ol> : <ul key={i}>{items}</ul>;
        }
        if (block.type === "heading") return block.level === 3 ? <h3 key={i} className="t-h3">{inline(block.content)}</h3> : <h4 key={i} className="t-h4">{inline(block.content)}</h4>;
        return <p key={i}>{inline(block.content)}</p>;
      })}
    </div>
  );
}
